import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, MessageSquare, Target, Loader2, Sparkles, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { callIrisAI } from "@/lib/ai";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const STAGE_LABELS: Record<string, string> = {
  new: "Novo", qualification: "Qualificação", proposal: "Proposta",
  negotiation: "Negociação", closed_won: "Ganho", closed_lost: "Perdido",
};
const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

export function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({ leads: 0, hot: 0, negotiations: 0, value: 0, won: 0, lost: 0 });
  const [funnel, setFunnel] = useState<any[]>([]);
  const [evolution, setEvolution] = useState<any[]>([]);
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: leads }, { data: negs }, { data: ins }] = await Promise.all([
        supabase.from("leads").select("*").eq("user_id", user.id),
        supabase.from("negotiations").select("*").eq("user_id", user.id),
        supabase.from("insights").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
      ]);
      const allLeads = leads ?? [];
      const allNegs = negs ?? [];
      const hot = allLeads.filter((l) => (l.score ?? 0) >= 70).length;
      const value = allLeads.reduce((s, l) => s + Number(l.value ?? 0), 0);
      const won = allLeads.filter((l) => l.stage === "closed_won").length;
      const lost = allLeads.filter((l) => l.stage === "closed_lost").length;
      setStats({ leads: allLeads.length, hot, negotiations: allNegs.length, value, won, lost });

      // Funil por estágio
      const fn = Object.keys(STAGE_LABELS).map((stage) => ({
        stage: STAGE_LABELS[stage],
        leads: allLeads.filter((l) => l.stage === stage).length,
        value: allLeads.filter((l) => l.stage === stage).reduce((s, l) => s + Number(l.value ?? 0), 0),
      }));
      setFunnel(fn);

      // Evolução nos últimos 30 dias
      const days: any[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const dayLeads = allLeads.filter((l) => l.created_at?.slice(0, 10) === key).length;
        const dayWon = allLeads.filter((l) => l.stage === "closed_won" && l.updated_at?.slice(0, 10) === key).length;
        days.push({ date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), leads: dayLeads, ganhos: dayWon });
      }
      setEvolution(days);

      // Motivos de perda
      const reasons = allNegs.filter((n) => n.loss_reason).reduce((acc: Record<string, number>, n) => {
        acc[n.loss_reason] = (acc[n.loss_reason] || 0) + 1; return acc;
      }, {});
      setLossReasons(Object.entries(reasons).map(([name, value]) => ({ name, value })));

      setInsights(ins ?? []);
      setLoading(false);
    })();
  }, [user]);

  const generateInsights = async () => {
    if (!user) return;
    setLoadingInsights(true);
    try {
      const result = await callIrisAI({
        action: "generate_insights",
        stats: { ...stats, funnel, lossReasons, evolution: evolution.slice(-7) },
      });
      const items = result.insights || [];
      // limpa antigos e salva novos
      await supabase.from("insights").delete().eq("user_id", user.id);
      const rows = items.map((i: any) => ({ user_id: user.id, ...i }));
      const { data } = await supabase.from("insights").insert(rows).select();
      setInsights(data ?? []);
      toast.success("Insights atualizados");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoadingInsights(false); }
  };

  if (loading) return <div className="grid place-items-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  const conversionRate = stats.leads > 0 ? Math.round((stats.won / stats.leads) * 100) : 0;
  const avgTicket = stats.won > 0 ? stats.value / stats.leads : 0;

  const cards = [
    { label: "Leads totais", value: stats.leads, icon: Users, color: "text-primary" },
    { label: "Leads quentes", value: stats.hot, icon: Target, color: "text-warning" },
    { label: "Negociações", value: stats.negotiations, icon: MessageSquare, color: "text-accent" },
    { label: "Pipeline", value: stats.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }), icon: TrendingUp, color: "text-success" },
    { label: "Conversão", value: `${conversionRate}%`, icon: Target, color: "text-primary" },
    { label: "Ganhas / Perdidas", value: `${stats.won} / ${stats.lost}`, icon: TrendingUp, color: "text-accent" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold gradient-text">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral, gráficos e insights de IA</p>
        </div>
        <Button onClick={generateInsights} disabled={loadingInsights} className="gradient-bg shadow-glow">
          {loadingInsights ? <Loader2 className="animate-spin mr-1" size={14} /> : <Sparkles size={14} className="mr-1" />}
          Gerar insights IA
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="glass p-4 md:p-5 border-border">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</div>
                  <div className="text-xl md:text-2xl font-display font-bold mt-2 truncate">{c.value}</div>
                </div>
                <Icon className={c.color} size={22} />
              </div>
            </Card>
          );
        })}
      </div>

      {insights.length > 0 && (
        <Card className="glass-strong border-primary/30 p-4 md:p-5 space-y-3">
          <div className="flex items-center gap-2 text-primary"><Lightbulb size={18} /><h2 className="font-display font-semibold">Insights da IA</h2></div>
          <div className="grid md:grid-cols-2 gap-2">
            {insights.map((i) => (
              <div key={i.id} className="bg-secondary/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${i.priority === "high" ? "bg-destructive/20 text-destructive" : i.priority === "medium" ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"}`}>{i.priority}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{i.category}</span>
                </div>
                <div className="font-semibold text-sm">{i.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{i.description}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass p-4 border-border">
          <h3 className="font-semibold mb-3 text-sm">Funil de vendas</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glass p-4 border-border">
          <h3 className="font-semibold mb-3 text-sm">Evolução (30 dias)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={evolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={9} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ganhos" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glass p-4 border-border">
          <h3 className="font-semibold mb-3 text-sm">Pipeline por estágio (R$)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis type="category" dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={10} width={80} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} formatter={(v: any) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
              <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glass p-4 border-border">
          <h3 className="font-semibold mb-3 text-sm">Motivos de perda</h3>
          {lossReasons.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={lossReasons} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                  {lossReasons.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] grid place-items-center text-xs text-muted-foreground text-center px-4">
              Nenhuma negociação perdida com motivo registrado ainda. Defina <em>loss_reason</em> em negociações encerradas.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
