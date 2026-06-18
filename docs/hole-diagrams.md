# Hole Diagrams (parked idea)

> Status: **prototyped, then parked.** This document captures the idea, the
> approach we validated, findings, and the exact code so it can be picked back
> up later. The working changes were reverted to keep the app focused for now.

## The idea

On each hole of a round (the scorecard / per-hole view), show a **line-art
diagram of that specific hole** — fairway shape, bunkers, green with pin, tee
boxes — oriented tee-at-bottom → green-at-top. Reference look (hand-drawn
yardage-book style):

```
   ( green + pin )
    \__ bunkers __/
        |  fairway shape
        |
     [ tee boxes ]
```

Chosen visual style: **black-and-white sketch** (clean traced line-art, matching
a yardage-book illustration), not a satellite photo.

## Approach we validated

**Source: OpenStreetMap (Overpass API) — free, no key.** Well-mapped courses
tag golf features as polygons/lines:

- `golf=hole` — a centerline way from tee→green, with `ref` = hole number.
- `golf=green`, `golf=bunker`, `golf=fairway`, `golf=tee`, `golf=water_hazard` — polygons.

Render those polygons as an SVG → clean line sketch. Mappers trace OSM from
aerial imagery, so the result is satellite-accurate without needing a satellite
image or a Mapbox/Google token.

### Scoping to one course

Query the named course **area** so we don't grab neighboring courses:

```overpassql
[out:json][timeout:60];
area["leisure"="golf_course"]["name"~"<CORE NAME>",i]->.a;
(
  way["golf"="hole"](area.a);
  way["golf"="green"](area.a);
  way["golf"="bunker"](area.a);
  way["golf"="fairway"](area.a);
  way["golf"="tee"](area.a);
  way["golf"="water_hazard"](area.a);
);
out geom;
```

Use `out geom;` so each way includes node lat/lon. Use the **core name** (strip
the trailing "Golf Links/Course/Club/GC") — OSM's area name is usually shorter
than our stored name (e.g. DB "Pebble Beach Golf Links" → match `Pebble Beach`).
Call Overpass via **GET** (`params={"data": q}`) with a `User-Agent`; POST
returned `406`.

## Findings

- **Coverage varies.** Pebble Beach is richly mapped — the scoped query returned
  exactly **18 hole centerlines (numbered), 18 greens, 116 bunkers, 65 tees,
  24 fairways**. Municipal courses may be sparse or missing → the feature needs a
  graceful **"no diagram available"** fallback per hole.
- The prototype rendered Pebble #7 and #18 convincingly (see git history / the
  code below). Tee→green orientation, nearest-green matching, and a buffer to
  pick the hole's own bunkers/fairway all worked.
- Overpass **rate-limits** — fetch per course once and **cache** (don't hit it
  per page load).

## Implementation plan (resume from here)

1. **Schema:** `holes.diagram JSONB` — cached normalized geometry per hole:
   `{ w, h, centerline:[[x,y]], pin:[x,y], features:[{type, pts:[[x,y]]}] }`
   (already projected to an SVG viewBox, y-down, oriented tee→green).
2. **Builder:** `scraper/diagrams.py` — `python -m scraper.diagrams <course_id>`:
   fetch OSM for the course, match features to each hole, normalize, store JSON.
   (Full code preserved below.)
3. **API:** add `diagram` to `ScorecardHole` and select `h.diagram` in
   `GET /rounds/{id}` (`api/routers/rounds.py`).
4. **Frontend:** a `HoleDiagram` SVG component (sketch style: `fill:none`,
   `stroke:#222`, green slightly thicker, dashed gray centerline, black pin)
   rendered on each hole card in `web/app/rounds/[id]/page.tsx`; render nothing
   when `diagram` is null.
5. **Coverage + populate:** run a coverage check across all courses, then run the
   builder once per course that has data (like the scraper).

### Open issues / refinements

- **Same-name collisions:** area-by-name is global; a generic core name
  (e.g. "Mountain View") could match the wrong course. Constrain by location —
  geocode the course (city) and bound the area to a bbox, or pick the nearest
  matching `golf_course` polygon.
- Stray polygons near the tee (practice areas) — tighten the buffer / corridor.
- **27-hole courses** (e.g. Stonebridge) and holes that share fairways.
- Optional: trees/rough hatching (OSM `golf=rough`, `natural=wood`) for more of
  the hand-drawn look; labels (yardage, par).

## Preserved builder code

`scraper/diagrams.py` (Overpass fetch + per-hole matching + normalization):

```python
"""Build cached line-art hole diagrams from OpenStreetMap golf data."""
from __future__ import annotations
import json, math, re, sys
import httpx, psycopg
from .config import Config

OVERPASS = "https://overpass-api.de/api/interpreter"
KINDS = ("green", "bunker", "fairway", "tee", "water_hazard")

def core_name(name: str) -> str:
    core = re.sub(r"\s+(golf\s+(links|course|club)|golf|g\.?c\.?)\s*$", "", name, flags=re.I)
    return (core or name).strip()

def fetch_features(search: str) -> list[dict]:
    parts = "".join(f'way["golf"="{k}"](area.a);' for k in KINDS)
    q = ("[out:json][timeout:60];"
         f'area["leisure"="golf_course"]["name"~"{search}",i]->.a;'
         f'(way["golf"="hole"](area.a);{parts});out geom;')
    r = httpx.get(OVERPASS, params={"data": q},
                  headers={"User-Agent": "golf-stats/1.0", "Accept": "application/json"},
                  timeout=90.0)
    r.raise_for_status()
    return r.json().get("elements", [])

def _to_m(lat, lon, lat0, lon0):
    return ((lon-lon0)*math.cos(math.radians(lat0))*111320.0, (lat-lat0)*110540.0)

def _seg_dist(p, a, b):
    (px,py),(ax,ay),(bx,by) = p,a,b; dx,dy = bx-ax, by-ay
    if dx == dy == 0: return math.hypot(px-ax, py-ay)
    t = max(0, min(1, ((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)))
    return math.hypot(px-(ax+t*dx), py-(ay+t*dy))

def _cen(ps): return (sum(x for x,_ in ps)/len(ps), sum(y for _,y in ps)/len(ps))
def _area(ps):
    a = 0.0
    for i in range(len(ps)):
        x1,y1 = ps[i]; x2,y2 = ps[(i+1) % len(ps)]; a += x1*y2 - x2*y1
    return abs(a)/2

def build_holes(elements, buf=34.0):
    geom = lambda e: [(g["lat"], g["lon"]) for g in e.get("geometry", [])]
    holes = {e["tags"]["ref"]: geom(e) for e in elements
             if e["tags"].get("golf") == "hole" and e["tags"].get("ref") and len(geom(e)) >= 2}
    feats = [{"type": e["tags"]["golf"], "pts": geom(e)} for e in elements
             if e["tags"].get("golf") in KINDS and e.get("geometry")]
    out = {}
    for ref, line in holes.items():
        lat0, lon0 = line[len(line)//2]
        cl = [_to_m(la, lo, lat0, lon0) for la, lo in line]
        tee, gend = cl[0], cl[-1]
        ang = math.radians(90) - math.atan2(gend[1]-tee[1], gend[0]-tee[0])
        ca, sa = math.cos(ang), math.sin(ang)
        rot = lambda p: (p[0]*ca - p[1]*sa, p[0]*sa + p[1]*ca)
        M = lambda f: [_to_m(la, lo, lat0, lon0) for la, lo in f["pts"]]
        near = lambda fm: min(_seg_dist(p, cl[i], cl[i+1]) for p in fm for i in range(len(cl)-1))
        greens = [f for f in feats if f["type"] == "green"]
        ng = min(greens, key=lambda f: math.hypot(*(a-b for a,b in zip(_cen(M(f)), gend)))) if greens else None
        fairways = [(_area(M(f)), f) for f in feats if f["type"] == "fairway" and near(M(f)) < buf]
        mainfw = max(fairways, key=lambda t: t[0])[1] if fairways else None
        chosen = []
        for f in feats:
            fm = M(f)
            if f["type"] == "green":
                if f is not ng: continue
            elif f["type"] == "fairway":
                if f is not mainfw: continue
            elif f["type"] == "tee":
                if math.hypot(*(a-b for a,b in zip(_cen(fm), tee))) > 55: continue
            else:
                if near(fm) > buf: continue
            chosen.append({"type": f["type"], "pts": [rot(p) for p in fm]})
        clr = [rot(p) for p in cl]
        allp = clr + [p for f in chosen for p in f["pts"]]
        xs = [p[0] for p in allp]; ys = [p[1] for p in allp]; pad = 8.0
        minx, maxx = min(xs)-pad, max(xs)+pad
        miny, maxy = min(ys)-pad, max(ys)+pad
        W, H = maxx-minx, maxy-miny
        s = 100.0/W if W else 1.0
        nx = lambda x: round((x-minx)*s, 1)
        ny = lambda y: round((maxy-y)*s, 1)
        norm = lambda ps: [[nx(x), ny(y)] for x, y in ps]
        gpts = [p for f in chosen if f["type"] == "green" for p in f["pts"]]
        pin = _cen(gpts) if gpts else clr[-1]
        out[ref] = {"w": round(W*s,1), "h": round(H*s,1), "centerline": norm(clr),
                    "pin": [nx(pin[0]), ny(pin[1])],
                    "features": [{"type": f["type"], "pts": norm(f["pts"])} for f in chosen]}
    return out

def store_for_course(course_id: int) -> int:
    cfg = Config.load()
    with psycopg.connect(cfg.database_url) as conn:
        course = conn.execute("SELECT name FROM courses WHERE id = %s", (course_id,)).fetchone()
        if course is None: raise SystemExit(f"course {course_id} not found")
        name = course[0]
        rows = conn.execute("SELECT hole_number, id FROM holes WHERE course_id = %s", (course_id,)).fetchall()
        by_number = {str(n): hid for n, hid in rows}
        elements = fetch_features(core_name(name))
        diagrams = build_holes(elements)
        written = 0
        for ref, diagram in diagrams.items():
            hid = by_number.get(ref)
            if hid is None: continue
            conn.execute("UPDATE holes SET diagram = %s WHERE id = %s", (json.dumps(diagram), hid))
            written += 1
        conn.commit()
    print(f"{name}: stored {written}/{len(rows)} holes ({len(diagrams)} in OSM)")
    return written

if __name__ == "__main__":
    store_for_course(int(sys.argv[1]))
```

### Preserved SVG renderer (sketch style)

Frontend would draw this from the stored JSON; the prototype rendered server-side
with `rsvg-convert`. Sketch styling: `fill:none; stroke:#222`, green stroke a bit
thicker, dashed gray centerline, black pin/flag. Draw order:
`fairway, water_hazard, tee, bunker, green`, then centerline, then pin.

## Resume prompt

> Re-implement hole diagrams from OpenStreetMap. Re-create `scraper/diagrams.py`
> (code in `docs/hole-diagrams.md`), add `holes.diagram JSONB`, populate it per
> course with `python -m scraper.diagrams <course_id>` (start with Pebble = id 5),
> add `diagram` to `ScorecardHole` + the `GET /rounds/{id}` query, and render a
> sketch-style `HoleDiagram` SVG on each hole card in the scorecard, with a
> "no diagram available" fallback. Then run a coverage check across all courses
> and populate the ones OSM has data for.
