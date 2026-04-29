import { supabase } from "@/integrations/supabase/client";

export type AIAction =
  | "suggest_reply"
  | "break_objection"
  | "analyze"
  | "generate_script"
  | "import_conversation"
  | "training_roleplay"
  | "training_feedback"
  | "generate_insights"
  | "lead_from_negotiation";

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
  attachments?: { kind: "text" | "image" | "audio"; name?: string; mime?: string; data: string }[];
  scenario?: { title: string; profile: string; difficulty: string; product?: string; objective?: string };
  stats?: any;
  negotiation?: any;
}) {
  const { data, error } = await supabase.functions.invoke("irisia-ai", { body: payload });
  if (error) throw new Error(error.message || "Erro ao chamar IrisIA");
  if (data?.error) throw new Error(data.error);
  return data;
}

// Helpers for file → attachment
export async function fileToAttachment(file: File): Promise<{ kind: "text" | "image" | "audio"; name: string; mime: string; data: string }> {
  const name = file.name;
  const mime = file.type || "application/octet-stream";
  if (mime.startsWith("text/") || name.endsWith(".txt")) {
    const data = await file.text();
    return { kind: "text", name, mime: "text/plain", data };
  }
  const buf = await file.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);
  if (mime.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(name)) {
    return { kind: "image", name, mime: mime.startsWith("image/") ? mime : "image/jpeg", data: b64 };
  }
  if (mime.startsWith("audio/") || /\.(opus|ogg|mp3|wav|m4a)$/i.test(name)) {
    return { kind: "audio", name, mime: mime || "audio/ogg", data: b64 };
  }
  // fallback as text
  const data = await file.text();
  return { kind: "text", name, mime: "text/plain", data };
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}
