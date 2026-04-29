import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { callIrisAI, AIContext, fileToAttachment } from "@/lib/ai";
import { Send, Loader2, Sparkles, Brain, Target, AlertCircle, ChevronRight, Settings2, Paperclip, UserPlus, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg { id?: string; role: "client" | "seller" | "ai"; content: string; created_at?: string; }

const OBJECTIVE_PRESETS = [
  "Convencer o cliente a fechar hoje",
  "Cliente desconfiado — gerar autoridade",
  "Cliente sensível a preço — vender valor",
  "Marcar reunião presencial",
  "Cliente racional — usar dados/ROI",
  "Criar urgência",
  "Cliente já recebeu proposta anterior",
  "Reativar lead frio",
];

export function Copilot() {
  const { user } = useAuth();
  const [negotiations, setNegotiations] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sender, setSender] = useState<"client" | "seller">("client");
  const [busy, setBusy] = useState(false);
  const [aiPanel, setAiPanel] = useState<any>(null);
  const [ctx, setCtx] = useState<AIContext>({ stage: "qualification", methodology: "spin", tone: 50, aggressiveness: 40, objective: "" });
  const [creating, setCreating] = useState(false);
  const [newNeg, setNewNeg] = useState({ client_name: "", company: "", product: "", value: "", objective: "" });
  const [importing, setImporting] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("negotiations").select("*").eq("user_id", user.id).order("last_activity", { ascending: false })
      .then(({ data }) => {
        setNegotiations(data ?? []);
        if (data?.length && !activeId) setActiveId(data[0].id);
      });
    supabase.from("ai_settings").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setCtx((c) => ({ ...c, tone: data.tone ?? 50, aggressiveness: data.aggressiveness ?? 40, methodology: data.methodology ?? "spin" }));
      });
  }, [user]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const neg = negotiations.find((n) => n.id === activeId);
    if (neg) setCtx((c) => ({ ...c, product: neg.product, stage: neg.stage, clientProfile: neg.company, objective: neg.objective || "" }));
    supabase.from("negotiation_messages").select("*").eq("negotiation_id", activeId).order("created_at")
      .then(({ data }) => setMessages((data as Msg[]) ?? []));
  }, [activeId, negotiations]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, aiPanel]);

  const createNegotiation = async () => {
    if (!user || !newNeg.client_name) return toast.error("Informe o nome do cliente");
    const { data, error } = await supabase.from("negotiations").insert({
      user_id: user.id, client_name: newNeg.client_name, company: newNeg.company,
      product: newNeg.product, value: Number(newNeg.value) || 0, stage: "qualification",
      objective: newNeg.objective,
    }).select().single();
    if (error) return toast.error(error.message);
    setNegotiations((p) => [data, ...p]);
    setActiveId(data.id);
    setCreating(false);
    setNewNeg({ client_name: "", company: "", product: "", value: "", objective: "" });
    toast.success("Negociação criada");
  };

  const updateObjective = async (objective: string) => {
    if (!activeId) return;
    setCtx((c) => ({ ...c, objective }));
    await supabase.from("negotiations").update({ objective }).eq("id", activeId);
    setNegotiations((p) => p.map((n) => n.id === activeId ? { ...n, objective } : n));
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeId) return;
    const { data, error } = await supabase.from("negotiation_messages")
      .insert({ negotiation_id: activeId, role: sender, content: input }).select().single();
    if (error) return toast.error(error.message);
    setMessages((p) => [...p, data as Msg]);
    setInput("");
    await supabase.from("negotiations").update({ last_activity: new Date().toISOString() }).eq("id", activeId);
    if (sender === "client") askAI("suggest_reply", input);
  };

  const askAI = async (action: "suggest_reply" | "break_objection" | "analyze", message?: string) => {
    if (!activeId) return;
    setBusy(true);
    setAiPanel({ loading: true, action });
    try {
      const result = await callIrisAI({
        action, context: ctx,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
        message, objection: action === "break_objection" ? message : undefined,
      });
      setAiPanel({ ...result, action });
      if (action === "analyze") {
        await supabase.from("negotiations").update({
          sentiment: result.sentiment, lead_score: result.lead_score,
          closing_probability: result.closing_probability,
          objections: result.objections ?? [], strategies: result.strategies ?? [],
        }).eq("id", activeId);
      } else if (action === "suggest_reply") {
        await supabase.from("negotiations").update({
          closing_probability: result.closing_probability, sentiment: result.sentiment,
        }).eq("id", activeId);
      }
    } catch (e: any) {
      toast.error(e.message);
      setAiPanel(null);
    } finally { setBusy(false); }
  };

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || !files.length || !activeId || !user) return;
    setImporting(true);
    try {
      const attachments = await Promise.all(Array.from(files).slice(0, 6).map(fileToAttachment));
      // Upload originals to storage (best-effort, ignore errors)
      for (const f of Array.from(files).slice(0, 6)) {
        const path = `${user.id}/${activeId}/${Date.now()}-${f.name}`;
        await supabase.storage.from("conversation-imports").upload(path, f).catch(() => null);
      }
      const result = await callIrisAI({ action: "import_conversation", context: ctx, attachments });
      const imported: { role: "client" | "seller"; content: string }[] = result.messages || [];
      if (!imported.length) { toast.error("Nenhuma mensagem detectada"); return; }
      const rows = imported.map((m) => ({ negotiation_id: activeId, role: m.role, content: m.content }));
      const { data: inserted } = await supabase.from("negotiation_messages").insert(rows).select();
      setMessages((p) => [...p, ...((inserted as Msg[]) || [])]);
      toast.success(`${imported.length} mensagens importadas`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveAsLead = async () => {
    const active = negotiations.find((n) => n.id === activeId);
    if (!active || !user) return;
    setSavingLead(true);
    try {
      const result = await callIrisAI({
        action: "lead_from_negotiation", negotiation: active,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const payload = {
        user_id: user.id,
        name: result.name || active.client_name,
        company: result.company || active.company || "",
        email: result.email || "",
        phone: result.phone || "",
        product: result.product || active.product || "",
        value: Number(result.value) || Number(active.value) || 0,
        score: Number(result.score) || active.lead_score || 50,
        stage: result.stage || "qualification",
        source: result.source || "Negociação IrisIA",
      };
      const { error } = await supabase.from("leads").insert(payload);
      if (error) throw error;
      toast.success("Lead criado no CRM");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSavingLead(false); }
  };

  const useReply = (text: string) => { setInput(text); setSender("seller"); };
  const active = negotiations.find((n) => n.id === activeId);

  return (
    <div className="flex h-full overflow-hidden">
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
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => askAI("analyze")} disabled={busy}><Brain size={14} className="mr-1" />Analisar</Button>
              <Button size="sm" variant="ghost" onClick={saveAsLead} disabled={savingLead} title="Salvar no CRM">
                {savingLead ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              </Button>
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
            <Input placeholder="🎯 Objetivo da interação (ex: cliente sensível a preço)" value={newNeg.objective} onChange={(e) => setNewNeg({ ...newNeg, objective: e.target.value })} />
            <div className="flex gap-2">
              <Button onClick={createNegotiation} className="gradient-bg">Criar</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Objetivo da interação inline */}
        {active && (
          <div className="px-3 md:px-4 py-2 border-b border-border bg-secondary/30 flex items-center gap-2">
            <Crosshair size={14} className="text-primary shrink-0" />
            <Input
              value={ctx.objective || ""}
              onChange={(e) => setCtx((c) => ({ ...c, objective: e.target.value }))}
              onBlur={(e) => updateObjective(e.target.value)}
              list="objective-presets"
              placeholder="Objetivo da interação (a IA usa isto em todas as respostas)"
              className="h-8 text-xs bg-background/60 border-border/50"
            />
            <datalist id="objective-presets">
              {OBJECTIVE_PRESETS.map((p) => <option key={p} value={p} />)}
            </datalist>
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
              <div className={cn("rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
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
                  <div className="text-sm bg-secondary/50 rounded-lg p-3 whitespace-pre-wrap">{aiPanel.reply}</div>
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
                      <div className="text-sm mt-1 whitespace-pre-wrap">{r.script}</div>
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
                <SelectTrigger className="w-24 shrink-0"><SelectValue /></SelectTrigger>
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
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Paperclip size={12} className="mr-1" />}
                Importar conversa
              </Button>
              <input ref={fileRef} type="file" multiple accept=".txt,.opus,.ogg,.mp3,.m4a,.wav,.jpg,.jpeg,.png,.webp,image/*,audio/*,text/plain" hidden onChange={(e) => handleImportFiles(e.target.files)} />
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
