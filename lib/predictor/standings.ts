/**
 * Compute group standings from match data + prediction map.
 * Used both client-side (predictions-view) and server-side (bracket page).
 */

export type StandingsTeam = {
  name: string;
  flag: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
};

type MatchInput = {
  matchId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  actualHome: number | null;
  actualAway: number | null;
};

export function computeGroupStandings(
  groupMatches: MatchInput[],
  predMap: Map<string, { home: number; away: number }>
): StandingsTeam[] {
  const map = new Map<string, StandingsTeam>();

  for (const m of groupMatches) {
    if (!map.has(m.homeTeam))
      map.set(m.homeTeam, { name: m.homeTeam, flag: m.homeFlag, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 });
    if (!map.has(m.awayTeam))
      map.set(m.awayTeam, { name: m.awayTeam, flag: m.awayFlag, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 });
  }

  for (const m of groupMatches) {
    const pred = predMap.get(m.matchId);
    const h = m.actualHome ?? pred?.home ?? null;
    const a = m.actualAway ?? pred?.away ?? null;
    if (h === null || a === null) continue;

    const home = map.get(m.homeTeam)!;
    const away = map.get(m.awayTeam)!;
    home.played++; away.played++;
    home.gf += h; home.ga += a;
    away.gf += a; away.ga += h;
    if (h > a) {
      home.won++; home.pts += 3; away.lost++;
    } else if (h < a) {
      away.won++; away.pts += 3; home.lost++;
    } else {
      home.drawn++; home.pts += 1; away.drawn++; away.pts += 1;
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });
}
