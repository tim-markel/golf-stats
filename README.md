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

## How it works (planned)

1. **Course data ingestion** — A scraping agent takes course inputs (name,
   location, tees) and gathers course details from public golf websites and
   APIs: hole yardages, par, handicap/stroke index, slope, and course rating.
2. **Round entry** — You log your rounds with hole-by-hole detail (score, putts,
   fairway/green hit, penalties, etc.).
3. **Stats engine** — Raw round and course data is combined to compute both
   standard and custom advanced statistics.
4. **Dashboard** — Everything is surfaced in an interactive dashboard where you
   can monitor trends, compare rounds, and add your own custom stat definitions.

## Core components

- **Scraping agent** — Pulls golf course information from the web based on user
  inputs. Designed to work across multiple sources.
- **Data layer** — Stores courses, rounds, and per-hole records.
- **Stats engine** — Computes standard metrics plus user-defined custom stats.
- **Dashboard / app** — The front end where you configure custom statistics and
  monitor your game.
- **API integrations** — Uses multiple third-party APIs for golf course data,
  statistics, and related golf information.

## Status

🚧 **Early development.** This repository is just getting started. The README
captures the intended direction; implementation details (tech stack, data
schema, and specific APIs) will be filled in as the project takes shape.

## Course scraper

The `scraper/` package is the course-data ingestion tool. You give it a course
name and an LLM agent searches the web, reads the resulting pages, and extracts
a structured record (course details, tee sets, and hole-by-hole par / stroke
index / yardages) that it writes into the database.

**Pipeline:** `course name → Tavily web search → fetch & clean pages → Gemini
structured extraction → insert into Postgres`

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

## Roadmap

- [x] Define data model for courses and holes
- [x] Build the course-scraping agent
- [ ] Integrate external golf data APIs
- [ ] Implement the stats engine (standard + custom metrics)
- [ ] Build the dashboard / app front end
- [ ] Add support for user-defined custom statistics
