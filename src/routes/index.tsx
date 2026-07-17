import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ListChecks, Sparkles, Store, TrendingDown } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dona Marisa — economize na lista de compras" },
      {
        name: "description",
        content:
          "Compare preços de supermercado reportados pela comunidade e descubra onde sua lista sai mais barata, considerando inclusive o frete.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-70" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-2 md:items-center md:py-24">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Feito pra Dona Marisa
              </span>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
                Sua lista de compras pelo <span className="text-gradient">menor preço</span> em cada mercado.
              </h1>
              <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
                Crie listas, deixe a comunidade reportar preços e descubra onde comprar cada item.
                Com cálculo de frete, você sabe se vale a pena o deslocamento.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
                >
                  Começar agora
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
                >
                  Já tenho conta
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-primary/20 blur-3xl" aria-hidden />
              <img
                src={heroImg}
                alt="Mulher sorrindo enquanto registra o preço de um produto no mercado pelo celular"
                width={1024}
                height={1024}
                className="relative aspect-square w-full rounded-3xl object-cover shadow-glow"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: ListChecks,
                title: "Crie sua lista",
                text: "Adicione tudo o que precisa comprar essa semana. Sua lista, do seu jeito.",
              },
              {
                icon: Camera,
                title: "Fotografe e a IA lê o preço",
                text: "No mercado, tire foto da etiqueta. Nossa IA identifica o produto e o valor automaticamente.",
              },
              {
                icon: TrendingDown,
                title: "Veja onde economizar",
                text: "Compare mercados, considere o frete e descubra quanto você economiza.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-border bg-card p-6 shadow-soft transition hover:shadow-glow"
              >
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="rounded-3xl bg-foreground p-8 text-background md:p-12">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <h2 className="font-display text-2xl font-bold md:text-3xl">
                  Comunidade Dona Marisa
                </h2>
                <p className="mt-2 max-w-xl text-sm text-background/70">
                  Cada preço reportado por uma Dona Marisa ajuda outras a economizarem.
                  Junte-se e contribua com sua quebrada.
                </p>
              </div>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-semibold text-coral-foreground shadow-soft transition hover:opacity-90"
              >
                <Store className="h-4 w-4" /> Quero participar
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
