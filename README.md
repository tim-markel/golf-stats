# golf-stats

A personal golf statistics dashboard for monitoring and improving your game.

Think of it as a GHIN dashboard — but with deeper, more advanced, and fully
customizable statistics. Instead of just tracking a handicap and recent scores,
`golf-stats` lets you drill into your game **hole by hole**, build your own
metrics, and surface insights that off-the-shelf golf apps don't provide.

## Vision

Most golf tracking tools give you a handicap, a scoring average, and maybe a few
basic stats (fairways hit, greens in regulation, putts per round). `golf-stats`
aims to go much further:

- **Hole-by-hole analysis** — track and review performance on every hole of
  every course you play, not just round-level aggregates.
- **Advanced & custom statistics** — define your own metrics (e.g. strokes
  gained by category, scoring by hole type, performance under specific
  conditions) and monitor them over time.
- **Automated course data** — an agent scrapes the web for golf course
  information (layout, yardages, par, slope/rating, hole details) based on the
  courses you input, so you don't have to enter everything by hand.
- **A dashboard you control** — the end product is a dashboard (web app or
  native app) where you can plug in and visualize the custom statistics that
  matter most to you.

## How it works

1. **Course data ingestion** — A scraping agent ([`scraper/`](scraper)) takes a
   course name, searches the web, and extracts course details (tees, hole
   yardages, par, stroke index, slope, and course rating) into the database. It
   also geocodes the course (for the map) and grabs a tee-time booking link when
   one is found.
2. **Round entry** — You log rounds hole-by-hole in the web app: score, putts,
   driving/approach accuracy, GIR, up & down, penalties, hazards, balls lost, and
   on-course beer/nicotine/weed/hotdog consumption. Rounds, their metadata, and
   any hole's stats can all be edited after the fact.
3. **Stats** — A `round_stats` view rolls the hole-level data up to round
   totals; the API aggregates further into per-round scorecards, per-golfer
   **season totals** (distributions, dispersion targets, GIR/fairway/putts vs
   score scatters), a WHS-style **handicap index** (net-double-bogey adjusted
   gross, 9-hole rounds folded in), and a cross-golfer **leaderboard** (including
   the tongue-in-cheek Total Ass Index).
4. **Dashboard** — The Next.js app ([`web/`](web)) surfaces all of that plus a
   **calendar** of rounds and practice, a **practice** tracker (range / putting /
   chipping), and an **Explore** map of nearby courses with tee-time links.

## Architecture

```
scraper/ (Python + Gemini + Tavily)
        ↓ writes courses
   Postgres  ──  db/schema.sql
        ↑ reads / writes
   api/ (FastAPI)  ──JSON──  web/ (Next.js + React PWA)
```

- **Scraper** ([`scraper/`](scraper)) — Python agent: Tavily web search → fetch
  & clean pages → Gemini structured extraction → insert into Postgres.
- **Data layer** ([`db/schema.sql`](db/schema.sql)) — PostgreSQL schema for
  courses, tees, holes, golfers, rounds, and hole-by-hole stats (see ERD below).
- **API** ([`api/`](api)) — FastAPI service exposing golfers, courses, rounds,
  the beer catalog, and aggregated stats as JSON.
- **Web app** ([`web/`](web)) — Next.js + React + Tailwind + Recharts (+ Leaflet
  for the map) PWA: a GHIN/18Birdies-style entry flow, per-golfer visualization
  and season totals, a rounds/practice calendar, a leaderboard, a practice
  dashboard, and an Explore map — on phone and desktop from one codebase.

## Status

🟢 **Working vertical slice.** The scraper, database, API, and web app are all
built and runnable. Next up: advanced and user-defined custom statistics, and
broader external golf-data API integrations (see the roadmap).

## Data model

The full schema lives in [`db/schema.sql`](db/schema.sql). The diagram below
(an entity-relationship diagram) shows how the tables connect. `round_stats` is
a view that aggregates `hole_stats` up to the round level, so it isn't shown.

```mermaid
erDiagram
    courses ||--o{ tees : "has"
    courses ||--o{ holes : "has"
    holes   ||--o{ hole_tees : "yardage per tee"
    tees    ||--o{ hole_tees : "yardage per hole"
    golfers ||--o{ rounds : "plays"
    golfers ||--o{ practice_sessions : "logs"
    courses ||--o{ rounds : "played at"
    tees    |o--o{ rounds : "played from"
    rounds  ||--o{ hole_stats : "scored on"
    holes   ||--o{ hole_stats : "for hole"
    hole_stats ||--o{ hole_nicotine : "logs"
    hole_stats ||--o{ hole_weed : "logs"
    hole_stats ||--o{ hole_beer : "logs"
    beer_options ||--o{ hole_beer : "which beer"

    courses {
        bigint id PK
        text name
        text city
        text country
        double latitude "for the explore map"
        double longitude
        smallint holes_count
        smallint par
        text website
        text booking_url "tee-time link"
        text data_source "scraper provenance"
    }
    tees {
        bigint id PK
        bigint course_id FK
        text name
        integer total_yards
        numeric course_rating
        smallint slope_rating
    }
    holes {
        bigint id PK
        bigint course_id FK
        smallint hole_number
        smallint par
        smallint stroke_index "handicap rank 1-18"
    }
    hole_tees {
        bigint id PK
        bigint hole_id FK
        bigint tee_id FK
        integer yards
    }
    golfers {
        bigint golfer_id PK
        text name
        numeric handicap
        text ghin_id
        text email "login (optional)"
    }
    rounds {
        bigint round_id PK
        bigint golfer_id FK
        bigint course_id FK
        bigint tee_id FK "nullable"
        date played_on
        text time_of_day "morning/afternoon/twilight"
        interval round_duration
    }
    hole_stats {
        bigint id PK
        bigint round_id FK
        bigint hole_id FK
        smallint score
        smallint putts
        text driving_accuracy "par 4/5 only"
        boolean gir
        text approach_accuracy
        boolean up_and_down
        text_array penalty_locations "off_tee/approach"
        smallint penalty_strokes
        text_array hazards_hit "water/bunker/natural_area/ob"
        smallint balls_lost
        smallint hotdogs
    }
    hole_nicotine {
        bigint id PK
        bigint hole_stat_id FK
        text type
        smallint quantity
    }
    hole_weed {
        bigint id PK
        bigint hole_stat_id FK
        text type
        numeric amount
        text unit
    }
    beer_options {
        bigint beer_id PK
        text name "unique"
        numeric abv
    }
    hole_beer {
        bigint id PK
        bigint hole_stat_id FK
        bigint beer_id FK
        numeric size_oz
    }
    practice_sessions {
        bigint id PK
        bigint golfer_id FK
        date practiced_on
        int range_balls
        int range_time "minutes"
        text range_rating "good/medium/bad"
        int putting_time
        text putting_rating
        int chipping_time
        text chipping_rating
    }
```

### Where the database lives

The repo only contains the schema (`db/schema.sql`) — **not** the database
itself. The live data is stored by your local PostgreSQL server, not as a file
in this project. On this machine (Homebrew Postgres 14):

| Detail | Value |
| --- | --- |
| Database name | `golf_stats` |
| Server data directory | `/opt/homebrew/var/postgresql@14` (server-managed; don't edit by hand) |
| Host / Port | `localhost` / `5432` |
| User | `timmarkel` (local trust auth — no password) |

Create it from scratch (e.g. on a new machine):

```bash
brew services start postgresql@14     # start the server
createdb golf_stats                   # create the database
psql golf_stats -f db/schema.sql      # apply the schema
```

Quick CLI access: `psql golf_stats` (then `\dt` to list tables).

### Viewing the data in Postico

1. Make sure the server is running: `brew services start postgresql@14`.
2. Open **Postico** → **New Server / New Favorite**.
3. Enter:
   - **Nickname:** `golf-stats` (anything)
   - **Host:** `localhost`
   - **Port:** `5432`
   - **User:** `timmarkel`
   - **Password:** *(leave blank — local trust auth)*
   - **Database:** `golf_stats`
4. Click **Connect**. You'll see the tables (`courses`, `golfers`, `rounds`,
   `beer_options`, …) in the left sidebar; click one to browse rows, and use the
   SQL Query tab for ad-hoc queries.

## Course scraper

The `scraper/` package is the course-data ingestion tool. You give it a course
name and an LLM agent searches the web, reads the resulting pages, and extracts
a structured record (course details, tee sets, hole-by-hole par / stroke index /
yardages, and a tee-time booking link) that it writes into the database. On save
it also geocodes the course via OpenStreetMap (no key required) so it can appear
on the Explore map.

**Pipeline:** `course name → Tavily web search → fetch & clean pages → Gemini
structured extraction → geocode → insert into Postgres`

To backfill coordinates for courses added before geocoding existed, run
`python -m scraper.geocode_backfill`.

### Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in your keys
```

You'll need two free API keys in `.env`:

- `GEMINI_API_KEY` — Google AI Studio (https://aistudio.google.com/apikey)
- `TAVILY_API_KEY` — Tavily search (https://app.tavily.com)

And a running Postgres database with the schema applied:

```bash
createdb golf_stats
psql golf_stats -f db/schema.sql
```

### Usage

```bash
# Preview the extracted data without touching the database:
python -m scraper.cli "Pebble Beach Golf Links, Pebble Beach, CA" --dry-run

# Scrape and write the course into the database:
python -m scraper.cli "Pebble Beach Golf Links, Pebble Beach, CA"
```

## Web app (API + dashboard)

The app is split into a backend API and a frontend, both sitting on top of the
Postgres database:

- **`api/`** — a FastAPI service exposing golfers, courses, rounds, and
  aggregated stats as JSON.
- **`web/`** — a Next.js (React + Tailwind) app with a GHIN/18Birdies-style
  hole-by-hole round-entry flow, a per-golfer page (scoring trend, season totals,
  rounds/practice calendar, round history), an editable scorecard, a leaderboard,
  a practice dashboard, and an Explore map. Installable as a PWA, so it works on
  both phone and desktop from one codebase.

```
Postgres → FastAPI (api/) → Next.js (web/)
```

### Run the backend

```bash
source .venv/bin/activate            # same venv as the scraper
pip install -r api/requirements.txt
uvicorn api.main:app --reload        # serves http://localhost:8000 (docs at /docs)
```

It reads `DATABASE_URL` from `.env` (defaults to `postgresql://localhost:5432/golf_stats`).

### Run the frontend

```bash
cd web
npm install
cp .env.local.example .env.local     # points at http://localhost:8000 by default
npm run dev                          # serves http://localhost:3000
```

Add a course with the scraper first (so there's something to log rounds
against), then open the app, create a golfer, and start a round.

### Run both at once

From the repo root, `./run.sh` starts the API (`:8000`) and the web app
(`:3000`) together and shuts both down on Ctrl+C. Override ports with
`API_PORT=8010 WEB_PORT=3010 ./run.sh` if either is taken.

## Roadmap

- [x] Define data model for courses and holes
- [x] Build the course-scraping agent (with geocoding + booking links)
- [x] Build the API (FastAPI) over the data model
- [x] Build the dashboard / app front end (Next.js: entry UI + golfer stats)
- [x] WHS-style handicap index (net double bogey, 9-hole rounds folded in)
- [x] Season totals, leaderboard, and rounds/practice calendar
- [x] Practice dashboard (range / putting / chipping)
- [x] Explore map of nearby courses with tee-time links
- [ ] Integrate external golf data APIs
- [ ] Implement the stats engine (advanced + user-defined custom metrics)
- [ ] Add support for user-defined custom statistics
