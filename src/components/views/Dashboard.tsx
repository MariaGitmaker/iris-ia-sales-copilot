import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, MessageSquare, Target, Loader2 } from "lucide-react";

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ leads: 0, hot: 0, negotiations: 0, value: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: leads }, { data: negs }] = await Promise.all([
        supabase.from("leads").select("score,value").eq("user_id", user.id),
        supabase.from("negotiations").select("id").eq("user_id", user.id),
      ]);
      const hot = leads?.filter((l) => (l.score ?? 0) >= 70).length ?? 0;
      const value = leads?.reduce((s, l) => s + Number(l.value ?? 0), 0) ?? 0;
      setStats({ leads: leads?.length ?? 0, hot, negotiations: negs?.length ?? 0, value });
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="grid place-items-center h-64"><Loader2 className="animate-spin text-primary" /></div>;

  const cards = [
    { label: "Leads totais", value: stats.leads, icon: Users, color: "text-primary" },
    { label: "Leads quentes", value: stats.hot, icon: Target, color: "text-warning" },
    { label: "Negociações ativas", value: stats.negotiations, icon: MessageSquare, color: "text-accent" },
    { label: "Pipeline (R$)", value: stats.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }), icon: TrendingUp, color: "text-success" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold gradient-text">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da sua operação comercial</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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

      <Card className="glass p-5 border-border">
        <h2 className="font-display font-semibold text-lg mb-2">Bem-vindo à IrisIA</h2>
        <p className="text-sm text-muted-foreground">
          Use o <strong>Copiloto IA</strong> para receber sugestões em tempo real durante negociações,
          gerencie seus leads no <strong>CRM</strong> e crie <strong>scripts</strong> personalizados com IA.
        </p>
      </Card>
    </div>
  );
}
