# Ligacup.se — System Architecture

## Overview

Ligacup.se is a fullstack TypeScript monorepo running on a private home server (Proxmox/Portainer) behind a Cloudflare Tunnel. The architecture is designed around three constraints:

1. **Zero cloud cost at launch** — everything runs on owned hardware
2. **Survive goal-event traffic spikes** — 10k–50k concurrent users hitting the same endpoint at the same second
3. **League-agnostic** — pivot from World Cup to Allsvenskan with a DB row change, not a code change

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | ISR for SEO, Server Components, API Routes, massive LLM training data |
| Language | TypeScript | Type safety end-to-end, schema alignment with Drizzle |
| Styling | Tailwind CSS + shadcn/ui | Fastest path to polished Swedish-market UI |
| ORM | Drizzle ORM | Pure TypeScript, no Rust binary, compiles to plain SQL, lightweight in Docker |
| Database | PostgreSQL 16 (Docker) | JSONB for config, full-text search, Drizzle support, battle-tested |
| Cache / Queue | Redis 7 (Docker) | Sorted Sets for leaderboard, Pub/Sub for SSE broadcast, BullMQ for jobs |
| Auth | Clerk | Hosted auth, social login (Google), magic link, webhooks, zero auth code |
| Real-time scores | SSE via Next.js Route Handler | HTTP-native, works through CF Tunnel without config, auto-reconnect |
| Real-time chat | `ws` WebSocket server | Separate lightweight Node.js process, bidirectional |
| Job queue | BullMQ (on Redis) | Point calculation worker, notification dispatch |
| AI (Roast) | Claude API — `claude-haiku-4-5` | Fast, cheap (~$0.00025/roast), Swedish language quality |
| OG Images | `@vercel/og` (Satori) | Pure Node.js, no Puppeteer, cacheable at CF edge |
| Payments | Stripe Checkout | Standard, webhook-driven, no PCI scope |
| File storage | Cloudflare R2 | S3-compatible, zero egress fees |
| Infrastructure | Proxmox → Docker → Portainer | Owned hardware, zero hosting cost |
| CDN / Shield | Cloudflare Tunnel + WAF | Hides home IP, rate limiting, edge cache |
| Monitoring | Grafana + Prometheus (Docker) | Container-native, essential for home server visibility |
| Load testing | k6 | Scripted load tests before each major launch milestone |

---

## Infrastructure Topology

```
Internet
  │
  ▼
Cloudflare (Edge)
  ├── WAF + Rate Limiting (per-IP rules, free tier)
  ├── Cache Rules (static assets: 1yr, API responses: 30–60s)
  └── Cloudflare Tunnel (encrypted, home IP never exposed)
        │
        ▼
      Home Server (Proxmox)
        │
        └── Portainer (Docker management)
              ├── nginx (reverse proxy, container: 80/443)
              │     ├── → next-app:3000 (Next.js app)
              │     └── → ws-server:3001 (WebSocket chat server)
              ├── next-app (Next.js 15, container)
              ├── ws-server (Node.js + ws, container)
              ├── bullmq-worker (point calculation worker, container)
              ├── postgres (PostgreSQL 16, container, volume-mounted)
              ├── redis (Redis 7, container, volume-mounted, AOF persistence)
              ├── grafana (monitoring dashboard, container)
              └── prometheus (metrics scraper, container)
```

---

## Defense Layers Against Traffic Spikes

### Layer 1 — Cloudflare Edge (traffic never reaches home server)

- **Static assets** (JS, CSS, images): cached at edge, 1-year TTL. Zero origin requests.
- **Semi-static API responses** (match schedules, team data): `Cache-Control: s-maxage=60, stale-while-revalidate=30`. A goal-event spike hits edge cache, not origin.
- **Leaderboard endpoint**: `Cache-Control: s-maxage=10`. 10-second stale leaderboard is acceptable during a goal spike.
- **Rate limiting**: `100 req/10s` per IP for API routes, `10 req/10s` for auth endpoints.

### Layer 2 — Redis Read-Aside (cache absorbs 90%+ of reads)

For leaderboards specifically, Redis Sorted Sets serve all reads:
- `ZADD leaderboard:{league_id} {points} {user_id}` — O(log N) write
- `ZREVRANGE leaderboard:{league_id} 0 99 WITHSCORES` — O(log N + 100) top-100 read
- `ZREVRANK leaderboard:{league_id} {user_id}` — O(log N) rank lookup
- Postgres is never queried during the read path at steady state

### Layer 3 — SSE + WS Separation

Separating read-broadcast (SSE) from write-capable connections (WS) means a leaderboard spike doesn't touch the chat server and vice versa. Each service is independently scaled in Portainer.

### Capacity Envelope

| Component | RAM per connection | 10k concurrent | 50k concurrent |
|---|---|---|---|
| SSE (Next.js) | ~2 KB | ~20 MB | ~100 MB |
| WS (chat server) | ~4 KB | ~40 MB | ~200 MB |
| Redis ops | ~1M ops/sec | trivial | trivial |
| Postgres | — | cache absorbs 95% | consider read replica |

**Real bottleneck: ISP upload bandwidth.** At 100 Mbps upload, theoretical max is ~10k SSE connections at 10 KB/s each. Check home ISP upload before launch with `speedtest-cli`.

---

## Failover Strategy

All persistent state lives in Postgres + Redis volumes. Migration to cloud is:
1. `docker compose up` on a Hetzner CX21 (€3.29/month, kept on standby)
2. Restore Postgres dump + Redis AOF snapshot
3. Cloudflare DNS change: Tunnel → Hetzner IP

Target RTO (Recovery Time Objective): < 15 minutes.

---

## Real-time Architecture

### SSE — Score updates, leaderboard rank changes, notifications

```
Match result confirmed
  → BullMQ worker publishes to Redis channel: "events:{league_id}"
  → Next.js SSE Route Handler subscribes to Redis Pub/Sub
  → Pushes event string to all connected SSE clients in that league
  → Client updates leaderboard / shows toast notification
```

Each SSE connection: `GET /api/events?league={id}` — one long-lived HTTP connection per client tab.

### WebSockets — Chat

```
Client connects: ws://ws-server:3001/chat/{league_id}
  → Server validates JWT (Clerk session token passed in query param)
  → Server subscribes this socket to Redis channel: "chat:{league_id}"
  → On incoming message: validate → LPUSH to Redis list → LTRIM → broadcast to channel
  → All subscribers in channel receive message via Redis Pub/Sub
  → Async: BullMQ job persists message to Postgres (non-blocking)
```

---

## Background Job Architecture (BullMQ)

```
Queue: "match-results"
  Job: { matchId, homeScore, awayScore }
  Worker steps:
    1. Fetch all predictions for matchId
    2. Fetch prediction_rules for tournament
    3. Calculate points per user (vectorized, no N+1)
    4. Upsert point_snapshots in Postgres (batch)
    5. ZADD to Redis Sorted Sets for all affected leagues (pipeline)
    6. Publish "leaderboard_updated" SSE event per league
    7. Compare new ranks vs old ranks → dispatch "overtaken" notifications

Queue: "notifications"
  Job: { userId, type, payload }
  Worker: INSERT into notifications table + SSE push if user online

Queue: "chat-persist"
  Job: { message }
  Worker: INSERT into messages table (Postgres cold storage)

Queue: "roast-generate"
  Job: { userId, bracketHash, bracketSummary }
  Worker: Call Claude API → cache in Redis → return via polling or webhook
```

---

## Project Structure (Planned)

```
/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Clerk auth pages
│   ├── (app)/                  # Protected app pages
│   │   ├── dashboard/
│   │   ├── league/[id]/
│   │   ├── predictions/
│   │   └── profile/
│   ├── (public)/               # SEO pages
│   │   ├── vm-2026/
│   │   ├── lag/[slug]/
│   │   └── match/[slug]/
│   └── api/
│       ├── events/             # SSE route handler
│       ├── league/
│       ├── predictions/
│       ├── roast/
│       └── og/                 # OG image generation
├── components/                 # shadcn/ui + custom components
├── lib/
│   ├── db/                     # Drizzle schema + client
│   ├── redis/                  # Redis client + key helpers
│   ├── queue/                  # BullMQ queue definitions
│   └── auth/                   # Clerk helpers
├── workers/                    # BullMQ worker processes
│   ├── match-result.worker.ts
│   ├── notification.worker.ts
│   └── chat-persist.worker.ts
├── ws-server/                  # Standalone WebSocket server
│   └── index.ts
├── docker-compose.yml
├── docs/                       # This folder
└── .env.local
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/ligacup

# Redis
REDIS_URL=redis://redis:6379

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# AI
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# App
NEXT_PUBLIC_APP_URL=https://ligacup.se
WS_SERVER_URL=wss://ligacup.se/chat
```
