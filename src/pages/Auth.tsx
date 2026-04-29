import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export default function Auth() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error(error);
    else { toast.success("Bem-vindo à IrisIA!"); nav("/"); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Senha mínima de 6 caracteres");
    setBusy(true);
    const { error } = await signUp(email, password, fullName);
    setBusy(false);
    if (error) toast.error(error);
    else { toast.success("Conta criada! Verifique seu email se necessário."); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await resetPassword(email);
    setBusy(false);
    if (error) toast.error(error);
    else toast.success("Email de recuperação enviado!");
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-xl gradient-bg grid place-items-center shadow-glow">
            <Sparkles className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold gradient-text">IrisIA</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Copiloto Comercial IA</p>
          </div>
        </div>

        <div className="glass-strong rounded-2xl p-6 shadow-card">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-3 w-full mb-6">
              <TabsTrigger value="in">Entrar</TabsTrigger>
              <TabsTrigger value="up">Cadastrar</TabsTrigger>
              <TabsTrigger value="forgot">Recuperar</TabsTrigger>
            </TabsList>

            <TabsContent value="in">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Senha</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={busy} className="w-full gradient-bg shadow-glow">
                  {busy ? <Loader2 className="animate-spin" /> : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="up">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div><Label>Nome completo</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Senha</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={busy} className="w-full gradient-bg shadow-glow">
                  {busy ? <Loader2 className="animate-spin" /> : "Criar conta"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="forgot">
              <form onSubmit={handleForgot} className="space-y-4">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <Button type="submit" disabled={busy} className="w-full gradient-bg shadow-glow">
                  {busy ? <Loader2 className="animate-spin" /> : "Enviar link"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
