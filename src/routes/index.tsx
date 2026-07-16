import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Mail, Sparkles, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "F-Entrega — Ganhos 99Food, Uber e gastos da moto" },
      {
        name: "description",
        content:
          "Controle seus saques 99Food e Uber, gastos da moto e veja insights mensais com IA. Grátis pra começar.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setChecking(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black shadow-md shadow-primary/20">
            <Zap className="h-4.5 w-4.5 fill-current text-primary-foreground" />
          </div>
          <span className="font-extrabold tracking-tight">F-Entrega</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Entrar</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 sm:py-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3" />
            Insights mensais com IA
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl text-left sm:text-center">
            Seus ganhos da 99Food, Uber e gastos da moto, num só lugar.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Conecte seu Gmail, importamos automaticamente seus saques da 99Food e Uber, e você
            registra os gastos da moto. Saiba se vale a pena rodar — toda semana.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto">
                Começar grátis <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 py-8 sm:grid-cols-3">
          {[
            {
              icon: Mail,
              title: "Importação automática",
              body: "Conecte seu Gmail e os saques da 99Food são lidos automaticamente.",
            },
            {
              icon: BarChart3,
              title: "Gastos da moto",
              body: "Combustível, manutenção, aluguel — tudo organizado por mês.",
            },
            {
              icon: Sparkles,
              title: "Insights com IA",
              body: "Receba análises mensais explicando seus ganhos e onde economizar.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="mb-3 size-5 text-foreground" />
              <h3 className="font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <section className="py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Como funciona
          </h2>
          <ol className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-3">
            {[
              { n: "1", t: "Crie sua conta", d: "Em segundos, com e-mail ou Google." },
              { n: "2", t: "Conecte o Gmail", d: "Lemos só os e-mails de saque da 99/Uber." },
              { n: "3", t: "Acompanhe tudo", d: "Dashboard com totais, histórico e IA." },
            ].map((s) => (
              <li key={s.n} className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                  {s.n}
                </div>
                <h3 className="font-medium">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="py-16 text-center">
          <div className="mx-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Seus dados ficam protegidos. Você pode apagar a conta quando quiser.
          </div>
          <div className="mt-6">
            <Link to="/auth">
              <Button size="lg">
                Começar agora <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} F-Entrega
      </footer>
    </div>
  );
}
