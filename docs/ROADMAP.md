# Ligacup.se — Build Plan

**World Cup 2026 start:** June 11, 2026
**Rule:** Ship working software. No dark periods.

---

## The Non-Negotiables

Before any user can meaningfully use the product, these must exist:

- [x] User can sign up and log in
- [x] User synced to database on sign-up
- [x] Dashboard skeleton
- [ ] User can see all World Cup matches with dates and teams
- [ ] User can predict scores for group stage matches
- [ ] User can create a private league and get an invite link
- [ ] User can join a league via invite link
- [ ] Leaderboard shows correct rankings after a result is entered
- [ ] Admin can enter match results

---

## Infrastructure

- [x] Next.js 15 repo (TypeScript, Tailwind, App Router)
- [x] `docker-compose.yml`: Postgres + Redis + App container
- [x] Portainer stack deployed on home server
- [x] Clerk auth pages + middleware
- [x] Drizzle ORM schema + migration generated
- [ ] `db:push` run on server (apply schema)
- [ ] `db:seed` run on server (WC 2026 data)
- [ ] Clerk webhook `CLERK_WEBHOOK_SECRET` set in Portainer
- [ ] Grafana + Prometheus (know when the server is dying)

---

## Auth

- [x] Clerk sign-in / sign-up pages
- [x] Middleware protecting `/dashboard`, `/league`, `/predictions`, `/admin`
- [x] Clerk webhook → sync user to `users` table on signup

---

## Database

- [x] Drizzle ORM + schema (13 tables)
- [x] Migration file generated
- [ ] `db:push` on server
- [ ] `db:seed` — 32 teams, 8 groups, 48 group stage matches

---

## Predictions

- [ ] `/predictions` page: all group stage matches grouped by date
- [ ] `<MatchCard />`: team names, date, score input, save button
- [ ] `POST /api/predictions`: upsert prediction, validate deadline
- [ ] Deadline enforcement: lock when `match.scheduled_at` has passed
- [ ] Show prediction state on card (predicted / not predicted / locked)

---

## League System

- [ ] `/league/new` page: form (name), create league
- [ ] Auto-generate 8-char invite code
- [ ] `/join/[code]` page: league preview + join button
- [ ] `POST /api/leagues` and `POST /api/leagues/join`
- [ ] `/league/[id]` page: member list + leaderboard (empty until results)

---

## Admin

- [ ] `/admin` route: env-var password protection
- [ ] `/admin/matches`: list all matches, result entry form
- [ ] `POST /api/admin/result`: update match, set `is_result_confirmed = true`
- [ ] On confirmation: calculate points for all predictions for that match
- [ ] Upsert `point_snapshots`

---

## Real-time & Social

- [ ] SSE `/api/events` route
- [ ] Redis Pub/Sub → SSE push on leaderboard update
- [ ] BullMQ `match-results` queue (replace sync point calc)
- [ ] Worker: calc points → update `point_snapshots` → ZADD Redis → PUBLISH SSE
- [ ] Redis Sorted Set leaderboard (`ZREVRANGE`)
- [ ] Leaderboard re-renders on `leaderboard_updated` SSE event
- [ ] Live score ticker during active matches
- [ ] Notifications table + BullMQ worker
- [ ] Notification bell in header

---

## Chat

- [ ] WebSocket server (`/ws-server` Node app)
- [ ] Nginx proxy WebSocket upgrade
- [ ] JWT validation on WS connect (Clerk `verifyToken`)
- [ ] Redis message buffer + `messages` table persistence
- [ ] `<ChatRoom />` component
- [ ] `/league/[id]/chat` page
- [ ] @mentions + emoji reactions
- [ ] "Overtaken" toast notification

---

## Bracket & Mobile

- [ ] Knockout stage prediction schema
- [ ] `/predictions/bracket` page + `<BracketTree />` (SVG)
- [ ] Bracket advances as results come in
- [ ] Bottom tab nav on mobile
- [ ] PWA `manifest.json` + icons
- [ ] `/profile` page: edit display name, avatar
- [ ] `/u/[username]` public profile

---

## Growth

- [ ] AI Roast: `POST /api/roast`, Anthropic SDK, rate limit 3/day
- [ ] Brag card: Canvas PNG + Web Share API
- [ ] Server-side OG images via Satori
- [ ] Punishment wheel: `/league/[id]/punishments`

---

## Monetization

- [ ] Stripe checkout + webhook
- [ ] Pro tier enforcement in API routes
- [ ] Member count gate (free: max 20 members)
- [ ] Affiliate banner on match pages (hidden for Pro)

---

## SEO & Launch

- [ ] `/vm-2026` hub page (ISR)
- [ ] `sitemap.xml`
- [ ] JSON-LD `SportsEvent` on match pages
- [ ] OG images on all public pages
- [ ] k6 load test (1,000 concurrent SSE, 500 API)
- [ ] Sentry error monitoring
- [ ] Uptime monitoring (Better Stack / UptimeRobot)
- [ ] Submit sitemap to Google Search Console

---

## Definition of Done

A feature is done when:
1. It works end-to-end in the Docker container on the home server
2. It works on a real mobile browser
3. It doesn't break any existing feature
4. Error states are handled
