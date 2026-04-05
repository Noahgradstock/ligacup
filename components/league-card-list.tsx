"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type LeagueCard = {
  id: string;
  name: string;
  totalPoints: number;
  rankInLeague: number | null;
  matchesPlayed: number;
  memberCount: number;
  isOwner: boolean;
};


function DeleteModal({ league, onClose }: { league: LeagueCard; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const confirmed = input.trim() === league.name.trim();

  async function handleDelete() {
    if (!confirmed) return;
    setStatus("deleting");
    const res = await fetch(`/api/leagues/${league.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      setErrorMsg(await res.text());
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-xl border border-border w-full max-w-md flex flex-col gap-5 p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-destructive">Ta bort tipslag</h2>
          <p className="text-sm text-muted-foreground">
            Detta går inte att ångra. Alla medlemmar, poäng och chattar raderas permanent.
          </p>
        </div>

        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          Du håller på att ta bort <strong>{league.name}</strong> med {league.memberCount}{" "}
          {league.memberCount === 1 ? "deltagare" : "deltagare"}.
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            Skriv <span className="font-mono font-bold">{league.name}</span> för att bekräfta
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setStatus("idle"); }}
            placeholder={league.name}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
            autoFocus
          />
        </div>

        {status === "error" && (
          <p className="text-sm text-destructive">{errorMsg}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleDelete}
            disabled={!confirmed || status === "deleting"}
            className="flex-1 py-2.5 rounded-lg bg-destructive text-white text-sm font-medium disabled:opacity-40 hover:bg-destructive/90 transition-colors"
          >
            {status === "deleting" ? "Tar bort..." : "Ta bort permanent"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LeagueCardList({ cards }: { cards: LeagueCard[] }) {
  const [deletingLeague, setDeletingLeague] = useState<LeagueCard | null>(null);

  return (
    <>
      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <div key={card.id} className="relative flex items-center gap-4 px-5 py-4 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors">
            <Link href={`/league/${card.id}`} className="absolute inset-0 rounded-lg" aria-label={card.name} />

            {/* Rank badge */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              card.rankInLeague === 1 ? "bg-yellow-100 text-yellow-700"
              : card.rankInLeague === 2 ? "bg-slate-100 text-slate-600"
              : card.rankInLeague === 3 ? "bg-orange-100 text-orange-700"
              : "bg-secondary text-muted-foreground"
            }`}>
              {card.rankInLeague ? `#${card.rankInLeague}` : "–"}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{card.name}</p>
              <p className="text-xs text-muted-foreground">
                {card.memberCount} deltagare
                {card.matchesPlayed > 0 && ` · ${card.matchesPlayed} matcher spelade`}
              </p>
            </div>

            {/* Points + arrow */}
            <div className="text-right shrink-0 flex items-center gap-2">
              <p className="text-lg font-bold tabular-nums">{card.totalPoints}p</p>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </div>
          </div>
        ))}
      </div>

      {deletingLeague && (
        <DeleteModal league={deletingLeague} onClose={() => setDeletingLeague(null)} />
      )}
    </>
  );
}
