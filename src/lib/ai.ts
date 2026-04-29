import { supabase } from "@/integrations/supabase/client";

export type AIAction = "suggest_reply" | "break_objection" | "analyze" | "generate_script";

export interface AIContext {
  product?: string;
  audience?: string;
  objective?: string;
  clientProfile?: string;
  stage?: string;
  tone?: number;
  aggressiveness?: number;
  methodology?: string;
}

export async function callIrisAI(payload: {
  action: AIAction;
  context?: AIContext;
  history?: { role: "client" | "seller" | "ai"; content: string }[];
  message?: string;
  objection?: string;
  scriptInput?: { title: string; product: string; audience: string; stage: string; tone: string };
}) {
  const { data, error } = await supabase.functions.invoke("irisia-ai", { body: payload });
  if (error) {
    // supabase.functions.invoke wraps non-2xx as error. Surface message.
    throw new Error(error.message || "Erro ao chamar IrisIA");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
