# App Improvements

A living backlog of improvements to raise Bogey Book's all-around quality —
product depth, UX polish, data integrity, and engineering hardening — plus the
foundations that would let it grow into a multi-user, sellable product.

Roughly ordered within each section by impact. Nothing here is required; it's a
menu.

---

## 1. Product & feature depth (make it more useful)

- **Strokes Gained** — off-the-tee / approach / around-the-green / putting. The
  gold-standard metric serious golfers expect; the hole-by-hole shot detail is
  already captured to compute a reasonable version.
- **GPS & distances** — distance to pin/hazards/layup, and auto-detect the course
  and current hole to cut entry friction.
- **Shot-by-shot tracking** — club + start/end location per shot, enabling true
  strokes gained and club stats.
- **Club / bag stats** — average and dispersion distance per club.
- **Scorecard photo → auto-entry** — OCR a paper scorecard to prefill scores.
- **Weather capture** — temp/wind at round time; correlate performance with
  conditions.
- **Playing partners** — who you played with; group attribution.
- **Net / competition scoring** — course & playing handicap, net scores, and
  match formats (skins, Nassau, match play) with bets.
- **Goals & targets** — "break 90," GIR %, 3-putt reduction, with progress
  tracking and celebration.
- **Trends over time** — rolling averages and improvement graphs (score, GIR,
  putts, strokes gained) beyond the current per-round view.
- **Peer benchmarks** — "golfers at your handicap average X GIR / Y putts."
- **Your hole difficulty** — best/worst holes and where you actually lose strokes.
- **Practice depth** — a drills library, structured practice plans, and repeatable
  putting/chipping test protocols with scoring; link practice to on-course
  results ("more putting reps → fewer 3-putts").
- **Round extras** — notes and photos per hole/round; surface the existing round
  duration; support multiple rounds per day.
- **Wearables / Health** — Apple Watch scoring + Apple Health / Google Fit steps
  and heart rate during a round.

## 2. UX & polish

- **Onboarding** — a first-run flow: create your golfer, optional sample data, a
  short tour of entry + stats.
- **Empty & loading states** — skeleton loaders instead of "Loading…", and helpful
  empty states (e.g. "log your first round") everywhere.
- **Optimistic UI + undo** — instant updates with toast + undo, especially for
  deletes (see §3).
- **Error handling** — error boundaries, friendly messages, and retry instead of
  silent failures.
- **Offline support** — the PWA can cache; add offline round entry that syncs when
  back online (huge for on-course use with spotty signal).
- **Mobile ergonomics** — larger tap targets, thumb-reachable primary actions,
  swipe between holes.
- **Dark mode** and a consistent **design system** (spacing scale, tokens, shared
  components) so new screens stay on-brand.
- **Accessibility (a11y)** — keyboard navigation, focus states, ARIA labels,
  contrast, and screen-reader support; add Lighthouse/a11y budgets to CI.
- **Units & i18n** — yards/meters toggle, date/number formats, and a settings home
  for preferences (default tees, units, time-of-day defaults).
- **Search & filter** — filter rounds by course/date/tees; jump to a round quickly.
- **Desktop niceties** — keyboard shortcuts and denser layouts.

## 3. Data quality & integrity

- **Validation** — client + server bounds (score ≥ 1, putts ≤ score, etc.) with
  clear inline errors.
- **Confirm destructive actions** — deleting a round or practice session is
  currently instant; add a confirm + undo.
- **Import** — from GHIN or other apps (CSV) and from scorecard photos, so users
  arrive with history.
- **Export** — one-click CSV/JSON of all your rounds, stats, and practice (also
  reassures users they own their data).
- **Duplicate detection** — warn on likely-duplicate rounds.
- **Backups & restore** — user-facing "download my data," plus automated DB
  backups on the server.

## 4. Engineering quality

- **Automated tests** — pytest for the API (handicap math, stats aggregation) and
  Playwright/Jest for the web app's critical flows.
- **CI/CD** — GitHub Actions: lint, type-check, test, and deploy on merge.
- **Real migrations** — adopt Alembic (or similar) instead of ad-hoc `ALTER`s;
  keep `schema.sql` generated/tracked.
- **Seed & fixtures** — reproducible dev/test data (the catalog is currently
  runtime-populated only).
- **Observability** — Sentry error tracking, structured logging, uptime/health
  monitoring.
- **Performance** — client data caching (React Query/SWR) with dedupe, pagination
  for long lists, and query/index review as data grows.
- **Security** — input sanitization, rate limiting, security headers, tightened
  CORS, env-var validation, and proper secrets management.
- **End-to-end type safety** — generate the TS client from the FastAPI OpenAPI
  schema so `web/lib/api.ts` can't drift from the backend.
- **Dependency hygiene** — Dependabot/renovate, pinned versions, and a documented
  local + prod setup.
- **Feature flags** — ship risky features behind flags.

## 5. Foundations for multi-user (required before charging/selling)

- **Accounts + auth** — email + Sign in with Apple/Google. Today it's one "active
  golfer" with no login — the single biggest gap.
- **Multi-tenancy** — every query scoped to a user; row-level isolation.
- **Billing** — Stripe (web) + App Store IAP (native), free tier + Premium.
- **Hosting, backups, uptime** — deploy (Vercel + Render/Fly + managed Postgres),
  automated backups, error monitoring.
- **Legal/privacy** — ToS, privacy policy, data export + delete (GDPR/CCPA).
- **Analytics** — PostHog/Amplitude funnels + retention cohorts, so engagement is
  measurable.
- **Data-rights cleanup** — the course scraper is a liability flag; move toward
  licensed or user-contributed course data; keep the handicap explicitly
  "unofficial."

## 6. Engagement & retention

- **Kill entry friction** — quick-score mode, GPS auto-detect, watch entry,
  "resume round."
- **Social / group play** — friends, group rounds, live scoring, matches & bets
  (also the best viral loop).
- **Notifications** — "log your round," "handicap updated," streaks, weekly recap.
- **Gamification** — badges, streaks, challenges, and the existing 🍑 Total Ass
  Index leaderboard.

## 7. Growth & discovery

- **Shareable recap cards** — a good-looking round/scorecard summary to post to
  Instagram/iMessage. The Ass Index and consumption log are genuinely funny and
  shareable — free marketing the serious apps can't copy.
- **Group invites = viral loop** — starting a group round invites buddies who must
  install to join.
- **Course landing pages for SEO** — a public page per course (ratings, tees,
  booking) for organic search.
- **App Store presence** — wrap the PWA with Capacitor for a real listing.
- **Referrals** — free Premium month per referral.

## 8. Monetization

- **Freemium** — free basic tracking; Premium for strokes gained, trends,
  unlimited history, advanced season stats (~$40–70/yr, in line with 18Birdies /
  TheGrint).
- **Tee-time affiliate** — the app already scrapes booking links; wire
  GolfNow/Supreme Golf affiliate revenue into Explore (near-zero-effort recurring
  income).
- **Gear / consumption affiliates** — the beer/nicotine/hotdog tracking is a novel
  affiliate angle no other stat app has.
- **B2B: leagues & clubs** — group management, league leaderboards, club
  dashboards; higher ARPU than consumer.

---

## Suggested sequence

1. **Quality pass** — tests + CI + migrations + validation + confirm-on-delete +
   error/empty/loading states. Makes everything after this safer and faster.
2. **Foundations (§5)** — auth + multi-tenancy + billing + deploy + analytics.
   Now it's a real, chargeable product.
3. **Depth + retention** — strokes gained, trends/goals, group play + live
   scoring, shareable recaps; turn on tee-time affiliate.
4. **Grow & measure** — freemium paywall, get a retained cohort, watch retention.

## Unfair advantages to lean on

Don't try to out-serious Arccos/Shot Scope. The differentiators are **personality
+ social + practice**: the Ass Index, the consumption log, shareable/funny
recaps, and the practice-to-results loop. A "golf app with a sense of humor for
the weekend foursome" is an underserved, viral-friendly niche — and the affiliate
angles (tee times + beverages) fall out of it naturally.

## If you ever want to sell it

Valuation is driven by traction/revenue, not code. Rough ladder:

| State | Ballpark | Sale probability (cold) |
| --- | --- | --- |
| As-is, no users | $0–$5k (typ. low four figures) | ~10–20% on a marketplace |
| Launched, small retained cohort | $10k–$30k | meaningfully higher |
| ~$1–2k MRR / real retention | $30k–$100k+ (3–5x ARR) | good, incl. acquihire |

A ready **diligence pack** — MAU/DAU, retention curves, conversion/churn,
LTV/CAC, clean repo + tests + docs, documented infra, clear IP/licensing — can
2–3x the price.

_Not financial advice — informed ballparks, not a quote._
