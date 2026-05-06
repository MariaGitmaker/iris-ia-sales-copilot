import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Pega regras ativas
  const { data: rules } = await supa.from("reminder_rules").select("*").eq("enabled", true);
  let created = 0;
  for (const r of rules || []) {
    if (r.trigger_type !== "inactivity" && r.trigger_type !== "stage_age") continue;
    const cutoff = new Date(Date.now() - r.threshold_hours * 3600 * 1000).toISOString();
    let q = supa.from("leads").select("id,user_id,name,stage,updated_at").eq("user_id", r.user_id).is("deleted_at", null).lt("updated_at", cutoff);
    if (r.stages && r.stages.length > 0) q = q.in("stage", r.stages);
    const { data: leads } = await q.limit(200);
    for (const l of leads || []) {
      const dueKey = new Date().toISOString();
      const { error } = await supa.from("lead_reminders").insert({
        user_id: l.user_id, lead_id: l.id, kind: "followup", due_at: dueKey,
        message: `Lead ${l.name} sem interação há mais de ${r.threshold_hours}h (estágio ${l.stage}).`,
        meta: { rule_id: r.id, rule_name: r.name },
      });
      if (!error) created++;
    }
  }
  return new Response(JSON.stringify({ ok: true, created }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
