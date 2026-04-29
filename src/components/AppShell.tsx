import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sparkles, MessageSquare, Users, FileText, Settings, LayoutDashboard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dashboard } from "@/components/views/Dashboard";
import { Copilot } from "@/components/views/Copilot";
import { CRM } from "@/components/views/CRM";
import { Scripts } from "@/components/views/Scripts";
import { SettingsView } from "@/components/views/SettingsView";

type View = "dashboard" | "copilot" | "crm" | "scripts" | "settings";

const NAV: { id: View; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "copilot", label: "Copiloto IA", icon: MessageSquare },
  { id: "crm", label: "CRM Leads", icon: Users },
  { id: "scripts", label: "Scripts", icon: FileText },
  { id: "settings", label: "Configurações", icon: Settings },
];

export default function AppShell() {
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>("copilot");
  const [menuOpen, setMenuOpen] = useState(false);

  const renderView = () => {
    switch (view) {
      case "dashboard": return <Dashboard />;
      case "copilot": return <Copilot />;
      case "crm": return <CRM />;
      case "scripts": return <Scripts />;
      case "settings": return <SettingsView />;
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-2 py-4">
        <div className="w-10 h-10 rounded-xl gradient-bg grid place-items-center shadow-glow">
          <Sparkles className="text-white" size={20} />
        </div>
        <div>
          <div className="font-display font-bold text-lg leading-none">IrisIA</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Copiloto IA</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 mt-2">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = view === n.id;
          return (
            <button
              key={n.id}
              onClick={() => { setView(n.id); setMenuOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-gradient-soft text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon size={18} />
              {n.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-3 glass rounded-xl text-sm">
        <div className="font-semibold truncate">{user?.email}</div>
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start mt-2 text-muted-foreground">
          <LogOut size={16} /> Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Mobile header */}
      {isMobile && (
        <header className="glass-strong px-4 py-3 flex items-center justify-between safe-top border-b border-border">
          <button onClick={() => setMenuOpen(true)} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-bg grid place-items-center">
              <Sparkles className="text-white" size={18} />
            </div>
            <div className="text-left">
              <div className="font-display font-bold text-base leading-none">IrisIA</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{NAV.find((n) => n.id === view)?.label}</div>
            </div>
          </button>
        </header>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="w-64 shrink-0 glass-strong border-r border-border p-3 flex flex-col">
          <SidebarContent />
        </aside>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-72 p-3 glass-strong border-r border-border">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto">
          {renderView()}
        </div>

        {/* Mobile bottom nav */}
        {isMobile && (
          <nav className="glass-strong border-t border-border grid grid-cols-5 safe-bottom">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon size={20} />
                  <span className="truncate max-w-full px-1">{n.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </nav>
        )}
      </main>
    </div>
  );
}
