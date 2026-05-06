import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2, Trash, RotateCcw, Calendar } from "lucide-react";

const STAGES = [
  { id: "new", label: "Novo" },
  { id: "qualification", label: "Qualificação" },
  { id: "proposal", label: "Proposta" },
  { id: "negotiation", label: "Negociação" },
  { id: "closed_won", label: "Ganho" },
  { id: "closed_lost", label: "Perdido" },
];

export function CRM() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [trash, setTrash] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [timeline, setTimeline] = useState<any[]>([]);
  const empty = { name: "", company: "", email: "", phone: "", value: "", stage: "new", score: 50, source: "", product: "", birthday: "" };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // Seed default reminder rules once per user
    const { data: existing } = await supabase.from("reminder_rules").select("id").eq("user_id", user.id).limit(1);
    if (!existing || existing.length === 0) {
      await supabase.from("reminder_rules").insert([
        { user_id: user.id, name: "Inatividade 24h", trigger_type: "inactivity", threshold_hours: 24, stages: ["new", "qualification"] },
        { user_id: user.id, name: "Inatividade 48h", trigger_type: "inactivity", threshold_hours: 48, stages: ["proposal", "negotiation"] },
        { user_id: user.id, name: "Inatividade 7 dias", trigger_type: "inactivity", threshold_hours: 168, stages: [] },
      ]);
    }
    const { data } = await supabase.from("leads").select("*").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false });
    setLeads(data ?? []);
    setLoading(false);
  };
  const loadTrash = async () => {
    if (!user) return;
    const { data } = await supabase.from("leads").select("*").eq("user_id", user.id).not("deleted_at", "is", null).order("deleted_at", { ascending: false });
    setTrash(data ?? []);
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => { if (trashOpen) loadTrash(); }, [trashOpen]);

  const save = async () => {
    if (!user || !form.name) return toast.error("Nome obrigatório");
    const payload: any = { ...form, value: Number(form.value) || 0, score: Number(form.score) || 0, user_id: user.id };
    if (!payload.birthday) payload.birthday = null;
    if (editing) {
      const { error } = await supabase.from("leads").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Lead atualizado");
    } else {
      const { error } = await supabase.from("leads").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Lead criado");
    }
    setOpen(false); setEditing(null); setForm(empty); load();
  };

  const softDelete = async (id: string) => {
    const { error } = await supabase.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Movido para a lixeira");
    setConfirmDel(null);
    load();
  };

  const restore = async (id: string) => {
    await supabase.from("leads").update({ deleted_at: null, deleted_reason: null }).eq("id", id);
    toast.success("Restaurado");
    loadTrash(); load();
  };

  const purge = async (id: string) => {
    if (!confirm("Excluir permanentemente?")) return;
    await supabase.from("leads").delete().eq("id", id);
    loadTrash();
  };

  const edit = async (l: any) => {
    setEditing(l);
    setForm({ ...l, value: l.value?.toString() ?? "", score: l.score ?? 50, birthday: l.birthday ?? "" });
    setOpen(true);
    const { data } = await supabase.from("lead_events").select("*").eq("lead_id", l.id).order("occurred_at", { ascending: false }).limit(100);
    setTimeline(data || []);
  };

  const newOne = () => { setEditing(null); setForm(empty); setTimeline([]); setOpen(true); };

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (search && !`${l.name} ${l.company} ${l.email} ${l.phone}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (monthFilter !== "all") {
        const d = new Date(l.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key !== monthFilter) return false;
      }
      return true;
    });
  }, [leads, search, monthFilter]);

  const months = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const d = new Date(l.created_at);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(set).sort().reverse();
  }, [leads]);

  if (loading) return <div className="grid place-items-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold gradient-text">CRM Leads</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {leads.length} {leads.length === 1 ? "lead" : "leads"}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-40" />
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-40"><Calendar size={14} className="mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setTrashOpen(true)}><Trash size={16} />Lixeira</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={newOne} className="gradient-bg shadow-glow"><Plus size={16} />Novo lead</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} lead</DialogTitle></DialogHeader>
              <Tabs defaultValue="data">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="data">Dados</TabsTrigger>
                  <TabsTrigger value="timeline" disabled={!editing}>Timeline</TabsTrigger>
                </TabsList>
                <TabsContent value="data" className="space-y-3">
                  <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Empresa</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                    <div><Label>Produto</Label><Input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Valor (R$)</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
                    <div><Label>Score (0-100)</Label><Input type="number" min={0} max={100} value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Estágio</Label>
                      <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Origem</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Aniversário</Label><Input type="date" value={form.birthday || ""} onChange={(e) => setForm({ ...form, birthday: e.target.value })} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={save} className="flex-1 gradient-bg">Salvar</Button>
                    {editing && <Button variant="destructive" onClick={() => setConfirmDel(editing)}><Trash2 size={14} /></Button>}
                  </div>
                </TabsContent>
                <TabsContent value="timeline" className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {timeline.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Sem eventos.</div>}
                  {timeline.map((ev) => (
                    <Card key={ev.id} className="p-2 text-xs space-y-0.5">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{ev.title}</span>
                        <span className="text-muted-foreground">{new Date(ev.occurred_at).toLocaleString()}</span>
                      </div>
                      {ev.description && <div className="text-muted-foreground">{ev.description}</div>}
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban (desktop) */}
      <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-3">
        {STAGES.map((s) => (
          <div key={s.id} className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">{s.label}</div>
            {filtered.filter((l) => l.stage === s.id).map((l) => (
              <Card key={l.id} className="glass p-3 border-border space-y-1 cursor-pointer hover:border-primary/50" onClick={() => edit(l)}>
                <div className="font-semibold text-sm truncate">{l.name}</div>
                <div className="text-xs text-muted-foreground truncate">{l.company}</div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`px-2 py-0.5 rounded-full ${l.score >= 70 ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"}`}>🔥 {l.score}</span>
                  <span className="text-success font-semibold">R$ {Number(l.value || 0).toLocaleString("pt-BR")}</span>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>

      <div className="md:hidden space-y-2">
        {filtered.map((l) => (
          <Card key={l.id} className="glass p-3 border-border">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1" onClick={() => edit(l)}>
                <div className="font-semibold truncate">{l.name}</div>
                <div className="text-xs text-muted-foreground truncate">{l.company} · {STAGES.find((s) => s.id === l.stage)?.label}</div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className={`px-2 py-0.5 rounded-full ${l.score >= 70 ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"}`}>🔥 {l.score}</span>
                  <span className="text-success">R$ {Number(l.value || 0).toLocaleString("pt-BR")}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => edit(l)}><Pencil size={14} /></Button>
                <Button size="icon" variant="ghost" onClick={() => setConfirmDel(l)}><Trash2 size={14} className="text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {!filtered.length && <div className="text-center text-muted-foreground py-8 text-sm">Nenhum lead.</div>}
      </div>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover lead para a lixeira?</AlertDialogTitle>
            <AlertDialogDescription>
              O lead "{confirmDel?.name}" será arquivado. Você pode restaurá-lo a qualquer momento na lixeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && softDelete(confirmDel.id)}>Mover para lixeira</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={trashOpen} onOpenChange={setTrashOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Lixeira ({trash.length})</SheetTitle></SheetHeader>
          <div className="space-y-2 mt-4">
            {trash.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Lixeira vazia.</div>}
            {trash.map((l) => (
              <Card key={l.id} className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{l.name}</div>
                  <div className="text-[11px] text-muted-foreground">Excluído {new Date(l.deleted_at).toLocaleString()}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => restore(l.id)} title="Restaurar"><RotateCcw size={14} /></Button>
                <Button size="icon" variant="ghost" onClick={() => purge(l.id)} title="Excluir definitivamente"><Trash2 size={14} className="text-destructive" /></Button>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
