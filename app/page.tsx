import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoWordmark } from "@/components/logo-wordmark";

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="text-xl">
          <LogoWordmark />
        </span>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">Logga in</Button>
          </Link>
          <Link href="/league/new">
            <Button size="sm">Kom igång</Button>
          </Link>
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
          <Link href="/league/new">
            <Button size="lg" className="text-base px-8">
              Skapa tipslag gratis
            </Button>
          </Link>
          <Link href="/join">
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
      <footer className="border-t border-border px-6 py-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-1.5">
            <span className="text-lg">
              <LogoWordmark />
            </span>
            <p className="text-xs text-muted-foreground">
              Tipsspel för VM 2026 — gratis, inga insatser.
            </p>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link href="/policy" className="hover:text-foreground transition-colors">
              Integritetspolicy
            </Link>
            <Link href="/join" className="hover:text-foreground transition-colors">
              Gå med i ett lag
            </Link>
            <Link href="/league/new" className="hover:text-foreground transition-colors">
              Skapa tipslag
            </Link>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="max-w-4xl mx-auto mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © 2026 Ligacup.se
        </div>
      </footer>
    </main>
  );
}
