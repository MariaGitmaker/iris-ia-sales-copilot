import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export function SettingsView() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState({
    tone: 50,
    aggressiveness: 40,
    methodology: "spin",
    notifications: { followups: true, suggestions: true, dailySummary: false, stageChanges: true },
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("ai_settings").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setS({
          tone: data.tone ?? 50,
          aggressiveness: data.aggressiveness ?? 40,
          methodology: data.methodology ?? "spin",
          notifications: (data.notifications as any) ?? s.notifications,
        });
        setLoading(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("ai_settings").upsert({
      user_id: user.id, ...s, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configurações salvas");
  };

  if (loading) return <div className="grid place-items-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold gradient-text">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize o comportamento da IrisIA</p>
      </div>

      <Card className="glass p-5 space-y-5 border-border">
        <h2 className="font-display font-semibold">IA de negociação</h2>

        <div>
          <Label>Tom da comunicação ({s.tone < 30 ? "Consultivo" : s.tone > 70 ? "Executivo" : "Equilibrado"})</Label>
          <Slider value={[s.tone]} onValueChange={(v) => setS({ ...s, tone: v[0] })} max={100} step={5} className="mt-2" />
        </div>

        <div>
          <Label>Agressividade ({s.aggressiveness < 30 ? "Passivo" : s.aggressiveness > 70 ? "Closer" : "Equilibrado"})</Label>
          <Slider value={[s.aggressiveness]} onValueChange={(v) => setS({ ...s, aggressiveness: v[0] })} max={100} step={5} className="mt-2" />
        </div>

        <div>
          <Label>Metodologia</Label>
          <Select value={s.methodology} onValueChange={(v) => setS({ ...s, methodology: v })}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spin">SPIN Selling</SelectItem>
              <SelectItem value="sandler">Sandler</SelectItem>
              <SelectItem value="challenger">Challenger Sale</SelectItem>
              <SelectItem value="solution">Solution Selling</SelectItem>
              <SelectItem value="consultive">Consultiva</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="glass p-5 space-y-3 border-border">
        <h2 className="font-display font-semibold">Notificações</h2>
        {([
          ["suggestions", "Sugestões da IA"],
          ["followups", "Lembretes de follow-up"],
          ["stageChanges", "Mudanças de estágio"],
          ["dailySummary", "Resumo diário"],
        ] as const).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between">
            <Label htmlFor={k}>{label}</Label>
            <Switch id={k} checked={(s.notifications as any)[k]}
              onCheckedChange={(v) => setS({ ...s, notifications: { ...s.notifications, [k]: v } })} />
          </div>
        ))}
      </Card>

      <Card className="glass p-5 space-y-3 border-border">
        <h2 className="font-display font-semibold">Conta</h2>
        <div className="text-sm text-muted-foreground">{user?.email}</div>
        <Button variant="outline" onClick={signOut}>Sair</Button>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full gradient-bg shadow-glow sticky bottom-4">
        {saving ? <Loader2 className="animate-spin" /> : <><Save size={16} />Salvar configurações</>}
      </Button>
    </div>
  );
}
