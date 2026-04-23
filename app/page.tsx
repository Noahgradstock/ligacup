import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoWordmark } from "@/components/logo-wordmark";

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* ── Dark navy nav ── */}
      <div className="bg-[#0d1f3c] w-full">
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <span className="text-xl text-white">
          <LogoWordmark />
        </span>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 border border-white/40"
            >
              Logga in
            </Button>
          </Link>
          <Link href="/league/new">
            <Button
              size="sm"
              className="border border-white/20 text-white bg-transparent hover:bg-white/10"
            >
              Kom igång
            </Button>
          </Link>
        </div>
      </nav>
      </div>

      {/* ── Hero — white ── */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-24 gap-6 max-w-5xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-secondary text-muted-foreground text-sm px-3 py-1 rounded-full border border-border">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          VM 2026 börjar 11 juni — 10 veckor kvar
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight max-w-2xl leading-tight text-foreground">
          Tipsa VM 2026 med{" "}
          <span className="text-[#e6a800]">dina vänner</span>
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
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8"
            >
              Gå med i ett lag
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Feature pills ── */}
      <section className="border-b border-border px-6 py-12">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-5">
          <h2 className="text-lg font-semibold tracking-tight">Vad kan du tippa?</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {["⚽ Matchresultat", "🏆 VM Top 3", "👟 Skyttekung", "🟨 Flest gula kort"].map((f) => (
              <span
                key={f}
                className="text-sm px-4 py-2 rounded-full bg-secondary border border-border font-medium"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-secondary/30 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Hur funkar det?</h2>
          <div className="relative grid sm:grid-cols-3 gap-8">
            {/* Dashed connector — desktop only */}
            <div className="hidden sm:block pointer-events-none absolute top-[18px] left-[calc(16.67%+18px)] right-[calc(16.67%+18px)] border-t-2 border-dashed border-border" />
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
              <div key={item.step} className="relative flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-5">
                <div className="w-9 h-9 rounded-full bg-[#0d1f3c]/10 flex items-center justify-center font-bold text-sm text-[#0d1f3c]">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="relative bg-[#0d1f3c] px-6 py-14 text-center overflow-hidden">
        <div className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full bg-[#e6a800]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative max-w-lg mx-auto flex flex-col items-center gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Redo att tippa?</h2>
          <p className="text-white/60 text-sm max-w-xs">
            Gratis, ingen registrering krävs för att gå med.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-2">
            <Link href="/league/new">
              <Button size="lg" className="text-base px-8">
                Skapa tipslag
              </Button>
            </Link>
            <Link href="/join">
              <Button
                size="lg"
                className="text-base px-8 border border-white/20 text-white bg-transparent hover:bg-white/10"
              >
                Gå med i ett lag
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-1.5">
            <span className="text-lg">
              <LogoWordmark />
            </span>
            <p className="text-xs text-muted-foreground">
              Tipsspel för VM 2026 — gratis, inga insatser.
            </p>
          </div>
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
        <div className="max-w-4xl mx-auto mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © 2026 Ligacup.se
        </div>
      </footer>
    </main>
  );
}
