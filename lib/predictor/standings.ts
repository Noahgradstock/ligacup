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

// ---------------------------------------------------------------------------
// Best third-placed teams — VM 2026
// ---------------------------------------------------------------------------

/**
 * Each of the 8 third-place bracket slots has a fixed set of eligible groups
 * (the group whose winner is the opponent is excluded to avoid rematches).
 * FIFA pre-computed all C(12,8)=495 combinations; we replicate the constraints here.
 */
const THIRD_SLOT_ELIGIBLE: Record<string, string[]> = {
  "3A/B/C/D/F":   ["A", "B", "C", "D", "F"],
  "3C/D/F/G/H":   ["C", "D", "F", "G", "H"],
  "3C/E/F/H/I":   ["C", "E", "F", "H", "I"],
  "3E/H/I/J/K":   ["E", "H", "I", "J", "K"],
  "3B/E/F/I/J":   ["B", "E", "F", "I", "J"],
  "3A/E/H/I/J":   ["A", "E", "H", "I", "J"],
  "3E/F/G/I/J":   ["E", "F", "G", "I", "J"],
  "3D/E/I/J/L":   ["D", "E", "I", "J", "L"],
};

/**
 * Given all 12 third-placed teams (one per group), rank them by the official
 * FIFA criteria and return the top 8 sorted best-first.
 */
export function rankThirdPlacedTeams(
  thirds: Array<{ group: string; team: StandingsTeam }>
): Array<{ group: string; team: StandingsTeam }> {
  return [...thirds].sort((a, b) => {
    const ta = a.team, tb = b.team;
    if (tb.pts !== ta.pts) return tb.pts - ta.pts;
    const gdA = ta.gf - ta.ga, gdB = tb.gf - tb.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (tb.gf !== ta.gf) return tb.gf - ta.gf;
    if (tb.won !== ta.won) return tb.won - ta.won;
    return ta.name.localeCompare(tb.name);
  });
}

/**
 * Given the 8 qualifying group letters, find the unique valid assignment of
 * each group's third-placed team to one of the 8 bracket slots.
 * Uses backtracking — FIFA guarantees exactly one valid matching exists.
 * Returns a Map of slotKey → groupLetter.
 */
export function assignThirdsToSlots(qualifyingGroups: string[]): Map<string, string> {
  const groupSet = new Set(qualifyingGroups);
  const slots = Object.keys(THIRD_SLOT_ELIGIBLE);
  const result = new Map<string, string>();
  const usedGroups = new Set<string>();

  function backtrack(slotIdx: number): boolean {
    if (slotIdx === slots.length) return true;
    const slot = slots[slotIdx];
    const eligible = THIRD_SLOT_ELIGIBLE[slot].filter(
      (g) => groupSet.has(g) && !usedGroups.has(g)
    );
    for (const group of eligible) {
      usedGroups.add(group);
      result.set(slot, group);
      if (backtrack(slotIdx + 1)) return true;
      usedGroups.delete(group);
      result.delete(slot);
    }
    return false;
  }

  backtrack(0);
  return result;
}
