import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { callIrisAI } from "@/lib/ai";
import { Loader2, Send, Sparkles, GraduationCap, Trophy, RotateCcw, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg { id?: string; role: "client" | "seller"; content: string }

const PRESET_SCENARIOS = [
  { title: "Cliente sensível a preço", profile: "Empreendedor PME, orçamento apertado, sempre tenta desconto", difficulty: "medium" },
  { title: "Cliente desconfiado", profile: "Já foi enganado antes, questiona tudo, exige provas e garantias", difficulty: "hard" },
  { title: "Cliente racional/CFO", profile: "Diretor financeiro, decide por números, exige ROI claro", difficulty: "hard" },
  { title: "Cliente apressado", profile: "Pouco tempo, quer respostas curtas e diretas", difficulty: "medium" },
  { title: "Cliente curioso (top of funnel)", profile: "Apenas explorando, baixa intenção, precisa ser educado", difficulty: "easy" },
  { title: "Cliente expert/cético", profile: "Conhece o mercado, compara concorrentes, faz perguntas técnicas difíceis", difficulty: "expert" },
];

export function Training() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ scenarioIdx: 0, custom: "", product: "", objective: "fechar a venda" });
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("training_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setSessions(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!active) { setMessages([]); setFeedback(null); return; }
    setFeedback(active.status === "finished" ? active.feedback : null);
    supabase.from("training_messages").select("*").eq("session_id", active.id).order("created_at")
      .then(({ data }) => setMessages((data as Msg[]) ?? []));
  }, [active]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, feedback]);

  const startSession = async () => {
    if (!user) return;
    const preset = PRESET_SCENARIOS[form.scenarioIdx];
    const title = form.custom || preset.title;
    const profile = preset.profile;
    const { data, error } = await supabase.from("training_sessions").insert({
      user_id: user.id, scenario: title, client_profile: profile,
      difficulty: preset.difficulty, product: form.product, status: "active",
      feedback: { objective: form.objective },
    }).select().single();
    if (error) return toast.error(error.message);
    setSessions((p) => [data, ...p]);
    setActive(data);
    setCreating(false);
    // Cliente inicia
    await aiTurn(data, []);
  };

  const aiTurn = async (session: any, history: Msg[], userMsg?: string) => {
    setBusy(true);
    try {
      const result = await callIrisAI({
        action: "training_roleplay",
        scenario: { title: session.scenario, profile: session.client_profile, difficulty: session.difficulty, product: session.product, objective: session.feedback?.objective || "fechar a venda" },
        history: history.map((h) => ({ role: h.role, content: h.content })),
        message: userMsg,
      });
      const reply = result.reply || "...";
      const { data } = await supabase.from("training_messages").insert({ session_id: session.id, role: "client", content: reply }).select().single();
      setMessages((p) => [...p, data as Msg]);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const send = async () => {
    if (!input.trim() || !active || busy) return;
    const text = input;
    setInput("");
    const { data } = await supabase.from("training_messages").insert({ session_id: active.id, role: "seller", content: text }).select().single();
    const newMsgs = [...messages, data as Msg];
    setMessages(newMsgs);
    await aiTurn(active, newMsgs, text);
  };

  const finishSession = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const result = await callIrisAI({
        action: "training_feedback",
        scenario: { title: active.scenario, profile: active.client_profile, difficulty: active.difficulty, product: active.product, objective: active.feedback?.objective },
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      setFeedback(result);
      await supabase.from("training_sessions").update({ status: "finished", score: result.score, feedback: { ...active.feedback, ...result } }).eq("id", active.id);
      setSessions((p) => p.map((s) => s.id === active.id ? { ...s, status: "finished", score: result.score, feedback: result } : s));
      setActive((a: any) => ({ ...a, status: "finished", score: result.score, feedback: result }));
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden lg:flex w-72 shrink-0 border-r border-border flex-col">
        <div className="p-3 border-b border-border">
          <Button onClick={() => { setCreating(true); setActive(null); }} className="w-full gradient-bg shadow-glow">+ Nova simulação</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <button key={s.id} onClick={() => setActive(s)}
              className={cn("w-full text-left p-3 rounded-lg", active?.id === s.id ? "bg-gradient-soft border border-border" : "hover:bg-secondary")}>
              <div className="font-semibold text-sm truncate">{s.scenario}</div>
              <div className="text-[10px] text-muted-foreground mt-1 flex gap-2 items-center">
                <span className="capitalize">{s.difficulty}</span>
                {s.status === "finished" && <span className="px-1.5 py-0.5 rounded bg-success/20 text-success">{s.score}/100</span>}
                {s.status === "active" && <span className="text-warning">em curso</span>}
              </div>
            </button>
          ))}
          {!sessions.length && <div className="text-xs text-muted-foreground p-4 text-center">Nenhuma simulação ainda</div>}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-4 py-3 border-b border-border glass flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="text-primary shrink-0" size={20} />
            <div className="min-w-0">
              <div className="font-display font-semibold truncate">{active?.scenario || "Aprenda a Negociar"}</div>
              <div className="text-xs text-muted-foreground truncate">{active ? `Cliente: ${active.client_profile}` : "Treine com clientes IA realistas"}</div>
            </div>
          </div>
          {active && active.status === "active" && (
            <Button size="sm" variant="outline" onClick={finishSession} disabled={busy || messages.length < 2}>
              <Flag size={14} className="mr-1" />Encerrar e avaliar
            </Button>
          )}
          <Button size="sm" className="gradient-bg lg:hidden" onClick={() => { setCreating(true); setActive(null); }}>+ Nova</Button>
        </header>

        {creating && (
          <div className="p-4 border-b border-border glass space-y-3 animate-fade-in">
            <h3 className="font-semibold">Configurar simulação</h3>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Cenário</div>
              <Select value={String(form.scenarioIdx)} onValueChange={(v) => setForm({ ...form, scenarioIdx: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRESET_SCENARIOS.map((p, i) => <SelectItem key={i} value={String(i)}>{p.title} · {p.difficulty}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Produto/serviço que você está vendendo" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
            <Input placeholder="Seu objetivo (ex: fechar hoje, marcar reunião)" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
            <div className="flex gap-2">
              <Button onClick={startSession} className="gradient-bg" disabled={busy}>Começar</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
          {!active && !creating && (
            <div className="h-full grid place-items-center text-center p-6">
              <div className="space-y-3 max-w-md">
                <GraduationCap className="mx-auto text-primary" size={48} />
                <h2 className="font-display text-xl">Treine como um closer de elite</h2>
                <p className="text-sm text-muted-foreground">Negocie com clientes IA realistas em vários perfis. Receba feedback detalhado ao final.</p>
                <Button onClick={() => setCreating(true)} className="gradient-bg shadow-glow">Iniciar simulação</Button>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2 max-w-[85%] md:max-w-[70%] animate-fade-in", m.role === "seller" ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn("w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold shrink-0",
                m.role === "client" ? "bg-secondary" : "gradient-bg text-white")}>
                {m.role === "client" ? "🤖" : "V"}
              </div>
              <div className={cn("rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                m.role === "seller" ? "gradient-bg text-white" : "glass")}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && active && !feedback && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="animate-spin" size={12} />Cliente pensando...</div>
          )}

          {feedback && (
            <Card className="glass-strong border-primary/40 p-4 space-y-3 animate-fade-in mt-4">
              <div className="flex items-center gap-2 text-primary">
                <Trophy size={18} /><span className="font-display font-semibold">Resultado da simulação</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                  <div className="text-3xl font-display font-bold gradient-text">{feedback.score}/100</div>
                  <div className="text-xs text-muted-foreground uppercase mt-1">Performance</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold capitalize">{feedback.verdict === "closed" ? "🎉 Fechou" : feedback.verdict === "lost" ? "❌ Perdeu" : "⏳ Em curso"}</div>
                  <div className="text-xs text-muted-foreground uppercase mt-1">Veredito</div>
                </div>
              </div>
              <p className="text-sm">{feedback.summary}</p>
              {feedback.strengths?.length > 0 && (
                <div><div className="text-xs font-semibold text-success uppercase mb-1">Pontos fortes</div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">{feedback.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {feedback.weaknesses?.length > 0 && (
                <div><div className="text-xs font-semibold text-destructive uppercase mb-1">A melhorar</div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">{feedback.weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {feedback.improvements?.length > 0 && (
                <div><div className="text-xs font-semibold text-primary uppercase mb-1">Sugestões</div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">{feedback.improvements.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              <Button onClick={() => { setActive(null); setCreating(true); }} variant="outline" className="w-full"><RotateCcw size={14} className="mr-1" />Nova simulação</Button>
            </Card>
          )}
        </div>

        {active && active.status === "active" && !feedback && (
          <div className="border-t border-border p-3 glass safe-bottom">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Sua resposta para o cliente..."
                className="min-h-[44px] max-h-32 resize-none"
              />
              <Button onClick={send} disabled={!input.trim() || busy} className="gradient-bg shrink-0"><Send size={16} /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
