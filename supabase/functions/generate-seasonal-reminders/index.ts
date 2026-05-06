import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

// Datas comemorativas fixas / regras simples
const HOLIDAYS = [
  { key: "natal", name: "Natal", month: 12, day: 25, msg: "Olá {name}, desejamos um Feliz Natal! 🎄" },
  { key: "ano_novo", name: "Ano Novo", month: 1, day: 1, msg: "Olá {name}, um próspero Ano Novo! 🎉" },
  { key: "dia_maes", name: "Dia das Mães", month: 5, day: 12, msg: "Olá {name}, feliz Dia das Mães!" },
  { key: "dia_pais", name: "Dia dos Pais", month: 8, day: 11, msg: "Olá {name}, feliz Dia dos Pais!" },
  { key: "black_friday", name: "Black Friday", month: 11, day: 29, msg: "Olá {name}, condições especiais de Black Friday!" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  let created = 0;

  const { data: leads } = await supa.from("leads").select("id,user_id,name,birthday").is("deleted_at", null).limit(5000);

  // Aniversários (D-1)
  for (const l of leads || []) {
    if (!l.birthday) continue;
    const b = new Date(l.birthday);
    if (b.getMonth() + 1 === tomorrow.getMonth() + 1 && b.getDate() === tomorrow.getDate()) {
      const due = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9, 0, 0).toISOString();
      const { error } = await supa.from("lead_reminders").insert({
        user_id: l.user_id, lead_id: l.id, kind: "birthday", due_at: due,
        message: `Aniversário de ${l.name} amanhã. Envie uma mensagem!`,
        meta: { template: `Feliz aniversário, ${l.name}! 🎂` },
      });
      if (!error) created++;
    }
  }

  // Datas comemorativas (D-1)
  for (const h of HOLIDAYS) {
    if (h.month === tomorrow.getMonth() + 1 && h.day === tomorrow.getDate()) {
      for (const l of leads || []) {
        const due = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9, 0, 0).toISOString();
        const { error } = await supa.from("lead_reminders").insert({
          user_id: l.user_id, lead_id: l.id, kind: "holiday", due_at: due,
          message: `${h.name}: enviar mensagem para ${l.name}.`,
          meta: { holiday: h.key, template: h.msg.replace("{name}", l.name) },
        });
        if (!error) created++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, created }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
