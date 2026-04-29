import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const empty = { name: "", company: "", email: "", phone: "", value: "", stage: "new", score: 50, source: "", product: "" };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setLeads(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const save = async () => {
    if (!user || !form.name) return toast.error("Nome obrigatório");
    const payload = { ...form, value: Number(form.value) || 0, score: Number(form.score) || 0, user_id: user.id };
    if (editing) {
      const { error } = await supabase.from("leads").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Lead atualizado");
    } else {
      const { error } = await supabase.from("leads").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Lead criado");
    }
    setOpen(false);
    setEditing(null);
    setForm(empty);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este lead?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    load();
  };

  const edit = (l: any) => {
    setEditing(l);
    setForm({ ...l, value: l.value?.toString() ?? "", score: l.score ?? 50 });
    setOpen(true);
  };

  const newOne = () => { setEditing(null); setForm(empty); setOpen(true); };

  if (loading) return <div className="grid place-items-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold gradient-text">CRM Leads</h1>
          <p className="text-sm text-muted-foreground">{leads.length} {leads.length === 1 ? "lead" : "leads"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={newOne} className="gradient-bg shadow-glow"><Plus size={16} />Novo lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
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
              <Button onClick={save} className="w-full gradient-bg">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban (desktop) / list (mobile) */}
      <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-3">
        {STAGES.map((s) => (
          <div key={s.id} className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">{s.label}</div>
            {leads.filter((l) => l.stage === s.id).map((l) => (
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
        {leads.map((l) => (
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
                <Button size="icon" variant="ghost" onClick={() => remove(l.id)}><Trash2 size={14} className="text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {!leads.length && <div className="text-center text-muted-foreground py-8 text-sm">Nenhum lead. Cadastre o primeiro!</div>}
      </div>
    </div>
  );
}
