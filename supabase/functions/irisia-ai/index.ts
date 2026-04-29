// IrisIA — AI copilot edge function
// Uses Lovable AI Gateway. Handles: suggest reply, break objection, analyze sentiment,
// generate script, full negotiation diagnosis.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type Action =
  | "suggest_reply"
  | "break_objection"
  | "analyze"
  | "generate_script"
  | "diagnose";

interface Body {
  action: Action;
  context?: {
    product?: string;
    audience?: string;
    objective?: string;
    clientProfile?: string;
    stage?: string;
    tone?: string;
    aggressiveness?: number;
    methodology?: string;
  };
  history?: { role: "client" | "seller" | "ai"; content: string }[];
  message?: string;
  objection?: string;
  scriptInput?: {
    title: string;
    product: string;
    audience: string;
    stage: string;
    tone: string;
  };
}

function systemPrompt(ctx: Body["context"]) {
  return `Você é IrisIA, copiloto comercial sênior especialista em vendas consultivas, SPIN, Sandler, Challenger e neuromarketing.
Responda SEMPRE em português brasileiro, tom humano, profissional, persuasivo e direto.
Contexto da negociação:
- Produto/serviço: ${ctx?.product || "não informado"}
- Público-alvo: ${ctx?.audience || "não informado"}
- Objetivo: ${ctx?.objective || "fechar a venda"}
- Perfil do cliente: ${ctx?.clientProfile || "não informado"}
- Estágio: ${ctx?.stage || "qualificação"}
- Metodologia preferida: ${ctx?.methodology || "spin"}
- Tom (0=consultivo, 100=executivo): ${ctx?.tone ?? 50}
- Agressividade (0=passivo, 100=closer): ${ctx?.aggressiveness ?? 40}

Aplique gatilhos mentais (escassez, prova social, autoridade, reciprocidade) com sutileza.
Nunca invente dados do cliente. Seja específico, evite clichês.`;
}

async function callGateway(messages: any[], opts: { tools?: any; tool_choice?: any } = {}) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const r = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      ...opts,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    const err: any = new Error(`Gateway ${r.status}: ${t}`);
    err.status = r.status;
    throw err;
  }
  return await r.json();
}

function historyToMessages(history?: Body["history"]) {
  if (!history) return [];
  return history.slice(-12).map((h) => ({
    role: h.role === "client" ? "user" : "assistant",
    content: `${h.role === "client" ? "[Cliente]" : h.role === "seller" ? "[Vendedor]" : "[IrisIA]"} ${h.content}`,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const sys = systemPrompt(body.context);

    let result: any;

    if (body.action === "suggest_reply") {
      const data = await callGateway([
        { role: "system", content: sys },
        ...historyToMessages(body.history),
        {
          role: "user",
          content: `Última mensagem do cliente: "${body.message || ""}".
Gere a MELHOR próxima resposta do vendedor. Devolva via tool.`,
        },
      ], {
        tools: [{
          type: "function",
          function: {
            name: "respond",
            description: "Resposta sugerida com estratégia",
            parameters: {
              type: "object",
              properties: {
                reply: { type: "string", description: "Mensagem humanizada pronta para enviar" },
                technique: { type: "string", description: "Técnica/gatilho mental aplicado" },
                next_step: { type: "string", description: "Próximo passo recomendado" },
                closing_probability: { type: "number", description: "0-100" },
                sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
              },
              required: ["reply", "technique", "next_step", "closing_probability", "sentiment"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "respond" } },
      });
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      result = args ? JSON.parse(args) : {};
    } else if (body.action === "break_objection") {
      const data = await callGateway([
        { role: "system", content: sys },
        {
          role: "user",
          content: `Objeção do cliente: "${body.objection || body.message || ""}".
Quebre essa objeção com 3 ângulos diferentes.`,
        },
      ], {
        tools: [{
          type: "function",
          function: {
            name: "objection",
            parameters: {
              type: "object",
              properties: {
                diagnosis: { type: "string" },
                responses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      angle: { type: "string" },
                      script: { type: "string" },
                    },
                    required: ["angle", "script"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["diagnosis", "responses"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "objection" } },
      });
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      result = args ? JSON.parse(args) : {};
    } else if (body.action === "analyze") {
      const data = await callGateway([
        { role: "system", content: sys },
        ...historyToMessages(body.history),
        { role: "user", content: "Faça um diagnóstico completo da negociação até aqui." },
      ], {
        tools: [{
          type: "function",
          function: {
            name: "analyze",
            parameters: {
              type: "object",
              properties: {
                sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                lead_score: { type: "number" },
                closing_probability: { type: "number" },
                objections: { type: "array", items: { type: "string" } },
                strategies: { type: "array", items: { type: "string" } },
                next_steps: { type: "array", items: { type: "string" } },
                summary: { type: "string" },
              },
              required: ["sentiment", "lead_score", "closing_probability", "objections", "strategies", "next_steps", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyze" } },
      });
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      result = args ? JSON.parse(args) : {};
    } else if (body.action === "generate_script") {
      const s = body.scriptInput!;
      const data = await callGateway([
        { role: "system", content: sys },
        {
          role: "user",
          content: `Gere um script comercial completo. Título: "${s.title}". Produto: "${s.product}". Público: "${s.audience}". Estágio: "${s.stage}". Tom: "${s.tone}".
Retorne 5 seções: Abertura, Diagnóstico (perguntas SPIN), Apresentação de Valor, Quebra de Objeções, Fechamento.`,
        },
      ], {
        tools: [{
          type: "function",
          function: {
            name: "script",
            parameters: {
              type: "object",
              properties: {
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      content: { type: "string" },
                    },
                    required: ["title", "content"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["sections"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "script" } },
      });
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      result = args ? JSON.parse(args) : { sections: [] };
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const status = e.status === 429 ? 429 : e.status === 402 ? 402 : 500;
    const msg =
      status === 429
        ? "Limite de requisições atingido. Tente novamente em instantes."
        : status === 402
          ? "Créditos de IA esgotados. Adicione créditos no workspace."
          : e.message || "Erro interno";
    console.error("irisia-ai error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
