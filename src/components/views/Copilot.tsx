import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { callIrisAI, AIContext } from "@/lib/ai";
import { Send, Loader2, Sparkles, Brain, Target, AlertCircle, ChevronRight, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg { id?: string; role: "client" | "seller" | "ai"; content: string; created_at?: string; }

export function Copilot() {
  const { user } = useAuth();
  const [negotiations, setNegotiations] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sender, setSender] = useState<"client" | "seller">("client");
  const [busy, setBusy] = useState(false);
  const [aiPanel, setAiPanel] = useState<any>(null);
  const [ctx, setCtx] = useState<AIContext>({ stage: "qualification", methodology: "spin", tone: 50, aggressiveness: 40 });
  const [creating, setCreating] = useState(false);
  const [newNeg, setNewNeg] = useState({ client_name: "", company: "", product: "", value: "" });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load negotiations
  useEffect(() => {
    if (!user) return;
    supabase.from("negotiations").select("*").eq("user_id", user.id).order("last_activity", { ascending: false })
      .then(({ data }) => {
        setNegotiations(data ?? []);
        if (data?.length && !activeId) setActiveId(data[0].id);
      });
    // Load AI settings
    supabase.from("ai_settings").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setCtx((c) => ({ ...c, tone: data.tone ?? 50, aggressiveness: data.aggressiveness ?? 40, methodology: data.methodology ?? "spin" }));
      });
  }, [user]);

  // Load messages of active
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const neg = negotiations.find((n) => n.id === activeId);
    if (neg) setCtx((c) => ({ ...c, product: neg.product, stage: neg.stage, clientProfile: neg.company }));
    supabase.from("negotiation_messages").select("*").eq("negotiation_id", activeId).order("created_at")
      .then(({ data }) => setMessages((data as Msg[]) ?? []));
  }, [activeId, negotiations]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, aiPanel]);

  const createNegotiation = async () => {
    if (!user || !newNeg.client_name) return toast.error("Informe o nome do cliente");
    const { data, error } = await supabase.from("negotiations").insert({
      user_id: user.id,
      client_name: newNeg.client_name,
      company: newNeg.company,
      product: newNeg.product,
      value: Number(newNeg.value) || 0,
      stage: "qualification",
    }).select().single();
    if (error) return toast.error(error.message);
    setNegotiations((p) => [data, ...p]);
    setActiveId(data.id);
    setCreating(false);
    setNewNeg({ client_name: "", company: "", product: "", value: "" });
    toast.success("Negociação criada");
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeId) return;
    const msg: Msg = { role: sender, content: input };
    const { data, error } = await supabase.from("negotiation_messages")
      .insert({ negotiation_id: activeId, role: sender, content: input }).select().single();
    if (error) return toast.error(error.message);
    setMessages((p) => [...p, data as Msg]);
    setInput("");
    await supabase.from("negotiations").update({ last_activity: new Date().toISOString() }).eq("id", activeId);

    // Auto-suggest if last was client
    if (sender === "client") {
      askAI("suggest_reply", input);
    }
  };

  const askAI = async (action: "suggest_reply" | "break_objection" | "analyze", message?: string) => {
    if (!activeId) return;
    setBusy(true);
    setAiPanel({ loading: true, action });
    try {
      const result = await callIrisAI({
        action,
        context: ctx,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
        message,
        objection: action === "break_objection" ? message : undefined,
      });
      setAiPanel({ ...result, action });

      // Persist analysis to negotiation
      if (action === "analyze") {
        await supabase.from("negotiations").update({
          sentiment: result.sentiment,
          lead_score: result.lead_score,
          closing_probability: result.closing_probability,
          objections: result.objections ?? [],
          strategies: result.strategies ?? [],
        }).eq("id", activeId);
      } else if (action === "suggest_reply") {
        await supabase.from("negotiations").update({
          closing_probability: result.closing_probability,
          sentiment: result.sentiment,
        }).eq("id", activeId);
      }
    } catch (e: any) {
      toast.error(e.message);
      setAiPanel(null);
    } finally {
      setBusy(false);
    }
  };

  const useReply = (text: string) => {
    setInput(text);
    setSender("seller");
  };

  const active = negotiations.find((n) => n.id === activeId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Negotiations list - hidden on mobile, shown via sheet */}
      <aside className="hidden lg:flex w-72 shrink-0 border-r border-border flex-col">
        <div className="p-3 border-b border-border">
          <Button onClick={() => setCreating(true)} className="w-full gradient-bg shadow-glow">+ Nova negociação</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {negotiations.map((n) => (
            <button key={n.id} onClick={() => setActiveId(n.id)}
              className={cn("w-full text-left p-3 rounded-lg transition-colors", activeId === n.id ? "bg-gradient-soft border border-border" : "hover:bg-secondary")}>
              <div className="font-semibold text-sm truncate">{n.client_name}</div>
              <div className="text-xs text-muted-foreground truncate">{n.company || n.product}</div>
              <div className="flex items-center gap-2 mt-2 text-[10px]">
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary">{n.closing_probability ?? 0}%</span>
                <span className="text-muted-foreground">{n.stage}</span>
              </div>
            </button>
          ))}
          {!negotiations.length && <div className="text-xs text-muted-foreground p-4 text-center">Nenhuma negociação ainda</div>}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-4 py-3 border-b border-border glass flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden"><Settings2 size={16} /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 flex flex-col">
                <div className="p-3 border-b border-border">
                  <Button onClick={() => setCreating(true)} className="w-full gradient-bg shadow-glow">+ Nova negociação</Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {negotiations.map((n) => (
                    <button key={n.id} onClick={() => setActiveId(n.id)}
                      className={cn("w-full text-left p-3 rounded-lg", activeId === n.id ? "bg-gradient-soft border border-border" : "hover:bg-secondary")}>
                      <div className="font-semibold text-sm truncate">{n.client_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{n.company || n.product}</div>
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <div className="font-display font-semibold truncate">{active?.client_name ?? "Selecione uma negociação"}</div>
              <div className="text-xs text-muted-foreground truncate">{active?.company}</div>
            </div>
          </div>
          {active && (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => askAI("analyze")} disabled={busy}><Brain size={14} className="mr-1" />Analisar</Button>
            </div>
          )}
        </header>

        {creating && (
          <div className="p-4 border-b border-border glass space-y-2 animate-fade-in">
            <h3 className="font-semibold">Nova negociação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input placeholder="Nome do cliente *" value={newNeg.client_name} onChange={(e) => setNewNeg({ ...newNeg, client_name: e.target.value })} />
              <Input placeholder="Empresa" value={newNeg.company} onChange={(e) => setNewNeg({ ...newNeg, company: e.target.value })} />
              <Input placeholder="Produto/serviço" value={newNeg.product} onChange={(e) => setNewNeg({ ...newNeg, product: e.target.value })} />
              <Input placeholder="Valor (R$)" type="number" value={newNeg.value} onChange={(e) => setNewNeg({ ...newNeg, value: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={createNegotiation} className="gradient-bg">Criar</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
          {!active && !creating && (
            <div className="h-full grid place-items-center text-center p-6">
              <div className="space-y-3">
                <Sparkles className="mx-auto text-primary" size={48} />
                <h2 className="font-display text-xl">Comece sua primeira negociação</h2>
                <Button onClick={() => setCreating(true)} className="gradient-bg shadow-glow">+ Nova negociação</Button>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2 max-w-[85%] md:max-w-[70%] animate-fade-in", m.role === "seller" ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn("w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold shrink-0",
                m.role === "client" ? "bg-secondary" : m.role === "seller" ? "gradient-bg text-white" : "bg-accent text-accent-foreground")}>
                {m.role === "client" ? "C" : m.role === "seller" ? "V" : "AI"}
              </div>
              <div className={cn("rounded-2xl px-3 py-2 text-sm",
                m.role === "seller" ? "gradient-bg text-white" : "glass")}>
                {m.content}
              </div>
            </div>
          ))}

          {aiPanel && (
            <Card className="glass-strong border-primary/40 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles size={16} /><span className="font-display font-semibold">IrisIA sugere</span>
                {aiPanel.loading && <Loader2 className="animate-spin" size={14} />}
              </div>
              {aiPanel.loading && <div className="text-sm text-muted-foreground">Analisando contexto...</div>}

              {aiPanel.reply && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Resposta sugerida</div>
                  <div className="text-sm bg-secondary/50 rounded-lg p-3">{aiPanel.reply}</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button size="sm" onClick={() => useReply(aiPanel.reply)} className="gradient-bg">Usar resposta</Button>
                    <span className="text-xs text-muted-foreground self-center">🎯 {aiPanel.technique}</span>
                  </div>
                </div>
              )}

              {aiPanel.responses && (
                <div className="space-y-2">
                  <div className="text-sm">{aiPanel.diagnosis}</div>
                  {aiPanel.responses.map((r: any, i: number) => (
                    <div key={i} className="bg-secondary/50 rounded-lg p-3">
                      <div className="text-xs font-semibold text-primary">{r.angle}</div>
                      <div className="text-sm mt-1">{r.script}</div>
                      <Button size="sm" variant="ghost" onClick={() => useReply(r.script)} className="mt-1">Usar</Button>
                    </div>
                  ))}
                </div>
              )}

              {aiPanel.summary && (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Score" value={`${aiPanel.lead_score}/100`} icon={Target} />
                    <Stat label="Fechamento" value={`${aiPanel.closing_probability}%`} icon={ChevronRight} />
                    <Stat label="Sentimento" value={aiPanel.sentiment} icon={Brain} />
                  </div>
                  <div><strong>Diagnóstico:</strong> {aiPanel.summary}</div>
                  {aiPanel.objections?.length > 0 && (
                    <div><strong>Objeções:</strong>
                      <ul className="list-disc list-inside text-muted-foreground">{aiPanel.objections.map((o: string, i: number) => <li key={i}>{o}</li>)}</ul>
                    </div>
                  )}
                  {aiPanel.next_steps?.length > 0 && (
                    <div><strong>Próximos passos:</strong>
                      <ul className="list-disc list-inside text-muted-foreground">{aiPanel.next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        {active && (
          <div className="border-t border-border p-3 glass safe-bottom space-y-2">
            <div className="flex gap-2">
              <Select value={sender} onValueChange={(v) => setSender(v as any)}>
                <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="seller">Eu</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Cole a mensagem do cliente ou digite sua resposta..."
                className="min-h-[44px] max-h-32 resize-none"
              />
              <Button onClick={sendMessage} disabled={!input.trim()} className="gradient-bg shrink-0"><Send size={16} /></Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => askAI("suggest_reply", input || messages[messages.length - 1]?.content)} disabled={busy || !messages.length}>
                <Sparkles size={12} className="mr-1" />Sugerir resposta
              </Button>
              <Button size="sm" variant="outline" onClick={() => askAI("break_objection", input)} disabled={busy || !input.trim()}>
                <AlertCircle size={12} className="mr-1" />Quebrar objeção
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-2 text-center">
      <Icon className="mx-auto text-primary mb-1" size={14} />
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-semibold capitalize">{value}</div>
    </div>
  );
}
