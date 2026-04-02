import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="font-bold text-xl tracking-tight">
          Ligacup<span className="text-primary">.se</span>
        </span>
        <div className="flex items-center gap-3">
          <Show
            when="signed-in"
            fallback={
              <>
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm">Logga in</Button>
                </SignInButton>
                <Link href="/sign-up">
                  <Button size="sm">Kom igång</Button>
                </Link>
              </>
            }
          >
            <Link href="/dashboard">
              <Button size="sm">Till tiplaget →</Button>
            </Link>
          </Show>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 gap-6">
        <div className="inline-flex items-center gap-2 bg-secondary text-muted-foreground text-sm px-3 py-1 rounded-full border border-border">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          VM 2026 börjar 11 juni — 10 veckor kvar
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight max-w-2xl leading-tight">
          Tipsa VM 2026 med{" "}
          <span className="text-primary">dina vänner</span>
        </h1>

        <p className="text-muted-foreground text-lg max-w-xl">
          Skapa ett privat tipslag, förutsäg alla matcher, och se vem som har koll på fotboll.
          Gratis. Inga insatser — bara äran.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/sign-up">
            <Button size="lg" className="text-base px-8">
              Skapa tipslag gratis
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="text-base px-8">
              Gå med i ett lag
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Hur funkar det?</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Skapa ett tipslag",
                desc: "Du skapar ett privat lag och bjuder in vänner via en länk.",
              },
              {
                step: "2",
                title: "Tippa matcherna",
                desc: "Förutsäg resultaten i gruppspelet och slutspelet innan matcherna startar.",
              },
              {
                step: "3",
                title: "Tävla om äran",
                desc: "Poäng delas ut efter varje match. Håll koll på ligan i realtid.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-3">
                <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-muted-foreground text-xs">
        © 2026 Ligacup.se — Ett tipsspel för fotbollsfans. Inga insatser hanteras av plattformen.
      </footer>
    </main>
  );
}
