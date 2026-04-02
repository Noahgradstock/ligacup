# Ligacup.se — UI & Design System

## Design Philosophy

- **Mobile-first, always.** 80%+ of users will be on phones during matches.
- **Speed over decoration.** Every interaction must feel instant. Skeleton loaders, optimistic updates, no full-page reloads.
- **Swedish market aesthetic.** Clean, modern, confident. Not garish betting-site energy. Think Blocket meets ESPN — functional and trusted.
- **Dark mode default.** Sports apps are consumed in dark environments (stadiums, evenings, pubs).

---

## Brand Identity

| | Value |
|---|---|
| **Primary color** | `#1A73E8` — strong blue (confidence, authority) |
| **Accent color** | `#FFD700` — gold (winner energy, premium feel) |
| **Background** | `#0F0F11` — near-black (dark mode default) |
| **Surface** | `#1C1C1F` — card backgrounds |
| **Border** | `#2C2C30` — subtle dividers |
| **Text primary** | `#F5F5F7` — off-white |
| **Text secondary** | `#8E8E93` — muted labels |
| **Success** | `#30D158` — correct prediction indicator |
| **Warning** | `#FF9F0A` — partial credit (correct winner) |
| **Error / Red** | `#FF3B30` — wrong prediction, alerts |
| **Font** | Inter (system-ui fallback) — clean, readable |

---

## Component Library

Built on **shadcn/ui** (Radix UI primitives + Tailwind). Custom components extend this base.

### Core Components

**`<LeaderboardTable />`**  
- Columns: Rank | Avatar + Name | Points | Delta (last match) | Trend arrow
- Current user row is highlighted (blue-tinted background)
- Top 3 rows: gold / silver / bronze accents
- Virtualized for 100+ members (use `@tanstack/react-virtual`)
- Skeleton state while loading

**`<MatchCard />`**  
- Team logos (flags), team names, date/time
- States: `upcoming` (prediction form), `live` (live score), `completed` (result + your prediction)
- Points badge top-right when completed: green (points earned) or empty
- Compact mode for lists, expanded mode for detail view

**`<PredictionInput />`**  
- Two number inputs side by side: [Home] – [Away]
- Stepper buttons (+/-) for touch usability
- Locked state: grayed out with lock icon when deadline passed
- Confirm button with optimistic update

**`<BracketTree />`**  
- SVG-based bracket visualization
- Left side: top half of draw; right side: bottom half; center: final
- Clickable match nodes open prediction modal
- Responsive: scrollable on mobile, full-width on desktop
- Animated transitions when teams advance

**`<ChatRoom />`**  
- Fixed-height scrollable message list (reverse scroll, newest at bottom)
- Message: avatar + username + timestamp + text
- @mention highlight in message text
- Reply-to: quoted message above reply
- Emoji reaction bar on long-press/hover
- Input bar pinned to bottom with @mention autocomplete
- Unread count badge on chat tab

**`<NotificationToast />`**  
- Appears top-right (or bottom on mobile)
- Types: rank overtaken (red), @mention (blue), match starting (orange)
- Auto-dismiss after 5s, dismissable
- Stacks up to 3 at once

**`<PunishmentWheel />`**  
- CSS-animated spinning wheel (segments colored, labeled)
- "Spin" button triggers CSS animation + result selection
- Result card slides up with punishment text + share button
- Confetti burst on spin completion (canvas-confetti)

**`<BragCard />`**  
- Canvas-rendered image (or hidden `<div>` → html2canvas)
- Template: dark background, gold "TOP X%" badge, rank, username, points, league name, Ligacup logo
- Download PNG button, Share button (Web Share API)

---

## Pages & Routes

### Public (no auth required)

| Route | Page | Purpose |
|---|---|---|
| `/` | Landing page | Hero, how it works, CTA to sign up |
| `/vm-2026` | Tournament hub | SEO hub for World Cup, match schedule, group standings |
| `/lag/{slug}` | Team page | Team info, results, prediction stats — SEO |
| `/match/{slug}` | Match page | Preview/result, community prediction distribution — SEO |
| `/join/{code}` | League invite | Preview league, join CTA |
| `/punished/{id}` | Punishment page | Public punishment display, witness CTA |
| `/u/{username}` | Public profile | User's stats, leagues (if public), brag card |
| `/hur-funkar-det` | How it works | Static explainer for new users |

### Auth (Clerk-handled)

| Route | Page |
|---|---|
| `/sign-in` | Sign in page |
| `/sign-up` | Sign up page |

### App (auth required)

| Route | Page | Description |
|---|---|---|
| `/dashboard` | Dashboard | League overview, upcoming matches, unread notifications |
| `/predictions` | My Predictions | All matches for active tournament, prediction form |
| `/predictions/bracket` | Bracket | Knockout stage bracket view + predictions |
| `/league/new` | Create League | Form to create a new league |
| `/league/{id}` | League Home | Leaderboard, members, recent activity |
| `/league/{id}/chat` | League Chat | Full chat room |
| `/league/{id}/stats` | League Stats | Per-user stats breakdown (Pro feature) |
| `/league/{id}/punishments` | Punishment Wheel | Post-tournament punishment spin |
| `/profile` | My Profile | Edit display name, avatar, username |
| `/profile/subscription` | Subscription | Stripe plan management |
| `/notifications` | Notifications | Full notification list |

### Admin (password-protected)

| Route | Page |
|---|---|
| `/admin` | Admin dashboard |
| `/admin/matches` | Match list + result entry |
| `/admin/tournaments` | Tournament management |
| `/admin/users` | User overview |

---

## Key UX Flows

### New User Onboarding

```
Landing page
  → Sign up (email or Google)
  → Username selection (modal)
  → "Do you have an invite code?" (yes → join league | no → create or browse)
  → League home (leaderboard, predictions CTA)
  → Predictions page (fill in group stage)
```

### Submitting a Prediction

```
Match card (upcoming state)
  → Tap to expand / inline input
  → Enter home score [+/-] away score [+/-]
  → "Spara" (Save) button
  → Optimistic update: card shows your prediction immediately
  → Background: POST /api/predictions
  → Confirmed: tick animation
  → If deadline passed: locked state shown, prediction not submittable
```

### Goal Event Experience

```
Match status changes to "live" via SSE
  → Live score ticker appears at top of all pages
  → Score updates in real-time (SSE push)
  → On full-time: points calculated (async worker, ~5s delay)
  → SSE event: "leaderboard_updated"
  → Leaderboard re-renders with new points + rank changes
  → Toast: "Kalle just overtook you! You're now #6" (if applicable)
  → Your match card shows result + points earned (green badge)
```

### Creating and Sharing a League

```
/league/new
  → Enter league name
  → Select tournament (VM 2026 / Allsvenskan 2026 / etc.)
  → "Skapa tipslag" button
  → League created → shown invite link + invite code
  → "Kopiera länk" button → navigator.clipboard.writeText()
  → "Dela" (Share) → Web Share API on mobile
  → League home with just yourself on leaderboard
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 640px | Single column, tab navigation at bottom |
| Tablet | 640px–1024px | Two-column in some views, sidebar begins to appear |
| Desktop | > 1024px | Full sidebar + main content + optional right panel |

**Navigation pattern:**
- Mobile: Bottom tab bar (Dashboard, Predictions, League, Chat, Profile)
- Desktop: Left sidebar (collapsible)

---

## Animation & Motion

- **Page transitions:** Fade + slight slide (100ms) — fast, not distracting
- **Optimistic updates:** Immediate visual change, no wait state on predictions
- **Leaderboard rank change:** Number animates from old rank to new rank (spring animation)
- **Toast notifications:** Slide in from corner, fade out
- **Punishment wheel:** CSS `transform: rotate()` animation, cubic-bezier for deceleration
- **Match card expand:** Smooth height transition (Framer Motion `layout` prop)
- **Confetti:** `canvas-confetti` on: first prediction submitted, top 10% achievement, exact score hit

---

## Accessibility

- All interactive elements keyboard-navigable
- `aria-label` on all icon-only buttons
- Color is never the sole differentiator (icons + text always accompany color coding)
- Focus rings visible (Tailwind `focus-visible:` utilities)
- Text contrast ratios meet WCAG AA (4.5:1 minimum)
- Swedish as primary language, `<html lang="sv">`

---

## SEO Metadata (per page type)

**Tournament hub (`/vm-2026`):**
```html
<title>VM-tips 2026 — Skapa ditt tipslag | Ligacup.se</title>
<meta name="description" content="Spela VM-tips med vänner! Förutsäg alla matcher, skapa ett privat tipslag och tävla om äran. Gratis att använda.">
```

**Team page (`/lag/sverige`):**
```html
<title>Sverige VM 2026 — Matcher, Tips & Förutsägelser | Ligacup.se</title>
```

**Match page (`/match/sverige-brasilien`):**
```html
<title>Sverige vs Brasilien — VM 2026 Tips | Ligacup.se</title>
```

**OG image:** All pages have dynamically generated OG images via `/api/og?page={slug}` (Satori).

---

## PWA Configuration

- `manifest.json`: app name, icons, `display: standalone`, `theme_color: #0F0F11`
- Service Worker: cache static assets for offline access to already-viewed pages
- "Add to Home Screen" prompt: triggered after user has submitted 5+ predictions
- Push notifications: deferred to P3 (requires VAPID setup)
