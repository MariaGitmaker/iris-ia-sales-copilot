import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Check, Clock, Sparkles, X } from "lucide-react";

const STAGES = [
  { id: "new", label: "Novo" },
  { id: "qualification", label: "Qualificação" },
  { id: "proposal", label: "Proposta" },
  { id: "negotiation", label: "Negociação" },
  { id: "closed_won", label: "Ganho" },
  { id: "closed_lost", label: "Perdido" },
];

export function RemindersCenter() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("lead_reminders")
      .select("*, leads:lead_id(id,name,company,phone,stage)")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .lte("due_at", new Date(Date.now() + 7 * 86400000).toISOString())
      .order("due_at", { ascending: true })
      .limit(50);
    setItems(data || []);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`user:${user.id}:reminders`, { config: { private: true } })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_reminders", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    const i = setInterval(load, 60_000);
    return () => { supabase.removeChannel(ch); clearInterval(i); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    await supabase.from("lead_reminders").update({ status }).eq("id", id);
    setBusyId(null);
    load();
  }

  async function moveStage(r: any, stage: string) {
    if (!r.lead_id) return;
    await supabase.from("leads").update({ stage }).eq("id", r.lead_id);
    toast.success("Estágio atualizado");
    setStatus(r.id, "done");
  }

  async function suggest(r: any) {
    if (!r.lead_id) return;
    setBusyId(r.id);
    try {
      const { data, error } = await supabase.functions.invoke("irisia-recovery-suggest", {
        body: { lead_id: r.lead_id, kind: r.kind, message: r.message },
      });
      if (error) throw error;
      setDraft((d) => ({ ...d, [r.id]: data?.message || "" }));
    } catch (e: any) {
      toast.error(e.message || "Falha ao sugerir");
    } finally {
      setBusyId(null);
    }
  }

  async function snooze(id: string, hours: number) {
    const due = new Date(Date.now() + hours * 3600000).toISOString();
    await supabase.from("lead_reminders").update({ status: "pending", due_at: due }).eq("id", id);
    toast.success(`Adiado por ${hours}h`);
    load();
  }

  const count = items.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
        title="Lembretes"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full min-w-4 h-4 px-1 grid place-items-center font-bold">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Pendências & Lembretes</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-10">Nenhuma pendência. Você está em dia!</div>
            )}
            {items.map((r) => {
              const lead = (r as any).leads;
              const overdue = new Date(r.due_at) < new Date();
              return (
                <Card key={r.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{lead?.name || "Lead"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{lead?.company}</div>
                    </div>
                    <Badge variant={overdue ? "destructive" : "secondary"} className="shrink-0">{r.kind}</Badge>
                  </div>
                  {r.message && <div className="text-xs text-muted-foreground">{r.message}</div>}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock size={11} /> {new Date(r.due_at).toLocaleString()}
                  </div>

                  {draft[r.id] !== undefined && (
                    <Textarea
                      rows={3}
                      value={draft[r.id]}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      placeholder="Sugestão da IA"
                    />
                  )}

                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => suggest(r)} disabled={busyId === r.id || !r.lead_id}>
                      <Sparkles size={12} /> IA sugerir
                    </Button>
                    {lead?.stage && (
                      <Select onValueChange={(v) => moveStage(r, v)}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Mover" /></SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => snooze(r.id, 24)}>+24h</Button>
                    <Button size="sm" variant="ghost" onClick={() => snooze(r.id, 24 * 7)}>+7d</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "done")} title="Concluído"><Check size={12} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "dismissed")} title="Dispensar"><X size={12} /></Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
