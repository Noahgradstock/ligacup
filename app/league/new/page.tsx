"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/bottom-nav";

type Privacy = "private" | "public";

const MAX_MEMBER_OPTIONS = [
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
  { label: "Obegränsat", value: 200 },
];

type Feature = {
  key: string;
  emoji: string;
  title: string;
  desc: string;
  alwaysOn?: boolean;
};

const FEATURES: Feature[] = [
  {
    key: "match_scores",
    emoji: "⚽",
    title: "Matchresultat",
    desc: "Tippa exakt resultat på alla matcher i turneringen.",
    alwaysOn: true,
  },
  {
    key: "tournament_winner",
    emoji: "🏆",
    title: "Turneringsvinnare",
    desc: "Vem vinner hela VM? Poäng delas ut om din tippning stämmer.",
  },
  {
    key: "top_scorer",
    emoji: "👟",
    title: "Skyttekung",
    desc: "Vilken spelare gör flest mål i turneringen?",
  },
  {
    key: "group_winners",
    emoji: "📋",
    title: "Gruppvinnare",
    desc: "Tippa vilka lag som vinner respektive grupp i gruppspelet.",
  },
  {
    key: "finalist",
    emoji: "🥈",
    title: "Finalist",
    desc: "Vilket lag når finalen? Poäng oavsett om de vinner eller förlorar.",
  },
  {
    key: "most_red_cards",
    emoji: "🟥",
    title: "Flest röda kort",
    desc: "Vilket lag får flest röda kort under turneringen?",
  },
];

export default function NewLeaguePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("private");
  const [maxMembers, setMaxMembers] = useState(20);
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(
    new Set(["match_scores", "tournament_winner", "top_scorer"])
  );
  const [exactScore, setExactScore] = useState(3);
  const [correctWinner, setCorrectWinner] = useState(1);
  const [correctDraw, setCorrectDraw] = useState(1);

  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function toggleFeature(key: string) {
    setEnabledFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");

    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        isPublic: privacy === "public",
        maxMembers,
        features: Array.from(enabledFeatures),
        scoring: { exactScore, correctWinner, correctDraw },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/league/${data.id}`);
    } else {
      setErrorMsg(await res.text());
      setStatus("error");
    }
  }

  return (
    <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="font-bold text-xl tracking-tight">
          Ligacup<span className="text-primary">.se</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Avbryt
        </Link>
      </nav>

      <form onSubmit={create} className="max-w-lg mx-auto w-full px-6 py-10 flex flex-col gap-10">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skapa tipslag</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Välj vad ni ska tippa, hur länge och vilka regler som gäller.
          </p>
        </div>

        {/* ── 1: Name ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Lagets namn
          </h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="t.ex. Kansliet VM-tips"
            minLength={2}
            maxLength={50}
            required
            autoFocus
            className="rounded-lg border border-border bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">{name.length}/50 tecken</p>
        </section>

        {/* ── 2: What to bet on ── */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Vad ska ni tippa?
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Välj vilka kategorier som ingår i tävlingen.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {FEATURES.map((f) => {
              const on = enabledFeatures.has(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => !f.alwaysOn && toggleFeature(f.key)}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg border text-left transition-colors ${
                    on
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card text-muted-foreground"
                  } ${f.alwaysOn ? "cursor-default opacity-80" : "hover:bg-secondary/50 cursor-pointer"}`}
                >
                  <span className="text-xl shrink-0">{f.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${on ? "text-foreground" : ""}`}>
                      {f.title}
                      {f.alwaysOn && (
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          (alltid på)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                  {/* Toggle indicator */}
                  <div
                    className={`w-10 h-6 rounded-full shrink-0 transition-colors relative ${
                      on ? "bg-primary" : "bg-border"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                        on ? "left-5" : "left-1"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 3: Privacy ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Synlighet
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(["private", "public"] as Privacy[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrivacy(p)}
                className={`flex flex-col gap-1.5 rounded-lg border px-4 py-4 text-left transition-colors ${
                  privacy === p
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="text-lg">{p === "private" ? "🔒" : "🌍"}</span>
                <span className="font-semibold text-sm">
                  {p === "private" ? "Privat" : "Publik"}
                </span>
                <span className="text-xs leading-relaxed">
                  {p === "private"
                    ? "Bara de med inbjudningslänken kan gå med."
                    : "Vem som helst kan hitta och gå med."}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── 4: Max members ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Max antal deltagare
          </h2>
          <div className="flex gap-2 flex-wrap">
            {MAX_MEMBER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaxMembers(opt.value)}
                className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                  maxMembers === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── 5: Scoring rules ── */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Poängregler — matchresultat
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Hur många poäng ges per korrekt gissning?
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              {
                label: "Exakt resultat",
                desc: "t.ex. tippade 2–1, matchen slutar 2–1",
                value: exactScore,
                set: setExactScore,
              },
              {
                label: "Rätt vinnare",
                desc: "rätt lag vinner men fel poängskillnad",
                value: correctWinner,
                set: setCorrectWinner,
              },
              {
                label: "Rätt oavgjort",
                desc: "tippade oavgjort och matchen slutade oavgjort",
                value: correctDraw,
                set: setCorrectDraw,
              },
            ].map((rule) => (
              <div
                key={rule.label}
                className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{rule.label}</p>
                  <p className="text-xs text-muted-foreground">{rule.desc}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => rule.set(Math.max(0, rule.value - 1))}
                    className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors font-bold"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold tabular-nums text-sm">
                    {rule.value}p
                  </span>
                  <button
                    type="button"
                    onClick={() => rule.set(Math.min(10, rule.value + 1))}
                    className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {status === "error" && (
          <p className="text-sm text-destructive -mt-4">{errorMsg}</p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={status === "saving" || name.trim().length < 2}
          className="w-full text-base"
        >
          {status === "saving" ? "Skapar tipslag..." : "Skapa tipslag →"}
        </Button>

      </form>

      <BottomNav />
    </main>
  );
}
