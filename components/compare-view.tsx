"use client";

type Member = {
  userId: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
};

type Top3Pred = {
  userId: string;
  first: { name: string; flag: string } | null;
  second: { name: string; flag: string } | null;
  third: { name: string; flag: string } | null;
};

type BonusPred = {
  userId: string;
  type: string;
  value: string;
  flag?: string;
};

type Props = {
  currentUserId: string | null;
  members: Member[];
  top3: Top3Pred[];
  bonus: BonusPred[];
  hasTopScorer: boolean;
  hasYellowCards: boolean;
};

// Returns a set of values that appear 2+ times in a column (for agreement highlighting)
function agreementSet(values: (string | null)[]): Set<string> {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n >= 2).map(([v]) => v));
}

function initials(member: Member) {
  const name = member.displayName ?? member.email;
  return name.slice(0, 2).toUpperCase();
}

export function CompareView({
  currentUserId,
  members,
  top3,
  bonus,
  hasTopScorer,
  hasYellowCards,
}: Props) {
  // Build lookup maps
  const top3Map = new Map(top3.map((t) => [t.userId, t]));
  const topScorerMap = new Map(
    bonus.filter((b) => b.type === "top_scorer").map((b) => [b.userId, b])
  );
  const yellowMap = new Map(
    bonus.filter((b) => b.type === "most_yellow_cards").map((b) => [b.userId, b])
  );

  // Compute agreement sets per column
  const firstValues = members.map((m) => top3Map.get(m.userId)?.first?.name ?? null);
  const secondValues = members.map((m) => top3Map.get(m.userId)?.second?.name ?? null);
  const thirdValues = members.map((m) => top3Map.get(m.userId)?.third?.name ?? null);
  const scorerValues = members.map((m) => topScorerMap.get(m.userId)?.value ?? null);
  const yellowValues = members.map((m) => yellowMap.get(m.userId)?.value ?? null);

  const firstAgreement = agreementSet(firstValues);
  const secondAgreement = agreementSet(secondValues);
  const thirdAgreement = agreementSet(thirdValues);
  const scorerAgreement = agreementSet(scorerValues);
  const yellowAgreement = agreementSet(yellowValues);

  const anyPrediction = top3.length > 0 || bonus.length > 0;

  if (!anyPrediction) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
        <p className="text-muted-foreground text-sm">
          Inga tips gjorda ännu — var först med att sätta ditt VM-tips!
        </p>
      </div>
    );
  }

  const columns = [
    { key: "first", label: "🥇 1:a" },
    { key: "second", label: "🥈 2:a" },
    { key: "third", label: "🥉 3:a" },
    ...(hasTopScorer ? [{ key: "scorer", label: "⚽ Skyttekung" }] : []),
    ...(hasYellowCards ? [{ key: "yellow", label: "🟨 Flest gula" }] : []),
  ];

  function getCell(member: Member, key: string): { display: string; agreementKey: string | null } {
    const t = top3Map.get(member.userId);
    const s = topScorerMap.get(member.userId);
    const y = yellowMap.get(member.userId);

    if (key === "first") {
      return t?.first
        ? { display: `${t.first.flag} ${t.first.name}`, agreementKey: t.first.name }
        : { display: "–", agreementKey: null };
    }
    if (key === "second") {
      return t?.second
        ? { display: `${t.second.flag} ${t.second.name}`, agreementKey: t.second.name }
        : { display: "–", agreementKey: null };
    }
    if (key === "third") {
      return t?.third
        ? { display: `${t.third.flag} ${t.third.name}`, agreementKey: t.third.name }
        : { display: "–", agreementKey: null };
    }
    if (key === "scorer") {
      return s?.value
        ? { display: s.value, agreementKey: s.value }
        : { display: "–", agreementKey: null };
    }
    if (key === "yellow") {
      return y?.value
        ? { display: `${y.flag ?? ""} ${y.value}`.trim(), agreementKey: y.value }
        : { display: "–", agreementKey: null };
    }
    return { display: "–", agreementKey: null };
  }

  function isAgreed(key: string, agreementKey: string | null): boolean {
    if (!agreementKey) return false;
    if (key === "first") return firstAgreement.has(agreementKey);
    if (key === "second") return secondAgreement.has(agreementKey);
    if (key === "third") return thirdAgreement.has(agreementKey);
    if (key === "scorer") return scorerAgreement.has(agreementKey);
    if (key === "yellow") return yellowAgreement.has(agreementKey);
    return false;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                Deltagare
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member, i) => {
              const isCurrentUser = member.userId === currentUserId;
              return (
                <tr
                  key={member.userId}
                  className={`border-b border-border last:border-0 ${
                    isCurrentUser ? "bg-primary/5" : i % 2 === 0 ? "bg-background" : "bg-secondary/20"
                  }`}
                >
                  {/* Member name cell */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {initials(member)}
                          </span>
                        </div>
                      )}
                      <span className={`font-medium truncate max-w-[120px] ${isCurrentUser ? "text-primary" : ""}`}>
                        {member.displayName ?? member.email}
                        {isCurrentUser && <span className="text-xs font-normal text-muted-foreground ml-1">(du)</span>}
                      </span>
                    </div>
                  </td>

                  {/* Prediction cells */}
                  {columns.map((col) => {
                    const { display, agreementKey } = getCell(member, col.key);
                    const agreed = isAgreed(col.key, agreementKey);
                    const isEmpty = display === "–";
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 whitespace-nowrap ${
                          agreed
                            ? "bg-amber-50 text-amber-900"
                            : isEmpty
                            ? "text-muted-foreground"
                            : ""
                        }`}
                      >
                        {agreed && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 align-middle" />
                        )}
                        <span className={isEmpty ? "opacity-40" : ""}>{display}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 bg-secondary/30 border-t border-border flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-xs text-muted-foreground">Flera deltagare tippar samma</span>
      </div>
    </div>
  );
}
