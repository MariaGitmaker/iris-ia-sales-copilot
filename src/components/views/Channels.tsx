import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Copy, Plus, Send, ThumbsUp, ThumbsDown, Trash2, UserCheck, Bot, RefreshCw } from "lucide-react";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function Channels() {
  const { user } = useAuth();
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Canais & Bot</h1>
        <p className="text-muted-foreground text-sm">WhatsApp, configuração da IA, conversas em tempo real e base de conhecimento.</p>
      </header>

      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="conversations">Conversas</TabsTrigger>
          <TabsTrigger value="bot">Bot</TabsTrigger>
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="knowledge">Conhecimento</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations"><Conversations /></TabsContent>
        <TabsContent value="bot"><BotSettings userId={user?.id || ""} /></TabsContent>
        <TabsContent value="channels"><ChannelsList userId={user?.id || ""} /></TabsContent>
        <TabsContent value="knowledge"><Knowledge userId={user?.id || ""} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Channels ---------------- */
function ChannelsList({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone_number_id: "",
    business_account_id: "",
    display_phone: "",
    access_token: "",
  });
  const [verifyToken] = useState(() => randomToken());

  async function load() {
    const { data } = await supabase.from("channels").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.phone_number_id || !form.access_token) {
      toast({ title: "Campos obrigatórios", description: "Phone Number ID e Access Token." });
      return;
    }
    const { error } = await supabase.from("channels").insert({
      user_id: userId,
      type: "whatsapp_cloud",
      name: form.name || "WhatsApp",
      phone_number_id: form.phone_number_id.trim(),
      business_account_id: form.business_account_id.trim(),
      display_phone: form.display_phone.trim(),
      access_token: form.access_token.trim(),
      webhook_verify_token: verifyToken,
      status: "active",
    });
    if (error) { toast({ title: "Erro", description: error.message }); return; }
    toast({ title: "Canal criado", description: "Configure o webhook no Meta com a URL e token mostrados." });
    setCreating(false);
    setForm({ name: "", phone_number_id: "", business_account_id: "", display_phone: "", access_token: "" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remover canal?")) return;
    await supabase.from("channels").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Conecte uma conta do WhatsApp Cloud API (Meta) para começar.</p>
        <Button onClick={() => setCreating((s) => !s)}><Plus size={16} /> Novo canal</Button>
      </div>

      {creating && (
        <Card className="p-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="WhatsApp Vendas" /></div>
            <div><Label>Telefone exibido</Label><Input value={form.display_phone} onChange={(e) => setForm({ ...form, display_phone: e.target.value })} placeholder="+55 11 9..." /></div>
            <div><Label>Phone Number ID *</Label><Input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} placeholder="1234567890" /></div>
            <div><Label>WhatsApp Business Account ID</Label><Input value={form.business_account_id} onChange={(e) => setForm({ ...form, business_account_id: e.target.value })} placeholder="WABA ID" /></div>
            <div className="md:col-span-2"><Label>Permanent Access Token *</Label><Input value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder="EAAG..." /></div>
          </div>
          <div className="rounded-lg border border-border p-3 bg-secondary/40 text-xs space-y-2">
            <div className="font-semibold">Configure no Meta App → WhatsApp → Configuration → Webhook:</div>
            <Row label="Callback URL" value={WEBHOOK_URL} />
            <Row label="Verify Token" value={verifyToken} />
            <div className="text-muted-foreground">Inscreva o campo <b>messages</b>. Após salvar, mensagens recebidas chegarão automaticamente.</div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={create}>Criar canal</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {items.map((c) => (
          <Card key={c.id} className="p-4 flex items-start gap-4 justify-between flex-wrap">
            <div className="space-y-1">
              <div className="font-semibold">{c.name} <Badge variant="secondary" className="ml-2">{c.type}</Badge> <Badge className="ml-1">{c.status}</Badge></div>
              <div className="text-xs text-muted-foreground">{c.display_phone || c.phone_number_id}</div>
              <div className="text-xs space-y-1 mt-2">
                <Row label="Webhook URL" value={WEBHOOK_URL} />
                <Row label="Verify Token" value={c.webhook_verify_token} />
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 size={16} /></Button>
          </Card>
        ))}
        {items.length === 0 && !creating && (
          <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum canal conectado.</Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-32 shrink-0">{label}:</span>
      <code className="bg-background px-2 py-1 rounded text-[11px] break-all flex-1">{value}</code>
      <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(value); toast({ title: "Copiado" }); }}><Copy size={14} /></Button>
    </div>
  );
}

/* ---------------- Bot Settings ---------------- */
function BotSettings({ userId }: { userId: string }) {
  const [s, setS] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("bot_settings").select("*").eq("user_id", userId).maybeSingle();
    if (data) setS(data);
    else {
      const { data: created } = await supabase
        .from("bot_settings")
        .insert({ user_id: userId })
        .select("*")
        .single();
      setS(created);
    }
  }
  useEffect(() => { if (userId) load(); }, [userId]);

  async function save() {
    if (!s) return;
    setSaving(true);
    const { id, user_id, created_at, updated_at, ...rest } = s;
    const { error } = await supabase.from("bot_settings").update(rest).eq("id", id);
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message });
    else toast({ title: "Configurações salvas" });
  }

  if (!s) return <div className="text-sm text-muted-foreground p-4">Carregando...</div>;
  const bh = s.business_hours || {};

  return (
    <Card className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Bot ativo</div>
          <div className="text-xs text-muted-foreground">Quando desligado, nenhuma mensagem é respondida automaticamente.</div>
        </div>
        <Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} />
      </div>

      <div>
        <Label>Objetivo da negociação</Label>
        <Textarea rows={2} value={s.objective} onChange={(e) => setS({ ...s, objective: e.target.value })} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Produto/serviço</Label><Input value={s.product} onChange={(e) => setS({ ...s, product: e.target.value })} /></div>
        <div><Label>Público-alvo</Label><Input value={s.audience} onChange={(e) => setS({ ...s, audience: e.target.value })} /></div>
      </div>
      <div>
        <Label>Regras (livre)</Label>
        <Textarea rows={3} value={s.rules} onChange={(e) => setS({ ...s, rules: e.target.value })} placeholder="Ex: Não falar de preço antes do diagnóstico. Sempre oferecer demonstração." />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Tom ({s.tone}) — consultivo ↔ executivo</Label>
          <Slider value={[s.tone]} onValueChange={(v) => setS({ ...s, tone: v[0] })} max={100} step={5} />
        </div>
        <div>
          <Label>Agressividade ({s.aggressiveness}) — passivo ↔ closer</Label>
          <Slider value={[s.aggressiveness]} onValueChange={(v) => setS({ ...s, aggressiveness: v[0] })} max={100} step={5} />
        </div>
      </div>

      <div>
        <Label>Metodologia</Label>
        <Select value={s.methodology} onValueChange={(v) => setS({ ...s, methodology: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="spin">SPIN Selling</SelectItem>
            <SelectItem value="sandler">Sandler</SelectItem>
            <SelectItem value="challenger">Challenger</SelectItem>
            <SelectItem value="straight_line">Straight Line</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Mensagem de boas-vindas</Label><Textarea rows={2} value={s.greeting} onChange={(e) => setS({ ...s, greeting: e.target.value })} /></div>
        <div><Label>Mensagem de fallback (handoff)</Label><Textarea rows={2} value={s.fallback_message} onChange={(e) => setS({ ...s, fallback_message: e.target.value })} /></div>
      </div>

      <div>
        <Label>Palavras-chave para handoff (separadas por vírgula)</Label>
        <Input
          value={(s.handoff_keywords || []).join(", ")}
          onChange={(e) => setS({ ...s, handoff_keywords: e.target.value.split(",").map((x: string) => x.trim()).filter(Boolean) })}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <div>
          <div className="font-semibold text-sm">CRM automático</div>
          <div className="text-xs text-muted-foreground">Cria lead e negociação ao receber a 1ª mensagem.</div>
        </div>
        <Switch checked={s.auto_crm} onCheckedChange={(v) => setS({ ...s, auto_crm: v })} />
      </div>

      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">Horário comercial</div>
          <Switch checked={!!bh.enabled} onCheckedChange={(v) => setS({ ...s, business_hours: { ...bh, enabled: v } })} />
        </div>
        {bh.enabled && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><Label className="text-xs">Início</Label><Input value={bh.start || "08:00"} onChange={(e) => setS({ ...s, business_hours: { ...bh, start: e.target.value } })} /></div>
            <div><Label className="text-xs">Fim</Label><Input value={bh.end || "20:00"} onChange={(e) => setS({ ...s, business_hours: { ...bh, end: e.target.value } })} /></div>
            <div className="col-span-2"><Label className="text-xs">Timezone</Label><Input value={bh.tz || "America/Sao_Paulo"} onChange={(e) => setS({ ...s, business_hours: { ...bh, tz: e.target.value } })} /></div>
          </div>
        )}
      </div>

      <Button onClick={save} disabled={saving} className="w-full md:w-auto">{saving ? "Salvando..." : "Salvar configurações"}</Button>
    </Card>
  );
}

/* ---------------- Knowledge ---------------- */
function Knowledge({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ kind: "faq", question: "", answer: "" });

  async function load() {
    const { data } = await supabase.from("bot_knowledge").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.question || !form.answer) return;
    await supabase.from("bot_knowledge").insert({ user_id: userId, ...form });
    setForm({ kind: "faq", question: "", answer: "" });
    load();
  }
  async function toggle(id: string, active: boolean) {
    await supabase.from("bot_knowledge").update({ active }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    await supabase.from("bot_knowledge").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="font-semibold">Adicionar entrada</div>
        <div className="grid md:grid-cols-4 gap-2">
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="faq">FAQ</SelectItem>
              <SelectItem value="objection">Objeção</SelectItem>
              <SelectItem value="rule">Regra</SelectItem>
              <SelectItem value="example">Exemplo</SelectItem>
            </SelectContent>
          </Select>
          <Input className="md:col-span-3" placeholder="Pergunta / situação" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
          <Textarea className="md:col-span-4" rows={2} placeholder="Resposta ideal" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        </div>
        <Button onClick={add} className="w-full md:w-auto"><Plus size={16} /> Adicionar</Button>
      </Card>

      <div className="grid gap-2">
        {items.map((k) => (
          <Card key={k.id} className="p-3 flex items-start gap-3">
            <Badge variant="secondary" className="shrink-0">{k.kind}</Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{k.question}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{k.answer}</div>
              <div className="text-[10px] text-muted-foreground mt-1">rating: {k.rating} · fonte: {k.source}</div>
            </div>
            <Switch checked={k.active} onCheckedChange={(v) => toggle(k.id, v)} />
            <Button variant="ghost" size="icon" onClick={() => remove(k.id)}><Trash2 size={14} /></Button>
          </Card>
        ))}
        {items.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">Sem entradas.</Card>}
      </div>
    </div>
  );
}

/* ---------------- Conversations (live) ---------------- */
function Conversations() {
  const [convs, setConvs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  async function load() {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(100);
    setConvs(data || []);
  }
  useEffect(() => {
    load();
    const ch = supabase
      .channel("conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-3 h-[70vh]">
      <Card className="overflow-y-auto">
        <div className="p-3 flex items-center justify-between border-b border-border">
          <div className="text-sm font-semibold">Conversas</div>
          <Button size="icon" variant="ghost" onClick={load}><RefreshCw size={14} /></Button>
        </div>
        {convs.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className={`w-full text-left p-3 border-b border-border hover:bg-secondary/40 ${selected?.id === c.id ? "bg-secondary/60" : ""}`}
          >
            <div className="flex items-center gap-2">
              <div className="font-medium text-sm truncate flex-1">{c.contact_name || c.contact_phone}</div>
              {c.bot_active ? <Bot size={14} className="text-primary" /> : <UserCheck size={14} className="text-amber-500" />}
            </div>
            <div className="text-[11px] text-muted-foreground">{new Date(c.last_message_at).toLocaleString()}</div>
          </button>
        ))}
        {convs.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Sem conversas ainda.</div>}
      </Card>
      <Card className="flex flex-col min-h-0">
        {selected ? <ConversationView conv={selected} onChange={load} /> : <div className="m-auto text-sm text-muted-foreground">Selecione uma conversa.</div>}
      </Card>
    </div>
  );
}

function ConversationView({ conv, onChange }: { conv: any; onChange: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { data } = await supabase
      .from("channel_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }
  useEffect(() => {
    load();
    const ch = supabase
      .channel(`conv-${conv.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "channel_messages", filter: `conversation_id=eq.${conv.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conv.id]);

  async function toggleBot() {
    await supabase.from("conversations").update({ bot_active: !conv.bot_active }).eq("id", conv.id);
    onChange();
  }

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase.functions.invoke("whatsapp-send", {
      body: { conversation_id: conv.id, text: text.trim() },
    });
    setSending(false);
    if (error) toast({ title: "Falha ao enviar", description: error.message });
    else { setText(""); load(); }
  }

  async function rate(mid: string, value: "up" | "down") {
    await supabase.from("channel_messages").update({ feedback: value }).eq("id", mid);
    if (value === "up") {
      // Promove para base de conhecimento como exemplo aprovado
      const idx = messages.findIndex((m) => m.id === mid);
      const botMsg = messages[idx];
      const prev = [...messages].slice(0, idx).reverse().find((m) => m.sender === "client");
      if (botMsg && prev) {
        await supabase.from("bot_knowledge").insert({
          user_id: conv.user_id,
          kind: "example",
          question: prev.content,
          answer: botMsg.content,
          source: "feedback",
          rating: 1,
        });
        toast({ title: "Adicionado à base como exemplo aprovado" });
      }
    }
    load();
  }

  return (
    <>
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">{conv.contact_name || conv.contact_phone}</div>
          <div className="text-[11px] text-muted-foreground">{conv.contact_phone}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={conv.bot_active ? "default" : "secondary"}>{conv.bot_active ? "Bot ativo" : "Humano"}</Badge>
          <Button size="sm" variant="outline" onClick={toggleBot}>
            {conv.bot_active ? "Assumir" : "Devolver ao bot"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-secondary/20">
        {messages.map((m) => {
          const mine = m.direction === "outbound";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className="text-[10px] opacity-70 mt-1 flex items-center gap-2">
                  {m.sender} · {new Date(m.created_at).toLocaleTimeString()}
                  {mine && m.sender === "bot" && (
                    <span className="flex items-center gap-1 ml-2">
                      <button onClick={() => rate(m.id, "up")} className={m.feedback === "up" ? "text-emerald-400" : ""}><ThumbsUp size={12} /></button>
                      <button onClick={() => rate(m.id, "down")} className={m.feedback === "down" ? "text-rose-400" : ""}><ThumbsDown size={12} /></button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <Input
          placeholder={conv.bot_active ? "Bot está ativo — assuma para responder" : "Digite sua mensagem..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={conv.bot_active || sending}
        />
        <Button onClick={send} disabled={conv.bot_active || sending || !text.trim()}><Send size={16} /></Button>
      </div>
    </>
  );
}
