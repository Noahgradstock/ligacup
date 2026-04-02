# Ligacup.se — Feature Specification

## Priority Tiers

- **P0 — Day 1:** Must exist at launch. Without these, the product doesn't function.
- **P1 — Week 2:** Core social features. Without these, users don't return.
- **P2 — Week 4:** Engagement & growth. Drive retention and virality.
- **P3 — Week 6+:** Monetization, polish, and lifecycle features.

---

## P0 — Day 1 Features

### Authentication
- Email + password signup / login (via Clerk)
- Google OAuth (one-click signup)
- Magic link login (email)
- Username selection after first login
- Profile: display name, avatar upload (Cloudflare R2)
- Session persistence (stay logged in)

### Tournament & Match Display
- Show all 48 World Cup group stage matches (date, time, teams, venue)
- Match status indicator: Upcoming / Live / Completed
- Group standings table (auto-calculated from confirmed results)
- Team pages: flag, name, group, results

### Predictions — Group Stage
- Predict score for each of the 48 group stage matches
- Deadline enforcement: predictions locked when match starts
- Edit prediction until deadline
- Visual indicator: locked / editable / not yet predicted
- Show your prediction vs. actual result post-match
- Points awarded per match: exact score = 3pts, correct winner = 1pt, correct draw = 1pt

### Private League System
- Create a league (name, optionally link to a tournament)
- Auto-generate 8-character invite code
- Join league via invite code or invite link (`ligacup.se/join/{code}`)
- View all your leagues on dashboard
- League member list (avatar, name, points)

### Leaderboard
- League-scoped leaderboard: rank, name, points, last match delta
- Global tournament leaderboard (opt-in public leagues)
- Your rank highlighted
- Update after each confirmed match result (async worker)

### Basic Admin Panel
- Password-protected admin route (`/admin`)
- Manually enter match results (home score, away score)
- Confirm result → triggers point calculation worker
- View pending / confirmed matches

---

## P1 — Week 2 Features

### Social — Invite Flow
- Share invite link (copy to clipboard + Web Share API on mobile)
- League invite preview page: league name, member count, owner name, join CTA
- Email invite (optional, Resend API)

### Predictions — Knockout Stage
- After group stage: predict bracket (Round of 16 → Final)
- Dynamic: bracket updates as real results come in
- Bonus points for predicting correct advancing teams
- Bracket visualization: interactive tree view

### Live Match Feed
- SSE-powered live score ticker (top of app during active matches)
- "Match starting in X minutes" notification
- Real-time score update during live matches (feed from admin or external API)

### Points History
- Per-user, per-match breakdown: what you predicted, what happened, how many points
- Running total graph (sparkline chart)
- Best and worst predictions callout

### Profile Page
- Your stats: total points, rank across all leagues, exact scores count
- Joined leagues list
- Public profile URL: `ligacup.se/u/{username}`

---

## P2 — Week 4 Features

### Real-time Chat
- League-scoped chat room (one per league)
- Messages: text, @mentions, emoji reactions, reply-to-message
- Last 200 messages served from Redis on room join
- Older messages paginated from Postgres
- @mention: triggers notification to mentioned user
- Message rate limit: 5 messages per 10 seconds per user
- Basic moderation: league owner can delete messages

### "Overtaken" Notifications
- Push notification (via SSE) when another user overtakes your rank in a league
- Toast notification in-app: "Kalle just overtook you in [League Name]! You're now #6"
- Rate limited: max 1 per match per user pair (no spam during multi-goal match)
- Notification bell: unread count badge, notification list

### AI Roast — "Roast My Bracket"
- Button on user's bracket/predictions page
- Server sends structured bracket summary to Claude API
- Returns a 2–3 sentence Swedish-language roast of their worst predictions
- Cached per bracket state (bracket_hash in Redis, 24h TTL)
- Rate limited: 3 roasts per day per user
- Share button: pre-populated text + link to profile

### Visual Brag Cards
- "Brag Card" generated client-side via Canvas API
- Shows: rank, league name, points, username, tournament logo, "Top X%" badge
- Download as PNG or share via Web Share API
- OG image version (server-side via Satori) for link preview when shared

### Punishment Wheel
- League owner configures punishment list (text strings)
- End-of-tournament: "Spin the Wheel" page
- Animated CSS wheel, spin triggers random punishment selection
- Result stored in `punishments` table
- Shareable punishment URL: `/punished/{id}` — public page, anyone can view
- "I witnessed this" button for league members to confirm punishment completion
- OG image for the punishment page (shareable as a story/post)

---

## P3 — Week 6+ Features

### Stripe Pro Subscription
- Free tier: 1 league, max 20 members, standard features
- Pro (99 SEK/month or 599 SEK/season): unlimited members, custom league banner, advanced stats, CSV export, ad-free, priority chat
- Team (299 SEK/month): covers league owner + 100 members
- Stripe Checkout redirect, webhook-driven tier update
- Subscription management page (cancel, upgrade, invoice download)

### Advanced Stats Dashboard (Pro)
- Points per round chart
- Head-to-head comparison vs. specific league member
- "Prediction accuracy" metric (correct/total %)
- Best-predicted match types (home wins, draws, away wins)
- Lucky streaks

### SEO Content Pages
- `/vm-2026` — hub page, ISR 5-min
- `/lag/{slug}` — team page per WC team (32 pages), ISR 1-hour
- `/match/{slug}` — match page with prediction form + result, ISR 5-min
- `/hur-funkar-tipslag` — how it works (static)
- `/poang-vm-2026` — points system explained (static)
- Blog posts targeting "VM-tips 2026" and "Allsvenskan tips" keywords

### Affiliate Integration
- "Se odds hos [Partner]" contextual banner on match pages
- Links use affiliate UTM + partner ID
- Clearly labeled as "Partner" — never embedded in prediction UI
- Supported partners: Unibet, Betsson, (add per CPA agreements)

### External Match Data Integration
- Connect to a football data API (e.g., API-Football, SportMonks) for:
  - Automatic score updates during live matches
  - Automatic match schedule import
  - Team/player data
- Admin panel: manual override always available

### League Discovery
- Public leagues: searchable by name or tournament
- "Join a public league" landing page for new users without an invite
- Featured leagues (hand-curated by admin)

### Allsvenskan / Multi-Tournament Support
- "Create a league for Allsvenskan 2026" flow (same UI, new tournament row)
- Tournament switcher on dashboard
- All P0–P2 features work identically for any tournament

---

## Feature Constraints by Subscription Tier

| Feature | Free | Pro | Team |
|---|---|---|---|
| Max leagues (owned) | 1 | 10 | Unlimited |
| Max members per league | 20 | 100 | Unlimited |
| Custom league banner | ❌ | ✅ | ✅ |
| Advanced stats | ❌ | ✅ | ✅ |
| CSV export | ❌ | ✅ | ✅ |
| Ad-free | ❌ | ✅ | ✅ |
| Priority chat | ❌ | ✅ | ✅ |
| AI Roast | 3/day | 10/day | 20/day |
| Brag Cards | ✅ | ✅ | ✅ |
| Punishment Wheel | ✅ | ✅ | ✅ |

---

## Out of Scope (Never Building)

- Handling money, stakes, or payouts — users handle privately via Swish
- Live video or match streaming
- Fantasy team management (player picks) — prediction-only
- Social media accounts integration (post to Twitter/Instagram automatically)
- Native mobile app (PWA is sufficient for MVP)
