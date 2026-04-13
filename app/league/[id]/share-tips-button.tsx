"use client";

import { useState } from "react";

type Props = {
  leagueId: string;
  inviteUrl: string;
};

export function ShareTipsButton({ leagueId, inviteUrl }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "notReady" | "shared" | "copied" | "error">("idle");

  async function share() {
    if (status === "loading") return;
    setStatus("loading");

    try {
      const res = await fetch(`/api/leagues/${leagueId}/my-summary`);
      if (!res.ok) {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }

      const data = await res.json() as {
        allTipped: boolean;
        top3: {
          first: { name: string; flag: string } | null;
          second: { name: string; flag: string } | null;
          third: { name: string; flag: string } | null;
        } | null;
        topScorer: string | null;
        hasTopScorer: boolean;
      };

      if (!data.allTipped) {
        setStatus("notReady");
        setTimeout(() => setStatus("idle"), 5000);
        return;
      }

      // Build share text
      const lines: string[] = ["🏆 Mina VM-tips\n"];
      if (data.top3?.first) lines.push(`🥇 Vinnare: ${data.top3.first.flag} ${data.top3.first.name}`);
      if (data.top3?.second) lines.push(`🥈 Tvåa: ${data.top3.second.flag} ${data.top3.second.name}`);
      if (data.top3?.third) lines.push(`🥉 Trea: ${data.top3.third.flag} ${data.top3.third.name}`);
      if (data.hasTopScorer && data.topScorer) lines.push(`\n👟 Skyttekung: ${data.topScorer}`);
      lines.push(`\nKan du slå mig? Gå med i mitt tipslag:\n${inviteUrl}`);

      const text = lines.join("\n");

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ text });
          setStatus("shared");
          setTimeout(() => setStatus("idle"), 2500);
        } catch (e) {
          // User dismissed the share sheet — treat as no-op
          if (e instanceof Error && e.name === "AbortError") {
            setStatus("idle");
          } else {
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
          }
        }
      } else {
        await navigator.clipboard.writeText(text);
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 2500);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        disabled={status === "loading"}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50 shrink-0"
      >
        {status === "loading" ? (
          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        )}
        Dela mina VM-tips
      </button>

      {/* Toast banners — fixed bottom of screen */}
      {status === "notReady" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 px-4 py-3 rounded-xl bg-[#0d1f3c] text-white shadow-xl max-w-sm w-[calc(100vw-3rem)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-yellow-400" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm leading-snug">
            Du måste tippa klart <span className="font-semibold">alla matcher</span> innan du kan dela dina VM-tips.
          </p>
        </div>
      )}
      {status === "copied" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-700 text-white shadow-xl max-w-sm w-[calc(100vw-3rem)]">
          <span className="text-base">✓</span>
          <p className="text-sm font-medium">Kopierat till urklipp!</p>
        </div>
      )}
      {status === "shared" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-700 text-white shadow-xl max-w-sm w-[calc(100vw-3rem)]">
          <span className="text-base">✓</span>
          <p className="text-sm font-medium">Delat!</p>
        </div>
      )}
      {status === "error" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive text-white shadow-xl max-w-sm w-[calc(100vw-3rem)]">
          <p className="text-sm font-medium">Något gick fel — försök igen</p>
        </div>
      )}
    </>
  );
}
