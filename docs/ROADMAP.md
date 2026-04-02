# Ligacup.se — 10-Week Roadmap to World Cup Kickoff

**World Cup 2026 start:** ~June 11, 2026  
**Today:** April 2, 2026  
**Time remaining:** ~10 weeks  
**Rule:** Ship working software every week. No dark periods.

---

## The Non-Negotiables (Day 1)

Before any user can meaningfully use the product, these must exist:

- [ ] User can sign up and log in
- [ ] User can see all World Cup matches with dates and teams
- [ ] User can predict scores for group stage matches
- [ ] User can create a private league and get an invite link
- [ ] User can join a league via invite link
- [ ] Leaderboard shows correct rankings after a result is entered
- [ ] Admin can enter match results

Everything else is growth. These are survival.

---

## Week 1 — Week of April 6: Foundation

**Goal:** Working app deployed at ligacup.se. Nothing fancy, but it runs.

### Infrastructure
- [ ] Init Next.js 15 repo (`create-next-app`, TypeScript, Tailwind, App Router)
- [ ] `docker-compose.yml`: Postgres + Redis + App container
- [ ] Portainer stack deployed on home server
- [ ] Cloudflare Tunnel connected, `ligacup.se` resolves to home server
- [ ] Nginx reverse proxy configured (HTTP → HTTPS, proxy_pass to Next.js)
- [ ] Environment variables in `.env.local` + Portainer secrets
- [ ] Basic Grafana + Prometheus setup (know when the server is dying)

### Auth
- [ ] Clerk account created, keys added to env
- [ ] `<ClerkProvider>` in root layout
- [ ] `/sign-in` and `/sign-up` pages (Clerk components)
- [ ] Middleware: protect `/dashboard` and `/league` routes
- [ ] Clerk webhook → sync user to `users` table on signup

### Database
- [ ] Drizzle ORM configured (`drizzle.config.ts`, `db/schema.ts`)
- [ ] Schema: `tournaments`, `tournament_rounds`, `teams`, `matches`, `prediction_rules`
- [ ] Migration: `drizzle-kit push` or migration file
- [ ] Seed script: all 32 WC 2026 teams, all 8 groups, all 48 group stage matches
  - Match data source: FIFA official schedule (hardcode it — it won't change)

### Basic UI
- [ ] Root layout: header (logo, nav, auth button), dark background
- [ ] Landing page `/`: hero text, "Skapa tipslag" CTA, "Hur funkar det?" section
- [ ] Dashboard skeleton (empty state with "Create or join a league" CTA)

**Milestone:** `ligacup.se` loads, user can sign up, sees an empty dashboard.

---

## Week 2 — Week of April 13: Predictions & Leagues

**Goal:** Core gameplay loop is complete. A user can predict and see a leaderboard.

### Predictions
- [ ] Schema: `predictions` table, migration
- [ ] `/predictions` page: list all group stage matches grouped by round/date
- [ ] `<MatchCard />` component: team logos, date, score input, save button
- [ ] `POST /api/predictions` endpoint: upsert prediction, validate deadline
- [ ] Deadline enforcement: lock prediction when `match.scheduled_at` has passed
- [ ] Show prediction state on card (predicted / not predicted / locked)

### League System
- [ ] Schema: `leagues`, `league_members`, migration
- [ ] `/league/new` page: form (name, tournament), create league
- [ ] Auto-generate invite code (8 random chars, unique)
- [ ] `/join/{code}` page: league preview + join button
- [ ] `POST /api/league` and `POST /api/league/join`
- [ ] `/league/{id}` page: member list, leaderboard (empty until results)

### Admin
- [ ] `/admin` route: basic password protection (env var `ADMIN_PASSWORD`)
- [ ] `/admin/matches`: list all matches, result entry form (home score, away score, confirm button)
- [ ] `POST /api/admin/result`: update match, set `is_result_confirmed = true`

### Point Calculation (synchronous for now)
- [ ] On result confirmation: calculate points for all predictions for that match
- [ ] Upsert `point_snapshots` table (add to `DATABASE.md` schema for this)
- [ ] Leaderboard on `/league/{id}` reads from `point_snapshots` (Postgres query, no Redis yet)

**Milestone:** Full loop works. User signs up → creates league → sends invite → friend joins → both predict → admin enters result → leaderboard shows correct ranks.

---

## Week 3 — Week of April 20: Social & Real-time Foundation

**Goal:** The app feels alive. Updates happen without page refresh.

### SSE — Live Updates
- [ ] `/api/events` Route Handler: streaming SSE response
- [ ] Redis Pub/Sub subscription in SSE handler
- [ ] Client-side `useSSE()` hook
- [ ] BullMQ queue: `match-results` (replace synchronous calculation from Week 2)
- [ ] Worker: calculate points → update `point_snapshots` → ZADD Redis → PUBLISH SSE event
- [ ] Client: leaderboard re-renders on `leaderboard_updated` SSE event (no page refresh)

### Redis Leaderboard
- [ ] Redis Sorted Set populated on every point update
- [ ] Leaderboard endpoint reads from Redis (`ZREVRANGE`) instead of Postgres JOIN
- [ ] Fallback to Postgres if Redis key missing (cold start)

### Match Score Updates
- [ ] Admin can update score during a live match (intermediate, not confirmed)
- [ ] SSE event: `match_score` pushed to clients
- [ ] Live score ticker component at top of app during active matches

### Notifications (basic)
- [ ] `notifications` table, migration
- [ ] BullMQ `notifications` worker
- [ ] Notification bell icon in header: unread count badge
- [ ] `/notifications` page: list of recent notifications

**Milestone:** Goal scored → admin updates score → all clients see update within 2 seconds without refresh.

---

## Week 4 — Week of April 27: Chat

**Goal:** League chat is live. Social layer is complete.

### WebSocket Server
- [ ] `/ws-server` Node.js app with `ws` library
- [ ] Dockerfile for WS server
- [ ] Portainer: add WS server as second container in stack
- [ ] Nginx: proxy `/chat` WebSocket upgrade to WS server
- [ ] JWT validation on WS connect (Clerk `verifyToken`)

### Chat Features
- [ ] Redis: `LPUSH/LTRIM/EXPIRE` on new message, `LRANGE` on join
- [ ] `messages` table for persistence (BullMQ `chat-persist` worker)
- [ ] `<ChatRoom />` component: message list, input bar
- [ ] `/league/{id}/chat` page
- [ ] Chat tab in league navigation
- [ ] @mention parsing: highlight in text, resolve to user IDs
- [ ] BullMQ: mention triggers notification
- [ ] Emoji reactions: click to add/remove, live reaction count updates

### "Overtaken" Notifications
- [ ] After rank recalculation: detect rank changes
- [ ] Enqueue notification for overtaken users
- [ ] SSE push: `rank_overtaken` event
- [ ] Toast component in app: "Kalle gick om dig! Du är nu #6"

**Milestone:** League members can chat in real-time. Getting overtaken triggers a toast notification.

---

## Week 5 — Week of May 4: Bracket & Visual Polish

**Goal:** Knockout bracket is playable. Mobile experience is polished.

### Knockout Stage Predictions
- [ ] Schema: add support for knockout match predictions (teams may be TBD)
- [ ] `/predictions/bracket` page: bracket visualization
- [ ] `<BracketTree />` component (SVG, interactive)
- [ ] Predictions lock when round starts; bracket advances as results come in
- [ ] Bonus points for predicting correct advancing teams

### Mobile Polish
- [ ] Bottom tab navigation on mobile (Dashboard, Predictions, League, Chat, Profile)
- [ ] Match card touch targets are large enough (44px minimum)
- [ ] Prediction input works with mobile number keyboard
- [ ] Chat input doesn't get covered by mobile keyboard (CSS `dvh` viewport units)
- [ ] PWA `manifest.json` + icons

### Profile & Public Pages
- [ ] `/profile` page: edit display name, avatar, username
- [ ] `/u/{username}` public profile: stats, league count
- [ ] `/lag/{slug}` team SEO page (all 32 teams, ISR)
- [ ] `/match/{slug}` match SEO page (ISR 5-min)

**Milestone:** Knockout stage predictions work. App feels native on mobile.

---

## Week 6 — Week of May 11: Growth Features

**Goal:** Virality mechanics are live. Users share outside the app.

### AI Roast
- [ ] Anthropic SDK installed, `ANTHROPIC_API_KEY` configured
- [ ] `POST /api/roast` endpoint
- [ ] Bracket hash computation (sha256 of predictions JSON)
- [ ] Redis cache for roast result
- [ ] Rate limiting (3/day, Redis counter)
- [ ] "Rota Min Bracket" button on predictions page
- [ ] Roast modal with share button

### Brag Cards
- [ ] Client-side Canvas generation (`<BragCard />` component)
- [ ] Download PNG button
- [ ] Web Share API integration (mobile)
- [ ] Server-side OG image: `/api/og/user/{id}` via Satori
- [ ] Cache at Cloudflare edge (5-minute TTL via `Cache-Control`)

### Punishment Wheel
- [ ] League config: punishment list in `leagues.config_json`
- [ ] `/league/{id}/punishments` page
- [ ] CSS animated wheel component
- [ ] `punishments` table, migration
- [ ] `/punished/{id}` public page (shareable URL)
- [ ] OG image for punishment page

**Milestone:** User shares roast on Instagram Stories. Someone clicks the link, signs up.

---

## Week 7 — Week of May 18: Monetization

**Goal:** Pro subscription is live and working.

### Stripe Integration
- [ ] Stripe account, products and prices configured (Pro monthly, Pro season, Team monthly)
- [ ] `POST /api/stripe/checkout` endpoint
- [ ] `POST /api/stripe/webhook` endpoint (signature validation)
- [ ] Handle: `checkout.session.completed`, `customer.subscription.deleted`
- [ ] `/profile/subscription` page: current plan, upgrade/downgrade, billing portal link
- [ ] Tier enforcement in API routes (`checkSubscription()` helper)
- [ ] Member count gate: free tier blocks creating league > 20 members

### Affiliate Links
- [ ] Static affiliate link config (partner name, URL with btag, logo)
- [ ] `<AffiliateBanner />` component
- [ ] Shown on match pages (below match info)
- [ ] "Annons" / "18+" disclaimer included
- [ ] Not shown to Pro tier users (ad-free)

**Milestone:** Test end-to-end: sign up → upgrade to Pro → confirm tier change in DB.

---

## Week 8 — Week of May 25: SEO, Load Testing & Beta Launch

**Goal:** Ranking for "VM-tips 2026". Server survives load. Beta users onboarded.

### SEO
- [ ] `/vm-2026` hub page with ISR (5-min revalidation)
- [ ] `sitemap.xml` including all team and match slugs
- [ ] JSON-LD `SportsEvent` structured data on match pages
- [ ] `<html lang="sv">` confirmed
- [ ] OG images on all public pages
- [ ] Submit sitemap to Google Search Console
- [ ] 3 blog posts: "VM-tips 2026 – allt du behöver veta", "Hur skapar jag ett tipslag?", "Poängsystem förklarat"

### Load Testing
- [ ] k6 script: 1,000 concurrent SSE connections, 500 concurrent API requests
- [ ] Run test, measure: p50/p99 latency, Redis memory, Postgres connections, CPU
- [ ] Cloudflare rate limiting rules verified (block before origin)
- [ ] Tune: Redis connection pool size, Postgres `max_connections`, Node.js memory limit in Portainer

### Beta Launch
- [ ] Invite 50–100 beta users (friends, colleagues, football forums)
- [ ] Bug fix sprint based on beta feedback
- [ ] Error monitoring: Sentry (free tier, 5k errors/month)
- [ ] Uptime monitoring: Better Stack or UptimeRobot (free, 3-min checks, SMS alert)

---

## Week 9–10 — June 1–11: Final Sprint & Go Live

- [ ] All beta feedback addressed
- [ ] Hetzner CX21 spun up as hot standby (€3.29/month), Postgres dump + Redis snapshot configured for restore
- [ ] Post in r/Svenska, Flashback fotboll subforum, Twitter/X football communities
- [ ] Content creator outreach (football YouTube/TikTok creators who cover VM)
- [ ] Monitor server during early matches, be online for Sweden games

**June 11: World Cup kicks off.**

---

## Post-Launch (After Kickoff)

- Allsvenskan 2026 league configuration (add tournament row, 30 rounds)
- Advanced stats dashboard (Pro feature)
- External match data API integration (auto score updates)
- Push notifications (PWA VAPID)
- League discovery / public leagues
- Native iOS/Android app (if growth justifies it)

---

## Definition of "Done" Per Feature

A feature is done when:
1. It works end-to-end in the Docker container on the home server
2. It works on a real mobile browser (Safari iOS, Chrome Android)
3. It doesn't break any existing feature
4. Error states are handled (network down, invalid input, unauthorized)

No feature is "done" if it only works on localhost or only on desktop.
