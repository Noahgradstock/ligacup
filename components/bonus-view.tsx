"use client";

import { useState } from "react";
import { useLocale } from "@/lib/use-locale";
import { t } from "@/lib/i18n";

type Member = {
  userId: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
};

type BonusPred = {
  userId: string;
  type: string;
  playerName: string | null;
  teamId: string | null;
  teamName: string | null;
  teamFlag: string;
};

type TeamOption = {
  id: string;
  name: string;
  flag: string;
};

type ConfirmedResult = {
  playerName: string | null;
  teamId: string | null;
  teamName: string | null;
  teamFlag: string;
  pointsAwarded: number;
};

type Props = {
  leagueId: string;
  currentUserId: string | null;
  features: string[];
  topScorerPoints: number;
  yellowCardsPoints: number;
  members: Member[];
  predictions: BonusPred[];
  allTeams: TeamOption[];
  confirmedResults: Record<string, ConfirmedResult>;
};

function memberLabel(m: Member) {
  return m.displayName ?? m.email.split("@")[0];
}

function MemberAvatar({ m }: { m: Member }) {
  const label = memberLabel(m);
  if (m.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.avatarUrl} alt={label} className="w-6 h-6 rounded-full shrink-0 object-cover" />;
  }
  return (
    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground uppercase shrink-0">
      {label.slice(0, 1)}
    </div>
  );
}

// ── Top Scorer Section ──────────────────────────────────────────────────────

function TopScorerSection({
  leagueId,
  currentUserId,
  points,
  members,
  predictions,
  confirmed,
}: {
  leagueId: string;
  currentUserId: string | null;
  points: number;
  members: Member[];
  predictions: BonusPred[];
  confirmed: ConfirmedResult | null;
}) {
  const locale = useLocale();
  const myPred = predictions.find((p) => p.userId === currentUserId && p.type === "top_scorer");
  const [value, setValue] = useState(myPred?.playerName ?? "");
  const [saved, setSaved] = useState(myPred?.playerName ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    myPred ? "saved" : "idle"
  );
  // Local override for table display
  const [localPreds, setLocalPreds] = useState(predictions);

  const dirty = value.trim() !== saved.trim();
  const savedAndClean = status === "saved" && !dirty;

  async function save() {
    const name = value.trim();
    if (!name || name.length < 2) return;
    setStatus("saving");
    try {
      const res = await fetch(`/api/leagues/${leagueId}/bonus-predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "top_scorer", playerName: name }),
      });
      if (res.ok) {
        setSaved(name);
        setStatus("saved");
        setLocalPreds((prev) => {
          const next = prev.filter((p) => !(p.userId === currentUserId && p.type === "top_scorer"));
          return [...next, { userId: currentUserId!, type: "top_scorer", playerName: name, teamId: null, teamName: null, teamFlag: "🏳" }];
        });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const scorerPreds = localPreds.filter((p) => p.type === "top_scorer");
  const memberMap = new Map(members.map((m) => [m.userId, m]));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">👟</span>
        <div>
          <h2 className="text-base font-bold">{t("topScorerTitle", locale)}</h2>
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? `Which player scores the most goals? • ${points}pts correct` : `Vilken spelare gör flest mål? • ${points}p för rätt`}
          </p>
        </div>
      </div>

      {confirmed ? (
        <div className="px-4 py-3 rounded-xl border border-green-200 bg-green-50/40 flex items-center gap-3">
          <span className="text-2xl">🏅</span>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{t("topScorerTitle", locale)}</p>
            <p className="text-base font-bold">{confirmed.playerName}</p>
          </div>
        </div>
      ) : currentUserId ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setStatus("idle"); }}
            placeholder={t("enterPlayerName", locale)}
            maxLength={100}
            className="rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={save}
            disabled={status === "saving" || value.trim().length < 2}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              savedAndClean
                ? "bg-green-100 text-green-700 border border-green-200"
                : status === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : value.trim().length < 2
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {status === "saving" ? t("saving", locale) : savedAndClean ? t("saved", locale) : status === "error" ? t("saveError", locale) : t("save", locale)}
          </button>
        </div>
      ) : null}

      {scorerPreds.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-secondary/50 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("allPicksTitle", locale)}</span>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {scorerPreds.map((p) => {
              const member = memberMap.get(p.userId);
              if (!member) return null;
              const isMe = p.userId === currentUserId;
              const isCorrect = confirmed && confirmed.playerName?.toLowerCase() === p.playerName?.toLowerCase();
              return (
                <div key={p.userId} className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? "bg-primary/5" : ""}`}>
                  <MemberAvatar m={member} />
                  <span className={`text-sm flex-1 min-w-0 truncate font-medium ${isMe ? "text-primary" : ""}`}>
                    {memberLabel(member)}{isMe && ` ${t("youSuffix", locale)}`}
                  </span>
                  <span className="text-sm font-semibold truncate max-w-[140px]">{p.playerName}</span>
                  {isCorrect && <span className="text-green-600 font-bold text-xs">+{confirmed.pointsAwarded}p ✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Yellow Cards Section ────────────────────────────────────────────────────

function YellowCardsSection({
  leagueId,
  currentUserId,
  points,
  members,
  predictions,
  allTeams,
  confirmed,
}: {
  leagueId: string;
  currentUserId: string | null;
  points: number;
  members: Member[];
  predictions: BonusPred[];
  allTeams: TeamOption[];
  confirmed: ConfirmedResult | null;
}) {
  const locale = useLocale();
  const myPred = predictions.find((p) => p.userId === currentUserId && p.type === "most_yellow_cards");
  const [selectedId, setSelectedId] = useState(myPred?.teamId ?? "");
  const [savedId, setSavedId] = useState(myPred?.teamId ?? "");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    myPred ? "saved" : "idle"
  );
  const [localPreds, setLocalPreds] = useState(predictions);

  const dirty = selectedId !== savedId;
  const savedAndClean = status === "saved" && !dirty;

  const filtered = allTeams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  async function save() {
    if (!selectedId) return;
    setStatus("saving");
    try {
      const res = await fetch(`/api/leagues/${leagueId}/bonus-predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "most_yellow_cards", teamId: selectedId }),
      });
      if (res.ok) {
        setSavedId(selectedId);
        setStatus("saved");
        const team = allTeams.find((t) => t.id === selectedId);
        setLocalPreds((prev) => {
          const next = prev.filter((p) => !(p.userId === currentUserId && p.type === "most_yellow_cards"));
          return [...next, { userId: currentUserId!, type: "most_yellow_cards", playerName: null, teamId: selectedId, teamName: team?.name ?? null, teamFlag: team?.flag ?? "🏳" }];
        });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const yellowPreds = localPreds.filter((p) => p.type === "most_yellow_cards");
  const memberMap = new Map(members.map((m) => [m.userId, m]));
  const selectedTeam = allTeams.find((t) => t.id === selectedId);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🟨</span>
        <div>
          <h2 className="text-base font-bold">{t("mostYellowTitle", locale)}</h2>
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? `Which team gets the most yellow cards? • ${points}pts correct` : `Vilket lag får flest gula kort i hela turneringen? • ${points}p för rätt`}
          </p>
        </div>
      </div>

      {confirmed ? (
        <div className="px-4 py-3 rounded-xl border border-green-200 bg-green-50/40 flex items-center gap-3">
          <span className="text-2xl">{confirmed.teamFlag}</span>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{t("mostYellowTitle", locale)}</p>
            <p className="text-base font-bold">{confirmed.teamName}</p>
          </div>
        </div>
      ) : currentUserId ? (
        <div className="flex flex-col gap-2">
          {selectedTeam && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary bg-primary/5">
              <span className="text-xl">{selectedTeam.flag}</span>
              <span className="text-sm font-semibold flex-1">{selectedTeam.name}</span>
              <button onClick={() => { setSelectedId(""); setSavedId(""); setStatus("idle"); }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchTeam", locale)}
            className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">{t("noTeamsFound", locale)}</p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedId(t.id); setSearch(""); setStatus("idle"); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/50 transition-colors border-b border-border last:border-0 ${selectedId === t.id ? "bg-primary/5 text-primary font-semibold" : ""}`}
                  >
                    <span className="text-lg">{t.flag}</span>
                    <span className="truncate">{t.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {selectedId && (
            <button
              onClick={save}
              disabled={status === "saving"}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                savedAndClean
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : status === "error"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {status === "saving" ? t("saving", locale) : savedAndClean ? t("saved", locale) : status === "error" ? t("saveError", locale) : t("save", locale)}
            </button>
          )}
        </div>
      ) : null}

      {yellowPreds.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-secondary/50 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("allPicksTitle", locale)}</span>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {yellowPreds.map((p) => {
              const member = memberMap.get(p.userId);
              if (!member) return null;
              const isMe = p.userId === currentUserId;
              const isCorrect = confirmed && confirmed.teamId === p.teamId;
              return (
                <div key={p.userId} className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? "bg-primary/5" : ""}`}>
                  <MemberAvatar m={member} />
                  <span className={`text-sm flex-1 min-w-0 truncate font-medium ${isMe ? "text-primary" : ""}`}>
                    {memberLabel(member)}{isMe && ` ${t("youSuffix", locale)}`}
                  </span>
                  <span className="text-lg">{p.teamFlag}</span>
                  <span className="text-sm font-semibold truncate max-w-[100px]">{p.teamName}</span>
                  {isCorrect && <span className="text-green-600 font-bold text-xs">+{confirmed.pointsAwarded}p ✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────

export function BonusView({
  leagueId,
  currentUserId,
  features,
  topScorerPoints,
  yellowCardsPoints,
  members,
  predictions,
  allTeams,
  confirmedResults,
}: Props) {
  return (
    <div className="flex flex-col gap-8">
      {features.includes("top_scorer") && (
        <TopScorerSection
          leagueId={leagueId}
          currentUserId={currentUserId}
          points={topScorerPoints}
          members={members}
          predictions={predictions}
          confirmed={confirmedResults["top_scorer"] ?? null}
        />
      )}
      {features.includes("most_yellow_cards") && (
        <YellowCardsSection
          leagueId={leagueId}
          currentUserId={currentUserId}
          points={yellowCardsPoints}
          members={members}
          predictions={predictions}
          allTeams={allTeams}
          confirmed={confirmedResults["most_yellow_cards"] ?? null}
        />
      )}
    </div>
  );
}
