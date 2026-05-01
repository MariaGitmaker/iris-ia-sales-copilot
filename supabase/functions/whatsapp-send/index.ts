// Send a WhatsApp message manually from the operator panel (handoff/human reply
// or proactive outreach). Authenticated; user can only send through their own channel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: uerr } = await userClient.auth.getUser();
    if (uerr || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { conversation_id, text } = body || {};
    if (!conversation_id || !text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "conversation_id and text are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: conv } = await admin
      .from("conversations")
      .select("id,user_id,channel_id,external_contact_id,negotiation_id")
      .eq("id", conversation_id)
      .maybeSingle();
    if (!conv || conv.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: channel } = await admin
      .from("channels")
      .select("phone_number_id,access_token,type")
      .eq("id", conv.channel_id)
      .maybeSingle();
    if (!channel) return new Response(JSON.stringify({ error: "channel not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const r = await fetch(`https://graph.facebook.com/v21.0/${channel.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channel.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conv.external_contact_id,
        type: "text",
        text: { body: text },
      }),
    });
    const data = await r.json().catch(() => ({}));

    await admin.from("channel_messages").insert({
      conversation_id: conv.id,
      direction: "outbound",
      sender: "human",
      content: text,
      external_message_id: data?.messages?.[0]?.id || "",
      status: r.ok ? "sent" : "failed",
      metadata: data,
    });
    await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);
    if (conv.negotiation_id) {
      await admin.from("negotiation_messages").insert({
        negotiation_id: conv.negotiation_id,
        role: "seller",
        content: text,
      });
    }

    return new Response(JSON.stringify({ ok: r.ok, response: data }), {
      status: r.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("whatsapp-send error", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
