// IrisIA — AI copilot edge function
// Lovable AI Gateway. Actions: suggest_reply, break_objection, analyze, generate_script,
// import_conversation (multimodal), training_roleplay, training_feedback,
// generate_insights, lead_from_negotiation.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type Action =
  | "suggest_reply"
  | "break_objection"
  | "analyze"
  | "generate_script"
  | "import_conversation"
  | "training_roleplay"
  | "training_feedback"
  | "generate_insights"
  | "lead_from_negotiation";

interface Body {
  action: Action;
  context?: {
    product?: string;
    audience?: string;
    objective?: string;
    clientProfile?: string;
    stage?: string;
    tone?: number;
    aggressiveness?: number;
    methodology?: string;
  };
  history?: { role: "client" | "seller" | "ai"; content: string }[];
  message?: string;
  objection?: string;
  scriptInput?: { title: string; product: string; audience: string; stage: string; tone: string };
  // Imports
  attachments?: { kind: "text" | "image" | "audio"; name?: string; mime?: string; data: string /* base64 for image/audio, raw text for text */ }[];
  // Training
  scenario?: { title: string; profile: string; difficulty: string; product?: string; objective?: string };
  // Insights
  stats?: any;
  // Lead from negotiation
  negotiation?: any;
}

function systemPrompt(ctx: Body["context"]) {
  return `Você é IrisIA — copiloto comercial sênior, closer de elite, analista comportamental e estrategista de persuasão.
Atue como: especialista em vendas consultivas (SPIN, Sandler, Challenger, Straight Line), neuromarketing, gatilhos mentais e linguagem persuasiva humanizada.
Responda SEMPRE em português brasileiro, tom humano, profissional, direto, sem clichês.

Contexto da negociação:
- Produto/serviço: ${ctx?.product || "não informado"}
- Público-alvo: ${ctx?.audience || "não informado"}
- OBJETIVO ESTRATÉGICO DESTA INTERAÇÃO: ${ctx?.objective || "fechar a venda"}
- Perfil do cliente: ${ctx?.clientProfile || "não informado"}
- Estágio: ${ctx?.stage || "qualificação"}
- Metodologia preferida: ${ctx?.methodology || "spin"}
- Tom (0=consultivo, 100=executivo): ${ctx?.tone ?? 50}
- Agressividade (0=passivo, 100=closer): ${ctx?.aggressiveness ?? 40}

REGRAS:
- O OBJETIVO acima é a bússola: TODA resposta deve servir esse objetivo.
- Nunca invente dados do cliente. Use só o que está no histórico.
- Aplique gatilhos mentais com sutileza: escassez, prova social, autoridade, reciprocidade, compromisso.
- Antecipe objeções e prepare o terreno.
- Linguagem natural, frases curtas, evite jargões.`;
}

async function callGateway(messages: any[], opts: { tools?: any; tool_choice?: any; model?: string } = {}) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const r = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: opts.model || DEFAULT_MODEL, messages, tools: opts.tools, tool_choice: opts.tool_choice }),
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
  return history.slice(-14).map((h) => ({
    role: h.role === "client" ? "user" : "assistant",
    content: `${h.role === "client" ? "[Cliente]" : h.role === "seller" ? "[Vendedor]" : "[IrisIA]"} ${h.content}`,
  }));
}

function toolArgs(data: any) {
  const a = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return a ? JSON.parse(a) : {};
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
        { role: "user", content: `Última mensagem do cliente: "${body.message || ""}".\nGere a MELHOR próxima resposta do vendedor alinhada ao OBJETIVO. Devolva via tool.` },
      ], {
        tools: [{ type: "function", function: { name: "respond", parameters: { type: "object", properties: {
          reply: { type: "string" }, technique: { type: "string" }, next_step: { type: "string" },
          closing_probability: { type: "number" }, sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
        }, required: ["reply", "technique", "next_step", "closing_probability", "sentiment"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "respond" } },
      });
      result = toolArgs(data);
    }
    else if (body.action === "break_objection") {
      const data = await callGateway([
        { role: "system", content: sys },
        { role: "user", content: `Objeção do cliente: "${body.objection || body.message || ""}".\nQuebre essa objeção com 3 ângulos diferentes alinhados ao OBJETIVO.` },
      ], {
        tools: [{ type: "function", function: { name: "objection", parameters: { type: "object", properties: {
          diagnosis: { type: "string" },
          responses: { type: "array", items: { type: "object", properties: { angle: { type: "string" }, script: { type: "string" } }, required: ["angle", "script"], additionalProperties: false } },
        }, required: ["diagnosis", "responses"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "objection" } },
      });
      result = toolArgs(data);
    }
    else if (body.action === "analyze") {
      const data = await callGateway([
        { role: "system", content: sys },
        ...historyToMessages(body.history),
        { role: "user", content: "Faça um diagnóstico completo da negociação até aqui considerando o OBJETIVO definido." },
      ], {
        tools: [{ type: "function", function: { name: "analyze", parameters: { type: "object", properties: {
          sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
          lead_score: { type: "number" }, closing_probability: { type: "number" },
          objections: { type: "array", items: { type: "string" } },
          strategies: { type: "array", items: { type: "string" } },
          next_steps: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        }, required: ["sentiment", "lead_score", "closing_probability", "objections", "strategies", "next_steps", "summary"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "analyze" } },
      });
      result = toolArgs(data);
    }
    else if (body.action === "generate_script") {
      const s = body.scriptInput!;
      const data = await callGateway([
        { role: "system", content: sys },
        { role: "user", content: `Gere um script comercial completo. Título: "${s.title}". Produto: "${s.product}". Público: "${s.audience}". Estágio: "${s.stage}". Tom: "${s.tone}".\nRetorne 5 seções: Abertura, Diagnóstico (perguntas SPIN), Apresentação de Valor, Quebra de Objeções, Fechamento.` },
      ], {
        tools: [{ type: "function", function: { name: "script", parameters: { type: "object", properties: {
          sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title", "content"], additionalProperties: false } },
        }, required: ["sections"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "script" } },
      });
      result = toolArgs(data);
    }
    else if (body.action === "import_conversation") {
      // Multimodal: extract conversation from text/images/audio attachments.
      const userContent: any[] = [{ type: "text", text: "Extraia o histórico de conversa dos arquivos abaixo. Identifique quem é cliente e quem é vendedor (Eu). Retorne via tool.\n" }];
      for (const att of body.attachments || []) {
        if (att.kind === "text") {
          userContent.push({ type: "text", text: `\n[Arquivo ${att.name || "texto"}]:\n${att.data}` });
        } else if (att.kind === "image") {
          userContent.push({ type: "image_url", image_url: { url: `data:${att.mime || "image/jpeg"};base64,${att.data}` } });
        } else if (att.kind === "audio") {
          // Gemini supports audio inline via image_url-like data URL using audio mime
          userContent.push({ type: "image_url", image_url: { url: `data:${att.mime || "audio/ogg"};base64,${att.data}` } });
        }
      }
      const data = await callGateway([
        { role: "system", content: "Você é um extrator de conversas de vendas. Identifique mensagens de cliente vs vendedor. Áudios devem ser transcritos. Imagens (prints de WhatsApp/etc) devem ser lidas via OCR. Mantenha ordem cronológica." },
        { role: "user", content: userContent },
      ], {
        tools: [{ type: "function", function: { name: "import", parameters: { type: "object", properties: {
          messages: { type: "array", items: { type: "object", properties: {
            role: { type: "string", enum: ["client", "seller"] }, content: { type: "string" },
          }, required: ["role", "content"], additionalProperties: false } },
          summary: { type: "string" },
        }, required: ["messages", "summary"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "import" } },
      });
      result = toolArgs(data);
    }
    else if (body.action === "training_roleplay") {
      // The AI plays the CLIENT according to scenario; user is the seller training.
      const sc = body.scenario!;
      const trainerSys = `Você está em modo TREINAMENTO. Você INTERPRETA o CLIENTE em uma simulação de vendas para treinar o vendedor (usuário).
Cenário: ${sc.title}
Perfil do cliente: ${sc.profile}
Dificuldade: ${sc.difficulty} (easy=facilita, medium=realista, hard=muito resistente, expert=cético + objeções fortes)
Produto/contexto: ${sc.product || "genérico"}
Objetivo do vendedor: ${sc.objective || "fechar a venda"}

REGRAS:
- Responda APENAS como cliente, em 1ª pessoa, frases naturais e curtas (1-3 frases).
- NÃO quebre o personagem. NÃO dê dicas.
- Reaja realisticamente: levante objeções coerentes com o perfil, peça desconto, demonstre dúvida, etc.
- Se vendedor for muito bom, ceda gradualmente. Se for fraco, endureça.`;
      const data = await callGateway([
        { role: "system", content: trainerSys },
        ...historyToMessages(body.history),
        { role: "user", content: `[Vendedor] ${body.message || ""}` },
      ]);
      result = { reply: data.choices?.[0]?.message?.content || "..." };
    }
    else if (body.action === "training_feedback") {
      const sc = body.scenario!;
      const data = await callGateway([
        { role: "system", content: `Você é um coach sênior de vendas. Avalie a performance do vendedor na simulação. Cenário: ${sc.title}. Perfil: ${sc.profile}. Difficulty: ${sc.difficulty}.` },
        ...historyToMessages(body.history),
        { role: "user", content: "Gere feedback final detalhado e nota 0-100 via tool." },
      ], {
        tools: [{ type: "function", function: { name: "feedback", parameters: { type: "object", properties: {
          score: { type: "number", description: "0-100" },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
          improvements: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
          verdict: { type: "string", enum: ["closed", "lost", "ongoing"] },
        }, required: ["score", "strengths", "weaknesses", "improvements", "summary", "verdict"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "feedback" } },
      });
      result = toolArgs(data);
    }
    else if (body.action === "generate_insights") {
      const data = await callGateway([
        { role: "system", content: "Você é analista de dados comerciais sênior. Gere insights acionáveis baseados nas estatísticas reais do usuário." },
        { role: "user", content: `Estatísticas: ${JSON.stringify(body.stats || {})}\nGere 4-6 insights práticos e específicos via tool. Cada insight deve ter 1 frase curta e impactante.` },
      ], {
        tools: [{ type: "function", function: { name: "insights", parameters: { type: "object", properties: {
          insights: { type: "array", items: { type: "object", properties: {
            title: { type: "string" }, description: { type: "string" },
            category: { type: "string", enum: ["conversion", "timing", "objection", "performance", "lead", "general"] },
            priority: { type: "string", enum: ["low", "medium", "high"] },
          }, required: ["title", "description", "category", "priority"], additionalProperties: false } },
        }, required: ["insights"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "insights" } },
      });
      result = toolArgs(data);
    }
    else if (body.action === "lead_from_negotiation") {
      const n = body.negotiation || {};
      const data = await callGateway([
        { role: "system", content: "Você extrai dados estruturados de leads a partir de uma conversa de vendas. Seja preciso." },
        { role: "user", content: `Negociação: cliente=${n.client_name}, empresa=${n.company}, produto=${n.product}, valor=${n.value}.\nHistórico (últimas msgs):\n${(body.history || []).slice(-10).map((h) => `[${h.role}] ${h.content}`).join("\n")}\n\nGere os dados do lead via tool.` },
      ], {
        tools: [{ type: "function", function: { name: "lead", parameters: { type: "object", properties: {
          name: { type: "string" }, company: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
          product: { type: "string" }, value: { type: "number" }, score: { type: "number" },
          stage: { type: "string", enum: ["new", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"] },
          source: { type: "string" }, notes: { type: "string" },
        }, required: ["name", "company", "product", "value", "score", "stage", "source", "notes"], additionalProperties: false } } }],
        tool_choice: { type: "function", function: { name: "lead" } },
      });
      result = toolArgs(data);
    }
    else {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const status = e.status === 429 ? 429 : e.status === 402 ? 402 : 500;
    const msg =
      status === 429 ? "Limite de requisições atingido. Tente novamente em instantes."
      : status === 402 ? "Créditos de IA esgotados. Adicione créditos no workspace."
      : e.message || "Erro interno";
    console.error("irisia-ai error:", e);
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
