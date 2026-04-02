# Ligacup.se — Database Schema

## Design Philosophy

- **Tournament Layer** is separate from the **Social Layer** — tournament logic (matches, rounds, points) is generic; the social layer (leagues, members, predictions) sits on top.
- **Point Snapshots** are the performance keystone — no runtime JOINs for leaderboards. A worker materializes ranks after each match result.
- **Redis mirrors Postgres** for the hot read path. Postgres is the source of truth; Redis is the serving layer.
- **config_json** fields allow format-specific rules without schema migrations when adding new tournament types.

---

## Tables

### `tournaments`

Represents a competition format. One row per tournament instance.

```sql
tournaments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                          -- "VM 2026", "Allsvenskan 2026"
  slug          text NOT NULL UNIQUE,                   -- "vm-2026", "allsvenskan-2026"
  type          text NOT NULL,                          -- WORLD_CUP | LEAGUE | KNOCKOUT | MIXED
  season        text NOT NULL,                          -- "2026"
  status        text NOT NULL DEFAULT 'upcoming',       -- upcoming | active | completed
  config_json   jsonb NOT NULL DEFAULT '{}',            -- format rules (see below)
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
)
```

**`config_json` examples:**

World Cup:
```json
{
  "has_group_stage": true,
  "has_knockout": true,
  "group_size": 4,
  "teams_advance_per_group": 2,
  "total_teams": 32,
  "total_matches": 64
}
```

Allsvenskan:
```json
{
  "has_group_stage": false,
  "has_knockout": false,
  "is_home_away": true,
  "total_teams": 16,
  "total_rounds": 30
}
```

---

### `tournament_rounds`

One row per round (group stage, round of 16, matchweek 1, etc.).

```sql
tournament_rounds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       uuid NOT NULL REFERENCES tournaments(id),
  name                text NOT NULL,              -- "Gruppspel", "Åttondelsfinaler", "Omgång 1"
  round_type          text NOT NULL,              -- GROUP | ROUND_OF_16 | QF | SF | FINAL | REGULAR
  sequence_order      int NOT NULL,               -- 1, 2, 3... for ordering
  prediction_deadline timestamptz,                -- NULL = deadline per match
  created_at          timestamptz NOT NULL DEFAULT now()
)
```

---

### `teams`

All teams across all tournaments. Reused across seasons.

```sql
teams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                    -- "Sverige", "Brazil"
  short_name    text,                             -- "SWE", "BRA"
  slug          text NOT NULL UNIQUE,             -- "sverige", "brazil"
  country_code  char(2),                          -- ISO 3166-1 alpha-2
  logo_url      text,                             -- Cloudflare R2 URL
  created_at    timestamptz NOT NULL DEFAULT now()
)
```

---

### `matches`

One row per fixture.

```sql
matches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id         uuid NOT NULL REFERENCES tournaments(id),
  round_id              uuid NOT NULL REFERENCES tournament_rounds(id),
  home_team_id          uuid REFERENCES teams(id),   -- NULL before knockout draw
  away_team_id          uuid REFERENCES teams(id),
  scheduled_at          timestamptz NOT NULL,
  status                text NOT NULL DEFAULT 'scheduled',  -- scheduled | live | completed | postponed
  home_score            int,                                -- NULL until completed
  away_score            int,
  is_result_confirmed   boolean NOT NULL DEFAULT false,     -- triggers point calculation
  venue                 text,
  group_name            text,                               -- "Group A", NULL for knockout
  match_number          int,                                -- 1–64 for WC
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
)
```

---

### `prediction_rules`

Defines the point system per tournament. One row per tournament (can have variants).

```sql
prediction_rules (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id               uuid NOT NULL REFERENCES tournaments(id),
  points_exact_score          int NOT NULL DEFAULT 3,     -- e.g. predict 2-1, result 2-1
  points_correct_winner       int NOT NULL DEFAULT 1,     -- correct winner but wrong score
  points_correct_draw         int NOT NULL DEFAULT 1,     -- predicted draw, was a draw
  bonus_underdog_multiplier   numeric(3,1) DEFAULT 1.0,   -- future: multiplier for upsets
  applies_to_round_type       text,                       -- NULL = all rounds
  created_at                  timestamptz NOT NULL DEFAULT now()
)
```

---

### `users`

Synced from Clerk via webhook. Clerk is the auth source of truth; this table stores app-specific data.

```sql
users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id            text NOT NULL UNIQUE,           -- Clerk user ID
  email               text NOT NULL,
  username            text UNIQUE,                    -- chosen by user, used in @mentions
  display_name        text,
  avatar_url          text,
  subscription_tier   text NOT NULL DEFAULT 'free',  -- free | pro | team
  stripe_customer_id  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
)
```

---

### `leagues`

A social container. Users compete within a league's private leaderboard.

```sql
leagues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   uuid NOT NULL REFERENCES tournaments(id),
  owner_id        uuid NOT NULL REFERENCES users(id),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  invite_code     char(8) NOT NULL UNIQUE,           -- random 8-char code for joining
  max_members     int NOT NULL DEFAULT 20,            -- 20 free, 100 pro, unlimited team
  is_public       boolean NOT NULL DEFAULT false,
  banner_url      text,                              -- custom banner (Pro feature)
  config_json     jsonb NOT NULL DEFAULT '{}',        -- custom rules, punishment settings
  status          text NOT NULL DEFAULT 'active',    -- active | completed | archived
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

**`config_json` example:**
```json
{
  "punishments": ["Buy drinks for everyone", "Wear rival team jersey for a day"],
  "allow_late_predictions": false,
  "show_predictions_before_deadline": false
}
```

---

### `league_members`

Join table. Tracks who is in which league.

```sql
league_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  custom_alias  text,                                -- optional nickname within league
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE(league_id, user_id)
)
```

---

### `predictions`

One row per user per match. Immutable after `tournament_rounds.prediction_deadline`.

```sql
predictions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  match_id          uuid NOT NULL REFERENCES matches(id),
  home_score_pred   int NOT NULL,
  away_score_pred   int NOT NULL,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
)
```

---

### `point_snapshots` ← The Performance Keystone

Materialized table. Updated by BullMQ worker after each confirmed match result. **Never computed at read time.**

```sql
point_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  league_id         uuid NOT NULL REFERENCES leagues(id),
  tournament_id     uuid NOT NULL REFERENCES tournaments(id),
  total_points      int NOT NULL DEFAULT 0,
  rank_in_league    int,                              -- NULL until first calculation
  matches_played    int NOT NULL DEFAULT 0,
  exact_scores      int NOT NULL DEFAULT 0,           -- stat: how many exact scores
  correct_winners   int NOT NULL DEFAULT 0,
  last_match_id     uuid REFERENCES matches(id),      -- last match that affected this
  computed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, league_id)
)
```

**Update flow:**
```
Admin marks match as confirmed
  → BullMQ job: "match-results" queue
  → Worker: batch-fetch all predictions for match
  → Worker: calculate points per prediction_rules
  → Worker: UPDATE point_snapshots SET total_points = total_points + delta, computed_at = now()
  → Worker: re-rank all users in affected leagues (UPDATE SET rank_in_league = ...)
  → Worker: ZADD Redis leaderboard:{league_id} {total_points} {user_id} (pipeline)
  → Worker: publish SSE event to all league members
```

---

### `messages`

Persistent chat history. Redis holds the hot last-200; this is cold storage for pagination.

```sql
messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   uuid NOT NULL REFERENCES leagues(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  text        text NOT NULL,
  mentions    uuid[] NOT NULL DEFAULT '{}',       -- array of mentioned user IDs
  reply_to    uuid REFERENCES messages(id),
  reactions   jsonb NOT NULL DEFAULT '{}',        -- {"🔥": ["user_id1"], "😂": ["user_id2"]}
  created_at  timestamptz NOT NULL DEFAULT now(),
  is_deleted  boolean NOT NULL DEFAULT false
)

CREATE INDEX messages_league_created ON messages(league_id, created_at DESC);
```

---

### `notifications`

```sql
notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  type        text NOT NULL,   -- rank_overtaken | mention | league_invite | match_starting
  payload     jsonb NOT NULL DEFAULT '{}',
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
)

CREATE INDEX notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
```

---

### `punishments`

```sql
punishments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id         uuid NOT NULL REFERENCES leagues(id),
  user_id           uuid NOT NULL REFERENCES users(id),     -- loser
  punishment_text   text NOT NULL,
  witness_ids       uuid[] NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'pending',        -- pending | confirmed | disputed
  confirmed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
)
```

---

## Redis Key Patterns

| Key | Type | Content | TTL |
|---|---|---|---|
| `leaderboard:{league_id}` | Sorted Set | score=points, member=user_id | None (persistent) |
| `chat:{league_id}` | List | JSON message objects (last 200) | 30 days |
| `roast:{user_id}:{bracket_hash}` | String | Generated roast text | 24 hours |
| `events:{league_id}` | Pub/Sub channel | SSE event strings | — |
| `chat:{league_id}:ch` | Pub/Sub channel | WS broadcast channel | — |
| `rate:{user_id}:roast` | String | Counter | 24 hours |
| `rate:{ip}:api` | String | Counter | 10 seconds |
| `session:{user_id}` | Hash | Online status, last seen | 5 minutes |

---

## Indexes

```sql
-- Core read paths
CREATE INDEX predictions_user ON predictions(user_id);
CREATE INDEX predictions_match ON predictions(match_id);
CREATE INDEX point_snapshots_league ON point_snapshots(league_id, total_points DESC);
CREATE INDEX matches_tournament_scheduled ON matches(tournament_id, scheduled_at);
CREATE INDEX matches_round ON matches(round_id);
CREATE INDEX league_members_user ON league_members(user_id);
CREATE INDEX league_members_league ON league_members(league_id);

-- Admin / worker paths
CREATE INDEX matches_confirmed ON matches(is_result_confirmed) WHERE is_result_confirmed = false;
CREATE INDEX notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
```

---

## League-Agnostic Pivot: What Changes for Allsvenskan

| | World Cup 2026 | Allsvenskan 2026 |
|---|---|---|
| `tournaments.type` | `WORLD_CUP` | `LEAGUE` |
| `tournament_rounds` rows | ~5 (group + knockouts) | 30 (matchweeks) |
| `config_json` | has_group_stage: true | has_group_stage: false |
| `prediction_rules` | 3pts exact / 1pt winner | configurable |
| Frontend bracket UI | Shows bracket tree | Shows linear table |
| Everything else | Identical | Identical |

**No code changes. Only data changes.**
