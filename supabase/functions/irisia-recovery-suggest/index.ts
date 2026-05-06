import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const { lead_id, kind = "followup", message = "" } = body;
    if (!lead_id) return new Response(JSON.stringify({ error: "lead_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: lead } = await supa.from("leads").select("*").eq("id", lead_id).maybeSingle();
    if (!lead) return new Response(JSON.stringify({ error: "lead not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: events } = await supa.from("lead_events").select("type,title,description,occurred_at").eq("lead_id", lead_id).order("occurred_at", { ascending: false }).limit(15);

    const sys = `Você é a IrisIA, assistente comercial. Gere uma mensagem curta (até 3 frases), cordial e personalizada em pt-BR, para reengajar um lead. Tipo: ${kind}. Use o nome do lead quando possível e proponha uma próxima ação concreta.`;
    const userMsg = `Lead: ${lead.name} (${lead.company || "-"}), estágio ${lead.stage}, produto ${lead.product || "-"}.\nContexto: ${message || "sem contexto"}.\nEventos recentes:\n${(events || []).map((e: any) => `- ${e.title}: ${e.description}`).join("\n") || "sem histórico"}`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: "ai_failed", detail: txt }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ message: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
