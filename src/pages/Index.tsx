import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    window.location.replace("/irisia.html");
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p>Carregando IrisIA…</p>
    </div>
  );
};

export default Index;
