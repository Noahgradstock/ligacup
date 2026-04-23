"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/use-locale";
import { t } from "@/lib/i18n";

type LeagueCard = {
  id: string;
  name: string;
  bannerUrl: string | null;
  totalPoints: number;
  rankInLeague: number | null;
  matchesPlayed: number;
  memberCount: number;
  isOwner: boolean;
};


function DeleteModal({ league, onClose }: { league: LeagueCard; onClose: () => void }) {
  const locale = useLocale();
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
          <h2 className="text-lg font-bold text-destructive">{t("deleteLeagueTitle", locale)}</h2>
          <p className="text-sm text-muted-foreground">
            {t("deleteLeagueWarning", locale)}
          </p>
        </div>

        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {locale === "en"
            ? <>You are about to delete <strong>{league.name}</strong> with {league.memberCount} {league.memberCount === 1 ? "member" : "members"}.</>
            : <>Du håller på att ta bort <strong>{league.name}</strong> med {league.memberCount} deltagare.</>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            {t("deleteLeagueConfirmLabel", locale)} <span className="font-mono font-bold">{league.name}</span> {t("deleteLeagueConfirmSuffix", locale)}
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
            {t("cancel", locale)}
          </button>
          <button
            onClick={handleDelete}
            disabled={!confirmed || status === "deleting"}
            className="flex-1 py-2.5 rounded-lg bg-destructive text-white text-sm font-medium disabled:opacity-40 hover:bg-destructive/90 transition-colors"
          >
            {status === "deleting" ? t("deleting", locale) : t("deleteLeaguePermanent", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LeagueCardList({ cards }: { cards: LeagueCard[] }) {
  const locale = useLocale();
  const [deletingLeague, setDeletingLeague] = useState<LeagueCard | null>(null);

  return (
    <>
      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <div key={card.id} className="relative flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-all group">
            <Link href={`/league/${card.id}`} className="absolute inset-0 rounded-xl" aria-label={card.name} />

            {/* League avatar or rank badge */}
            {card.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.bannerUrl} alt={card.name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                card.rankInLeague === 1 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                : card.rankInLeague === 2 ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                : card.rankInLeague === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                : "bg-secondary text-muted-foreground"
              }`}>
                {card.rankInLeague ? `#${card.rankInLeague}` : "–"}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{card.name}</p>
              <p className="text-xs text-muted-foreground">
                {card.memberCount} {t("membersLabel", locale)}
                {card.matchesPlayed > 0 ? ` · ${card.matchesPlayed} ${t("matchesPlayed", locale)}` : ` · ${t("predictNow", locale)}`}
              </p>
            </div>

            {/* Points + arrow */}
            <div className="text-right shrink-0 flex items-center gap-2">
              <div>
                <p className="text-base font-bold tabular-nums leading-none">{card.totalPoints}p</p>
                {card.rankInLeague && (
                  <p className="text-xs text-muted-foreground mt-0.5">{t("place", locale)} {card.rankInLeague}</p>
                )}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
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
