# Predictions & Scoring System

How predictions work in Ligacup — from user input to leaderboard points.

---

## Concept

Ligacup is a **prediction game**, not gambling. No money is involved. Users predict exact scores for every match in the World Cup, compete within private leagues, and earn points based on accuracy. The winner gets the glory.

---

## Point System

Defined in the `prediction_rules` table, linked per tournament:

| Result | Points |
|---|---|
| Exact score (e.g. predicted 2–1, actual 2–1) | **3 pts** |
| Correct winner or draw (e.g. predicted 2–1, actual 3–1) | **1 pt** |
| Wrong result | **0 pts** |

Rules are stored in the database rather than hardcoded, which means different tournaments can use different point systems (e.g. knockout rounds could award double points in the future).

**Schema:**
```ts
prediction_rules {
  tournamentId
  pointsExactScore       // default: 3
  pointsCorrectWinner    // default: 1
  pointsCorrectDraw      // default: 1
  bonusUnderdogMultiplier // default: 1.0 (reserved for future use)
  appliesToRoundType     // null = applies to all rounds
}
```

---

## Lifecycle of a Prediction

```
User enters score  →  POST /api/predictions  →  predictions table
                                                       ↓
                                         (when match ends)
Admin confirms result  →  POST /api/admin/result  →  matches.is_result_confirmed = true
                                                       ↓
                                         calculatePoints() runs
                                                       ↓
                                         point_snapshots upserted
                                                       ↓
                                         Leaderboard updated
```

---

## Deadlines

A prediction is **locked** the moment the match kicks off. The deadline is `match.scheduled_at`.

Enforced in two places:
1. **Server** — `POST /api/predictions` rejects requests where `new Date() >= match.scheduled_at`
2. **Client** — `<MatchCard />` hides the input and shows "Låst" when `isLocked` is true

There is no grace period. A match that has started cannot be predicted.

---

## Database Tables

### `predictions`
One row per user per match. Updated via `onConflictDoUpdate` (upsert), so a user can change their prediction any number of times before the deadline.

```
predictions
  id
  user_id         → users.id
  match_id        → matches.id
  home_score_pred
  away_score_pred
  submitted_at
  updated_at

UNIQUE (user_id, match_id)
```

### `point_snapshots`
One row per user per league. Updated after each confirmed result. Stores cumulative totals — the leaderboard reads directly from this table rather than recomputing from raw predictions every time.

```
point_snapshots
  id
  user_id         → users.id
  league_id       → leagues.id
  tournament_id   → tournaments.id
  total_points
  rank_in_league
  matches_played
  exact_scores    (count of 3-point predictions)
  correct_winners (count of 1-point predictions)
  last_match_id   → matches.id (last match that triggered recalc)
  computed_at

UNIQUE (user_id, league_id)
```

---

## Point Calculation (not yet implemented — planned)

When an admin confirms a result via `POST /api/admin/result`:

1. `matches.home_score`, `matches.away_score` are set
2. `matches.is_result_confirmed = true`
3. All `predictions` for that `match_id` are fetched
4. For each prediction, points are calculated:

```ts
function calcPoints(
  pred: { home: number; away: number },
  result: { home: number; away: number },
  rules: { exactScore: number; correctWinner: number; correctDraw: number }
): number {
  if (pred.home === result.home && pred.away === result.away) {
    return rules.exactScore;         // exact
  }
  const predOutcome = Math.sign(pred.home - pred.away);
  const realOutcome = Math.sign(result.home - result.away);
  if (predOutcome === realOutcome) {
    return realOutcome === 0
      ? rules.correctDraw            // predicted draw, got draw
      : rules.correctWinner;         // predicted correct winner
  }
  return 0;
}
```

5. `point_snapshots` is upserted for every `(user_id, league_id)` pair where the user is a member of a league and had a prediction for that match.

This will be triggered synchronously for now, then moved to a BullMQ queue once real-time SSE updates are implemented.

---

## Leagues & Leaderboard

Predictions are global (one prediction per user per match), but **scoring is per league**. The same prediction counts in every league a user belongs to. This means:

- A user predicts 48 group stage scores once
- Those predictions are scored independently in each of their leagues
- `point_snapshots` has one row per `(user, league)` pair

The leaderboard on `/league/[id]` reads from `point_snapshots` ordered by `total_points DESC`. Tiebreaker by `exact_scores DESC` (more 3-point predictions = higher rank).

---

## Planned: Knockout Bracket Predictions

The group stage uses exact score predictions. The knockout stage will use a different model:

- Users predict **which team advances** through each round (tap-to-win UI)
- Separate point values per round (e.g. R16: 2pts, QF: 4pts, SF: 6pts, Final: 10pts)
- Bracket predictions stored in a separate table (`bracket_predictions`, not yet in schema)
- Auto-seeded from group stage outcomes — if a user's group predictions put Germany in slot R16-A, their bracket auto-fills Germany there

---

## Planned: Specials

Two bonus prediction fields per tournament:

| Field | Description |
|---|---|
| Top Scorer | Which player scores the most goals |
| Tiebreaker | Total goals scored in the entire tournament |

The tiebreaker is used to break ties in the final leaderboard when two users have identical points, exact scores, and correct winners. It will be stored in `leagues.config_json`.
