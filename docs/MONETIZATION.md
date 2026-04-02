# Ligacup.se — Monetization & Legal

## The Legal Bright Line

Ligacup.se is a **prediction platform**, not a gambling operator. This distinction must be clear at every architectural and UX decision point.

| Criteria | Ligacup.se | Bookmaker (Spelinspektionen license required) |
|---|---|---|
| Platform handles money | ❌ Never | ✅ Always |
| Platform pays out winnings | ❌ Never | ✅ Always |
| Platform profits from losses | ❌ Never | ✅ Always (house edge) |
| Stake amounts stored in DB | ❌ Never | ✅ Core feature |
| Users bet against the platform | ❌ Never | ✅ Core mechanic |
| Requires Swedish gambling license | ❌ No | ✅ Yes |

### Design Rules That Maintain Legal Status

1. **Never store stake amounts.** The DB has no `stake_amount` column. No form on the platform asks for or displays money.
2. **Points, not money.** The platform awards points. Any private stakes between friends (via Swish) are entirely outside the platform's scope and knowledge.
3. **Terms of Service must explicitly state:**
   > "Ligacup.se är ett tipsspel för förutsägelser. Eventuella privata arrangemang om insatser mellan användare sker helt utanför plattformen och är inget Ligacup.se är ansvarigt för."
4. **Affiliate links are media, not betting integration.** They appear as clearly labeled partner banners, never embedded in the prediction flow. Users are not incentivized to click them as part of gameplay.
5. **Pro subscription is for features, not competitive edge.** Pro users don't get better odds, more points, or any prediction advantage. They get UX features (more members, stats, ad-free).

---

## Revenue Streams

### Stream 1: Stripe Subscriptions (Primary)

**Tiers:**

| Tier | Price | Billing | Key Limits |
|---|---|---|---|
| Free | 0 SEK | — | 1 league, 20 members |
| Pro | 99 SEK/month or 599 SEK/season | Monthly or one-time | 10 leagues, 100 members, advanced features |
| Team | 299 SEK/month | Monthly | Unlimited leagues, unlimited members |

**Season pricing note:** "Season" = duration of the tournament. For WC 2026, a 599 SEK one-time season pass is attractive vs. the ~240 SEK monthly equivalent. Shown with a "Save 40%" badge.

**Pro features:**
- Unlimited league members (free: 20 cap)
- Custom league banner upload
- Advanced stats dashboard (points per round, head-to-head)
- CSV export of all predictions and results
- Ad-free experience
- Increased AI Roast quota (10/day vs. 3/day)

**Implementation:**

```
Checkout flow:
  User clicks "Uppgradera till Pro"
  → POST /api/stripe/checkout { tier: 'pro', billing: 'season' }
  → stripe.checkout.sessions.create({
      line_items: [{ price: PRICE_ID_PRO_SEASON, quantity: 1 }],
      mode: 'payment',   // one-time; or 'subscription' for monthly
      success_url: '/profile/subscription?success=true',
      cancel_url: '/profile/subscription',
      customer_email: user.email
    })
  → Redirect to Stripe-hosted checkout page
  → On payment: Stripe webhook → POST /api/stripe/webhook
  → Webhook handler: UPDATE users SET subscription_tier = 'pro', stripe_customer_id = ...
  → User redirected to success URL
```

**Webhook events to handle:**
- `checkout.session.completed` → activate subscription
- `customer.subscription.updated` → handle plan change
- `customer.subscription.deleted` → downgrade to free
- `invoice.payment_failed` → send payment failure email (Resend)

**DB state:** `users.subscription_tier` (`free` | `pro` | `team`) + `users.stripe_customer_id`

**Enforcement:** Check `subscription_tier` in API routes and React Server Components. Never trust client-side.

---

### Stream 2: Affiliate Betting Links (CPA)

**Model:** Cost-Per-Acquisition. Partner pays a flat fee (50–150 SEK) per new user who registers and deposits at their sportsbook.

**Partners to target (Swedish market):**
- Unibet (Kindred Group)
- Betsson
- LeoVegas
- Speedy Casino / NordicBet (if they offer affiliate programs)

**Implementation:**

```
Affiliate link structure:
  https://unibet.se/register?btag=ligacup_vm2026&utm_source=ligacup&utm_medium=affiliate

Display locations:
  - Match page: "Se odds för denna match →" banner (below match info, above predictions)
  - Dashboard: rotating banner in sidebar (desktop)
  - After submitting all predictions: "Vill du även spela på VM? Se odds hos våra partners →"

Tracking:
  - All tracking via partner's btag/affiliate ID in URL
  - No server-side tracking required (partner tracks conversions)
  - Optional: store click count in analytics table for reporting
```

**UX rules:**
- Affiliate banners labeled "Annons" or "Partner" clearly
- Never shown inline with prediction UI (separate section)
- Never presented as required to use the platform
- "18+ | Spela ansvarsfullt | stodlinjen.se" disclaimer beneath all affiliate links (required by Swedish law)

**Revenue estimate:**
- 10k monthly active users × 5% click rate = 500 clicks
- 500 clicks × 2% conversion = 10 new depositing users
- 10 × 100 SEK CPA average = 1,000 SEK/month baseline
- At 50k users during WC peak: ~5,000 SEK/month

---

### Stream 3: Future — Sponsored Leagues (Post-Launch)

After reaching 10k+ users, offer branded leagues for companies:
- "Kontorets VM-tipslag powered by [Company]" with company logo
- Flat fee: 2,000–5,000 SEK per branded league
- Easy to implement: `leagues.sponsor_name` + `leagues.sponsor_logo_url` columns

Not in MVP scope.

---

## Swish — Private Stakes Between Users

Swish is **not a platform payment method.** Users use Swish privately between themselves for their own stakes. The platform:
- Never mentions Swish in payment context
- May optionally show a "Hur betalar vi?" FAQ that explains it's a private matter
- Never stores any Swish reference numbers, amounts, or confirmation data

---

## Revenue Projections (Conservative)

| Month | MAU | Pro Conv. | Stripe/month | Affiliate/month | Total |
|---|---|---|---|---|---|
| May 2026 (pre-WC) | 500 | 3% | 1,500 SEK | 200 SEK | 1,700 SEK |
| June 2026 (WC peak) | 10,000 | 5% | 49,500 SEK | 10,000 SEK | 59,500 SEK |
| July 2026 (WC final) | 25,000 | 5% | 123,750 SEK | 25,000 SEK | 148,750 SEK |
| Sep 2026 (Allsvenskan) | 3,000 | 6% | 17,820 SEK | 3,000 SEK | 20,820 SEK |

These projections assume a successful viral launch. Treat as directional, not forecast.

---

## GDPR Compliance (Swedish/EU Users)

- **Cookie consent:** Required for any analytics beyond essential cookies. Use a simple consent banner.
- **Data stored:** email, username, predictions, messages. Minimal PII.
- **Data retention:** User data deleted within 30 days of account deletion request.
- **Privacy Policy:** Required before launch. Must list: what data is collected, why, how long, user rights (access, delete, export).
- **No data sold to third parties.** Affiliate links are outbound only — no user data shared with partners.
- **Stripe:** Handles payment data. Ligacup.se never stores card numbers. Stripe is a GDPR-compliant processor.

---

## Required Legal Pages (Before Launch)

| Page | Route | Content |
|---|---|---|
| Privacy Policy | `/integritetspolicy` | GDPR-compliant, Swedish language |
| Terms of Service | `/anvandardvillkor` | Prediction game disclaimer, stake disclaimer, Swedish law |
| Cookie Policy | `/cookies` | What cookies, what for, how to opt out |
| Responsible Gaming | `/ansvarsfult-spelande` | Required for affiliate compliance |
