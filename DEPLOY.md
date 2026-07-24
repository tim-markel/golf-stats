# Deploying Bogey Book to bogeybook.net

This is the step-by-step plan to take Bogey Book from localhost to production on
**bogeybook.net**, using free/cheap managed hosts. No Docker, no servers to
manage — each host pulls this repo from GitHub and runs its slice.

```
                       GitHub (this repo)
             push to main → auto-build + deploy
   ┌──────────────────────┴───────────────────────┐
   ▼                                                ▼
 VERCEL  ── serves ──▶  bogeybook.net          RENDER ── serves ──▶ api.bogeybook.net
 (web/ — Next.js)                               (api/ — FastAPI)
         browser calls api.bogeybook.net ──────────────┤ queries
                                                        ▼
                                                  NEON (Postgres)
   DNS for both subdomains lives in Cloudflare (where the domain is registered).
```

**Three hosted pieces:** the database (Neon), the backend API (Render), and the
frontend (Vercel). Email already runs through Resend on the verified
`bogeybook.net` domain.

---

## 0. Prerequisites

- The code is on GitHub (`tim-markel/golf-stats`).
- Accounts (all have free tiers): **Neon**, **Render**, **Vercel**. You already
  have **Cloudflare** (domain) and **Resend** (email).
- Locally: `pg_dump` / `psql` available (Homebrew Postgres) to migrate data.
- Generate a strong auth secret once and keep it handy:
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(48))"
  ```

---

## 1. Environment variables (reference)

You'll paste these into Render (backend) and Vercel (frontend). Keep the real
values in a password manager — **never commit them** (`.env` is gitignored).

### Backend (Render)
| Var | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | *(from Neon, step 2)* | Postgres connection string |
| `AUTH_SECRET` | *(the token_urlsafe you generated)* | **required** — signs login tokens |
| `APP_ENV` | `production` | makes a missing `AUTH_SECRET` fail fast |
| `CORS_ORIGINS` | `https://bogeybook.net,https://www.bogeybook.net` | allowed browser origins |
| `FRONTEND_URL` | `https://bogeybook.net` | used in password-reset email links |
| `EMAIL_PROVIDER` | `resend` | |
| `RESEND_API_KEY` | `re_...` | your Resend key |
| `EMAIL_FROM` | `Bogey Book <noreply@bogeybook.net>` | verified sender |
| `GEMINI_API_KEY` | *(your key)* | for the "add course" scraper |
| `TAVILY_API_KEY` | *(your key)* | for the "add course" scraper |

### Frontend (Vercel)
| Var | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.bogeybook.net` | where the browser calls the API |

---

## 2. Database — Neon

1. Create a Neon account → **New Project** (pick a region near your users).
2. Copy the **connection string** it shows (looks like
   `postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).
   Prefer the **pooled** connection string (it has `-pooler` in the host).
3. **Migrate your local data up** (brings your courses, golfers, rounds, *and*
   Tim's super-admin login). From the repo root:
   ```bash
   pg_dump --no-owner --no-privileges golf_stats \
     | psql "postgresql://...neon.tech/neondb?sslmode=require"
   ```
   *Alternative — fresh, empty DB (no data):*
   ```bash
   psql "postgresql://...neon.tech/neondb?sslmode=require" -f db/schema.sql
   ```
4. Sanity check:
   ```bash
   psql "postgresql://...neon.tech/neondb?sslmode=require" \
     -c "SELECT count(*) FROM golfers; SELECT count(*) FROM rounds;"
   ```

Save the connection string — it's the backend's `DATABASE_URL`.

---

## 3. Backend — Render

1. Render → **New → Web Service** → connect the GitHub repo.
2. Configure:
   - **Root Directory:** *(leave blank — the repo root)*
   - **Runtime:** Python 3
   - **Build Command:**
     ```
     pip install -r api/requirements.txt -r requirements.txt
     ```
     (installs the API deps **and** the scraper deps used by "add course")
   - **Start Command:**
     ```
     uvicorn api.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"
     ```
     `--proxy-headers --forwarded-allow-ips` makes the **rate limiter see the
     real client IP** instead of Render's proxy — important, don't omit it.
   - **Instance type:** Free to start (accepts cold starts), or **Starter
     (~$7/mo)** to keep it always-on.
3. Add all **backend env vars** from §1.
4. (Optional) Pin the Python version: add a repo file `runtime.txt` containing
   `python-3.12.x`, or set a `PYTHON_VERSION` env var.
5. Deploy. When it's live, note the default URL (`your-svc.onrender.com`) and
   confirm health:
   ```bash
   curl https://your-svc.onrender.com/health
   ```
6. **Custom domain:** in the service's **Settings → Custom Domains**, add
   `api.bogeybook.net`. Render shows a CNAME target — you'll add it in Cloudflare
   (step 5).

---

## 4. Frontend — Vercel

1. Vercel → **Add New → Project** → import the GitHub repo.
2. Configure:
   - **Root Directory:** `web`  ← the Next.js app lives in `web/`, not the repo root.
   - Framework preset auto-detects **Next.js** (build/install handled).
3. Add the **frontend env var** from §1 (`NEXT_PUBLIC_API_URL =
   https://api.bogeybook.net`).
4. Deploy. Confirm the `*.vercel.app` URL loads the login page.
5. **Custom domain:** Project → **Settings → Domains** → add `bogeybook.net` and
   `www.bogeybook.net`. Vercel shows the DNS records to add in Cloudflare.

---

## 5. DNS — Cloudflare

In the `bogeybook.net` zone → **DNS → Records**, add what Vercel and Render told
you. Typically:

| Type | Name | Target | Notes |
| --- | --- | --- | --- |
| A or CNAME | `bogeybook.net` (`@`) | *(Vercel's apex target)* | Cloudflare flattens CNAME at the apex |
| CNAME | `www` | *(Vercel target)* | |
| CNAME | `api` | `your-svc.onrender.com` | the Render backend |

- Follow the exact records Vercel/Render display.
- If the domain won't verify, set those records to **DNS only (grey cloud)**
  rather than Proxied (orange) — Vercel/Render manage their own TLS.
- DNS + certificate issuance can take a few minutes to ~an hour.

---

## 6. Verify (end-to-end)

- `https://api.bogeybook.net/health` → ok.
- `https://bogeybook.net` → login page loads over HTTPS.
- **Sign in as Tim** (`tmarkel20@gmail.com`) → dashboard loads (proves DB +
  auth + CORS all wired).
- Log a round → saves (proves writes + owner scoping).
- Forgot password → the reset email arrives from `noreply@bogeybook.net` with a
  link to `https://bogeybook.net/...` (proves `FRONTEND_URL` + Resend).
- Add a course via web search → succeeds (proves the scraper deps + keys).

---

## 7. Production hardening (do soon after launch)

Not blockers, but worth it before real users pile in:

- [ ] **Security headers** — add HSTS / X-Frame-Options / Referrer-Policy /
      a basic CSP (FastAPI middleware + `next.config` headers).
- [ ] **Email verification on signup** — currently anyone can sign up with any
      email; add a confirm-link step.
- [ ] **Session TTL / revocation** — tokens are 30-day stateless; consider a
      shorter TTL + refresh, or a server-side blocklist so logout truly revokes.
- [ ] **Scrape cost cap** — a global daily limit (or admin-only) so the LLM +
      Tavily bill can't be run up.
- [ ] **Dependency audit** — `npm audit` (in `web/`) and `pip-audit`; enable
      Dependabot.
- [ ] **Monitoring + backups** — Sentry for errors; turn on Neon's automated
      backups and do one restore test.
- [ ] **CI** — GitHub Actions to lint/type-check on every PR.

---

## 8. Day-2 operations

- **Deploys are automatic:** every push to `main` rebuilds+redeploys the
  frontend (Vercel) and backend (Render). Preview deploys happen on PRs.
- **Schema changes:** add a new `db/migrations/NNN_*.sql`, then run it against
  Neon (`psql "$DATABASE_URL" -f db/migrations/NNN_*.sql`). Keep `db/schema.sql`
  updated for fresh installs.
- **Rollback:** both Vercel and Render keep prior deploys — redeploy an earlier
  build from their dashboards.
- **Secrets rotation:** change a value in the host's env panel → redeploy.

---

## Troubleshooting

- **CORS errors in the browser** → `CORS_ORIGINS` on Render must exactly match
  the site origin (`https://bogeybook.net`), no trailing slash.
- **Everyone rate-limited at once / limiter useless** → the `--proxy-headers
  --forwarded-allow-ips="*"` flags are missing from the start command.
- **500s on the API** → check the Render logs; usually a missing env var
  (`AUTH_SECRET`, `DATABASE_URL`) or the DB connection string.
- **Reset links point at localhost** → set `FRONTEND_URL=https://bogeybook.net`.
- **Backend slow on first hit** → free Render instance cold-started; upgrade to
  Starter to keep it warm.
- **`add course` fails in prod but works locally** → `GEMINI_API_KEY` /
  `TAVILY_API_KEY` not set on Render, or the build command didn't install the
  root `requirements.txt`.
