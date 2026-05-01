// WhatsApp Cloud API webhook (Meta) — verification + inbound messages
// Public endpoint (verify_jwt = false). Identifies the channel by phone_number_id,
// stores the conversation/message, and triggers the bot reply when bot_active.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendWhatsApp(phoneNumberId: string, accessToken: string, to: string, text: string) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

async function generateBotReply(args: {
  settings: any;
  knowledge: any[];
  history: { role: string; content: string }[];
  message: string;
}) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  const { settings, knowledge, history, message } = args;
  const kbText = knowledge.length
    ? knowledge.slice(0, 25).map((k) => `- (${k.kind}) Q: ${k.question}\n  A: ${k.answer}`).join("\n")
    : "(vazia)";

  const sys = `Você é IrisIA — assistente comercial via WhatsApp.
OBJETIVO: ${settings.objective}
Produto: ${settings.product || "não informado"}
Público: ${settings.audience || "não informado"}
Metodologia: ${settings.methodology}
Tom (0=consultivo,100=executivo): ${settings.tone}
Agressividade (0=passivo,100=closer): ${settings.aggressiveness}

REGRAS DO USUÁRIO:
${settings.rules || "(nenhuma regra adicional)"}

BASE DE CONHECIMENTO (use quando relevante, sem citar como base):
${kbText}

INSTRUÇÕES DE FORMATO:
- Resposta curta (1-4 frases), natural, em pt-BR, como em WhatsApp.
- Sem markdown, sem listas longas.
- Se o cliente pedir humano ou algo fora do escopo, responda exatamente com "##HANDOFF##" (sem aspas).
- Mantenha o foco no OBJETIVO sem ser invasivo.`;

  const messages = [
    { role: "system", content: sys },
    ...history.slice(-12).map((h) => ({
      role: h.role === "client" ? "user" : "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  const r = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: DEFAULT_MODEL, messages }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI gateway ${r.status}: ${t}`);
  }
  const data = await r.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

function isInBusinessHours(bh: any): boolean {
  if (!bh?.enabled) return true;
  try {
    const tz = bh.tz || "America/Sao_Paulo";
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    const day = now.getDay(); // 0=Sun
    if (Array.isArray(bh.days) && !bh.days.includes(day)) return false;
    const [sh, sm] = (bh.start || "00:00").split(":").map(Number);
    const [eh, em] = (bh.end || "23:59").split(":").map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= sh * 60 + sm && cur <= eh * 60 + em;
  } catch {
    return true;
  }
}

function shouldHandoff(text: string, keywords: string[] | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (keywords || []).some((k) => k && t.includes(k.toLowerCase()));
}

async function ensureLeadAndNegotiation(userId: string, conv: any, settings: any) {
  if (!settings?.auto_crm) return { lead_id: conv.lead_id, negotiation_id: conv.negotiation_id };
  let leadId = conv.lead_id;
  let negId = conv.negotiation_id;
  if (!leadId) {
    const { data: lead } = await admin
      .from("leads")
      .insert({
        user_id: userId,
        name: conv.contact_name || conv.contact_phone || "Lead WhatsApp",
        company: "",
        phone: conv.contact_phone || "",
        stage: "new",
        source: "whatsapp",
      })
      .select("id")
      .single();
    leadId = lead?.id;
  }
  if (!negId) {
    const { data: neg } = await admin
      .from("negotiations")
      .insert({
        user_id: userId,
        lead_id: leadId,
        client_name: conv.contact_name || conv.contact_phone || "Cliente",
        company: "",
        product: settings.product || "",
        objective: settings.objective || "",
        stage: "new",
      })
      .select("id")
      .single();
    negId = neg?.id;
  }
  if (leadId !== conv.lead_id || negId !== conv.negotiation_id) {
    await admin.from("conversations").update({ lead_id: leadId, negotiation_id: negId }).eq("id", conv.id);
  }
  return { lead_id: leadId, negotiation_id: negId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);

  // --- Meta verification handshake ---
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token) {
      const { data: ch } = await admin
        .from("channels")
        .select("id")
        .eq("webhook_verify_token", token)
        .limit(1)
        .maybeSingle();
      if (ch) return new Response(challenge || "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    // WhatsApp Cloud API structure: entry[].changes[].value.{messages,contacts,metadata}
    const entries = payload.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        const meta = v.metadata || {};
        const phoneNumberId = meta.phone_number_id;
        if (!phoneNumberId) continue;

        // Status updates (delivered/read) — best effort
        if (v.statuses) {
          for (const st of v.statuses) {
            await admin
              .from("channel_messages")
              .update({ status: st.status })
              .eq("external_message_id", st.id);
          }
        }

        if (!v.messages) continue;

        const { data: channel } = await admin
          .from("channels")
          .select("*")
          .eq("phone_number_id", phoneNumberId)
          .limit(1)
          .maybeSingle();
        if (!channel) {
          console.warn("channel not found for phone_number_id", phoneNumberId);
          continue;
        }

        const userId = channel.user_id as string;

        // Load bot settings + knowledge once per user
        const { data: settings } = await admin
          .from("bot_settings")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        const { data: knowledge } = await admin
          .from("bot_knowledge")
          .select("kind,question,answer,rating")
          .eq("user_id", userId)
          .eq("active", true)
          .order("rating", { ascending: false })
          .limit(40);

        for (const m of v.messages) {
          const from = m.from as string; // E.164 sem +
          const contactName =
            (v.contacts || []).find((c: any) => c.wa_id === from)?.profile?.name || "";

          // Upsert conversation
          let { data: conv } = await admin
            .from("conversations")
            .select("*")
            .eq("channel_id", channel.id)
            .eq("external_contact_id", from)
            .maybeSingle();
          if (!conv) {
            const { data: created } = await admin
              .from("conversations")
              .insert({
                user_id: userId,
                channel_id: channel.id,
                external_contact_id: from,
                contact_name: contactName,
                contact_phone: from,
              })
              .select("*")
              .single();
            conv = created!;
          } else if (contactName && !conv.contact_name) {
            await admin.from("conversations").update({ contact_name: contactName }).eq("id", conv.id);
            conv.contact_name = contactName;
          }

          // Extract content
          let content = "";
          let mediaType = "";
          if (m.type === "text") content = m.text?.body || "";
          else if (m.type === "button") content = m.button?.text || "";
          else if (m.type === "interactive") content = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
          else { mediaType = m.type; content = `[${m.type}]`; }

          await admin.from("channel_messages").insert({
            conversation_id: conv.id,
            direction: "inbound",
            sender: "client",
            content,
            media_type: mediaType,
            external_message_id: m.id || "",
            status: "received",
            metadata: m,
          });
          await admin
            .from("conversations")
            .update({ last_message_at: new Date().toISOString(), unread_count: (conv.unread_count || 0) + 1 })
            .eq("id", conv.id);

          // Auto CRM
          await ensureLeadAndNegotiation(userId, conv, settings || {});

          // Mirror in negotiation thread if linked
          if (conv.negotiation_id) {
            await admin.from("negotiation_messages").insert({
              negotiation_id: conv.negotiation_id,
              role: "client",
              content,
            });
          }

          // Bot response gating
          if (!settings?.enabled) continue;
          if (!conv.bot_active) continue;
          if (!isInBusinessHours(settings?.business_hours)) continue;

          // Handoff?
          if (shouldHandoff(content, settings?.handoff_keywords)) {
            await admin.from("conversations").update({ bot_active: false }).eq("id", conv.id);
            const fb = settings?.fallback_message || "Vou chamar um humano.";
            const sent = await sendWhatsApp(phoneNumberId, channel.access_token, from, fb);
            await admin.from("channel_messages").insert({
              conversation_id: conv.id,
              direction: "outbound",
              sender: "bot",
              content: fb,
              external_message_id: sent.data?.messages?.[0]?.id || "",
              status: sent.ok ? "sent" : "failed",
              metadata: sent.data,
            });
            continue;
          }

          // Build history for AI
          const { data: histRows } = await admin
            .from("channel_messages")
            .select("sender,direction,content")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(20);
          const history = (histRows || [])
            .reverse()
            .slice(0, -1) // exclude the just-inserted inbound (we pass it as `message`)
            .map((r) => ({
              role: r.sender === "client" ? "client" : "seller",
              content: r.content,
            }));

          let reply = "";
          try {
            reply = await generateBotReply({
              settings,
              knowledge: knowledge || [],
              history,
              message: content,
            });
          } catch (e: any) {
            console.error("AI error", e?.message);
            reply = "";
          }

          if (!reply || reply.includes("##HANDOFF##")) {
            await admin.from("conversations").update({ bot_active: false }).eq("id", conv.id);
            const fb = settings?.fallback_message || "Um momento, vou te direcionar.";
            const sent = await sendWhatsApp(phoneNumberId, channel.access_token, from, fb);
            await admin.from("channel_messages").insert({
              conversation_id: conv.id,
              direction: "outbound",
              sender: "bot",
              content: fb,
              external_message_id: sent.data?.messages?.[0]?.id || "",
              status: sent.ok ? "sent" : "failed",
              metadata: sent.data,
            });
            continue;
          }

          const sent = await sendWhatsApp(phoneNumberId, channel.access_token, from, reply);
          await admin.from("channel_messages").insert({
            conversation_id: conv.id,
            direction: "outbound",
            sender: "bot",
            content: reply,
            external_message_id: sent.data?.messages?.[0]?.id || "",
            status: sent.ok ? "sent" : "failed",
            metadata: sent.data,
          });
          if (conv.negotiation_id) {
            await admin.from("negotiation_messages").insert({
              negotiation_id: conv.negotiation_id,
              role: "ai",
              content: reply,
            });
          }
          await admin
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conv.id);
        }
      }
    }
    return new Response("ok", { status: 200 });
  } catch (e: any) {
    console.error("webhook error:", e);
    // Return 200 to avoid Meta retries storms; log internally
    return new Response("ok", { status: 200 });
  }
});
