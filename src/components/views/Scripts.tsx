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
import { callIrisAI } from "@/lib/ai";
import { Plus, Sparkles, Trash2, Loader2 } from "lucide-react";

export function Scripts() {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState({ title: "", product: "", audience: "", stage: "qualification", tone: "consultivo" });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("scripts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setScripts(data ?? []);
  };

  useEffect(() => { load(); }, [user]);

  const generate = async () => {
    if (!user || !form.title || !form.product) return toast.error("Preencha título e produto");
    setBusy(true);
    try {
      const result = await callIrisAI({ action: "generate_script", scriptInput: form });
      const { error } = await supabase.from("scripts").insert({
        user_id: user.id,
        title: form.title,
        product: form.product,
        audience: form.audience,
        stage: form.stage,
        tone: form.tone,
        sections: result.sections ?? [],
      });
      if (error) throw error;
      toast.success("Script gerado");
      setOpen(false);
      setForm({ title: "", product: "", audience: "", stage: "qualification", tone: "consultivo" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir?")) return;
    await supabase.from("scripts").delete().eq("id", id);
    load();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold gradient-text">Scripts IA</h1>
          <p className="text-sm text-muted-foreground">{scripts.length} scripts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-bg shadow-glow"><Sparkles size={16} />Gerar com IA</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Gerar script com IA</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Produto/Serviço *</Label><Input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></div>
              <div><Label>Público-alvo</Label><Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Ex: PMEs do setor SaaS" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Estágio</Label>
                  <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospecção">Prospecção</SelectItem>
                      <SelectItem value="qualification">Qualificação</SelectItem>
                      <SelectItem value="proposal">Proposta</SelectItem>
                      <SelectItem value="closing">Fechamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Tom</Label>
                  <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultivo">Consultivo</SelectItem>
                      <SelectItem value="executivo">Executivo</SelectItem>
                      <SelectItem value="amigável">Amigável</SelectItem>
                      <SelectItem value="técnico">Técnico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generate} disabled={busy} className="w-full gradient-bg">
                {busy ? <Loader2 className="animate-spin" /> : <><Sparkles size={16} />Gerar</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {scripts.map((s) => (
          <Card key={s.id} className="glass p-4 border-border space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setViewing(s)}>
                <div className="font-display font-semibold truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground truncate">{s.product} · {s.tone}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 size={14} className="text-destructive" /></Button>
            </div>
            <div className="text-xs text-muted-foreground">{(s.sections as any[])?.length ?? 0} seções</div>
          </Card>
        ))}
        {!scripts.length && <div className="col-span-full text-center text-muted-foreground py-8 text-sm">Nenhum script. Gere o primeiro com IA!</div>}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {(viewing?.sections as any[])?.map((sec, i) => (
              <div key={i}>
                <h3 className="font-display font-semibold text-primary">{sec.title}</h3>
                <p className="text-sm whitespace-pre-wrap mt-1">{sec.content}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
