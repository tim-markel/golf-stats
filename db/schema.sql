-- golf-stats :: data model for courses and holes
-- Dialect: PostgreSQL (notes for SQLite are inline where they differ).
--
-- Modeling decisions
-- ------------------
-- A golf course has one or more *tee sets* (Black/Blue/White/Red, etc.). The
-- things that vary by tee are yardage and rating/slope. Par and the stroke
-- index (hole difficulty rank, 1-18) are properties of the *hole* and are the
-- same regardless of which tee you play. So:
--
--   courses (1) ──< tees       (per-course set of tees, each with rating/slope)
--   courses (1) ──< holes      (per-course hole: number, par, stroke index)
--   holes   (1) ──< hole_tees  (yardage for a given hole from a given tee)
--   tees    (1) ──< hole_tees
--
-- hole_tees is the junction of holes x tees and is where yardage lives.

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
CREATE TABLE courses (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT        NOT NULL,            -- "Pebble Beach Golf Links"
    -- location
    city            TEXT,
    country         TEXT,
    -- summary attributes
    holes_count     SMALLINT    NOT NULL DEFAULT 18, -- 9, 18, 27, ...
    par             SMALLINT,                         -- total par for the course
    architect       TEXT,
    year_built      SMALLINT,
    website         TEXT,
    phone           TEXT,
    -- provenance (populated by the scraping agent)
    data_source     TEXT,                            -- which site/API it came from
    source_url      TEXT,
    scraped_at      TIMESTAMPTZ,
    -- bookkeeping
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- tees  (a tee set at a course, e.g. "Blue")
-- ---------------------------------------------------------------------------
CREATE TABLE tees (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id       BIGINT      NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,            -- "Black", "Blue", "Championship"
    par             SMALLINT,                         -- total par played from this tee
    total_yards     INTEGER,                          -- total yardage from this tee
    -- USGA-style ratings (per 18; store 9-hole sub-ratings separately if needed)
    course_rating   NUMERIC(4,1),                     -- e.g. 74.7
    slope_rating    SMALLINT CHECK (slope_rating BETWEEN 55 AND 155),
    bogey_rating    NUMERIC(4,1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, name)
);

-- ---------------------------------------------------------------------------
-- holes  (one row per hole per course; par + difficulty live here)
-- ---------------------------------------------------------------------------
CREATE TABLE holes (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id       BIGINT      NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    hole_number     SMALLINT    NOT NULL CHECK (hole_number BETWEEN 1 AND 27),
    par             SMALLINT    NOT NULL CHECK (par BETWEEN 3 AND 6),
    stroke_index    SMALLINT    CHECK (stroke_index BETWEEN 1 AND 18), -- handicap rank
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, hole_number)
);

-- ---------------------------------------------------------------------------
-- hole_tees  (yardage for a hole from a specific tee)
-- ---------------------------------------------------------------------------
CREATE TABLE hole_tees (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hole_id         BIGINT      NOT NULL REFERENCES holes (id) ON DELETE CASCADE,
    tee_id          BIGINT      NOT NULL REFERENCES tees (id)  ON DELETE CASCADE,
    yards           INTEGER,
    meters          INTEGER,
    -- rare overrides: par/stroke index that differ for this tee. Usually NULL.
    par_override          SMALLINT CHECK (par_override BETWEEN 3 AND 6),
    stroke_index_override SMALLINT CHECK (stroke_index_override BETWEEN 1 AND 18),
    UNIQUE (hole_id, tee_id)
);

-- ---------------------------------------------------------------------------
-- golfers  (a person whose game is being tracked)
-- ---------------------------------------------------------------------------
CREATE TABLE golfers (
    golfer_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT        NOT NULL,
    handicap        NUMERIC(3,1),                     -- handicap index, e.g. 12.4
    ghin_id         TEXT        UNIQUE,               -- GHIN number (unique per golfer)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- rounds  (one round of golf a golfer played at a course)
-- ---------------------------------------------------------------------------
CREATE TABLE rounds (
    round_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    golfer_id       BIGINT      NOT NULL REFERENCES golfers (golfer_id) ON DELETE CASCADE,
    course_id       BIGINT      NOT NULL REFERENCES courses (id)        ON DELETE RESTRICT,
    -- recommended: which tees were played — needed to interpret yardages and
    -- to compute a score differential. Nullable so it's optional for now.
    tee_id          BIGINT      REFERENCES tees (id)  ON DELETE SET NULL,
    played_on       DATE        NOT NULL,             -- date the round was played
    time_of_day     TEXT        CHECK (time_of_day IN ('morning', 'afternoon', 'twilight')),
    round_duration  INTERVAL,                         -- how long the round took, e.g. '4:15'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- hole_stats  (how a golfer played one hole in one round)
--
-- This is the per-hole, per-round grain — the source of truth for all stats.
-- It joins to `holes` (for par / stroke index). Round-level numbers are
-- AGGREGATED from here (see the round_stats view below), never stored
-- separately, so they can't drift. Multi-valued vices (nicotine, weed) live in
-- their own child tables; hazards are a constrained array since a hole can hit
-- more than one.
-- ---------------------------------------------------------------------------
CREATE TABLE hole_stats (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    round_id        BIGINT      NOT NULL REFERENCES rounds (round_id) ON DELETE CASCADE,
    hole_id         BIGINT      NOT NULL REFERENCES holes  (id)       ON DELETE RESTRICT,

    score           SMALLINT    CHECK (score >= 1),         -- score on the hole
    putts           SMALLINT    CHECK (putts >= 0),

    -- Driving accuracy: par 4s & 5s only (enforce NULL on par 3 in app code).
    driving_accuracy TEXT CHECK (driving_accuracy IN
                         ('fairway', 'left', 'right', 'short', 'long')),
    gir             BOOLEAN,                                -- green in regulation
    approach_accuracy TEXT CHECK (approach_accuracy IN
                         ('on', 'short', 'long', 'left', 'right',
                          'long_left', 'short_left', 'long_right', 'short_right')),
    up_and_down     BOOLEAN,

    -- Penalty: where it happened (one or both) + how many strokes on the hole.
    penalty_locations TEXT[] NOT NULL DEFAULT '{}'
                        CHECK (penalty_locations <@ ARRAY['off_tee', 'approach']),
    penalty_strokes SMALLINT NOT NULL DEFAULT 0 CHECK (penalty_strokes >= 0),

    -- Hazards hit on the hole; empty array = none. A hole can hit several.
    hazards_hit     TEXT[]      NOT NULL DEFAULT '{}'
                        CHECK (hazards_hit <@ ARRAY[
                            'water', 'greenside_bunker', 'fairway_bunker',
                            'natural_area', 'ob'
                        ]),

    balls_lost      SMALLINT    NOT NULL DEFAULT 0 CHECK (balls_lost >= 0),
    hotdogs         SMALLINT    NOT NULL DEFAULT 0 CHECK (hotdogs >= 0),
    -- beers consumed live in hole_beer (name + size); see below.

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (round_id, hole_id)
);

-- ---------------------------------------------------------------------------
-- hole_nicotine  (nicotine consumed on a hole — type + number; many per hole)
-- ---------------------------------------------------------------------------
CREATE TABLE hole_nicotine (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hole_stat_id    BIGINT      NOT NULL REFERENCES hole_stats (id) ON DELETE CASCADE,
    -- edit the allowed set to taste:
    type            TEXT        NOT NULL CHECK (type IN
                         ('cigarette', 'cigar', 'vape', 'dip', 'pouch', 'gum')),
    quantity        SMALLINT    NOT NULL DEFAULT 1 CHECK (quantity >= 1)
);

-- ---------------------------------------------------------------------------
-- hole_weed  (weed consumed on a hole — type + amount; many per hole)
-- ---------------------------------------------------------------------------
CREATE TABLE hole_weed (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hole_stat_id    BIGINT      NOT NULL REFERENCES hole_stats (id) ON DELETE CASCADE,
    -- edit the allowed set to taste:
    type            TEXT        NOT NULL CHECK (type IN
                         ('joint', 'blunt', 'bowl', 'one_hitter', 'vape', 'dab', 'edible')),
    amount          NUMERIC(6,2),                           -- quantity in `unit`
    unit            TEXT        CHECK (unit IN ('g', 'mg', 'hits'))
);

-- ---------------------------------------------------------------------------
-- beer_options  (catalog of beers; populated at runtime — grows as users pick
--                the "other" option during round entry. No seed data here.)
-- ---------------------------------------------------------------------------
CREATE TABLE beer_options (
    beer_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT        NOT NULL UNIQUE,   -- UNIQUE so "other" upserts cleanly
    abv             NUMERIC(4,1),                  -- % alcohol by volume, e.g. 4.2
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- hole_beer  (beers consumed on a hole — name (via beer_id) + size; many/hole)
-- ---------------------------------------------------------------------------
CREATE TABLE hole_beer (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hole_stat_id    BIGINT      NOT NULL REFERENCES hole_stats  (id)      ON DELETE CASCADE,
    beer_id         BIGINT      NOT NULL REFERENCES beer_options (beer_id) ON DELETE RESTRICT,
    size_oz         NUMERIC(4,1) NOT NULL CHECK (size_oz > 0)   -- e.g. 12, 16, 19.2
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_tees_course      ON tees      (course_id);
CREATE INDEX idx_holes_course     ON holes     (course_id);
CREATE INDEX idx_hole_tees_hole   ON hole_tees (hole_id);
CREATE INDEX idx_hole_tees_tee    ON hole_tees (tee_id);
CREATE INDEX idx_rounds_golfer    ON rounds    (golfer_id);
CREATE INDEX idx_rounds_course    ON rounds    (course_id);
CREATE INDEX idx_hole_stats_round ON hole_stats    (round_id);
CREATE INDEX idx_hole_stats_hole  ON hole_stats    (hole_id);
CREATE INDEX idx_hole_nicotine    ON hole_nicotine (hole_stat_id);
CREATE INDEX idx_hole_weed        ON hole_weed     (hole_stat_id);
CREATE INDEX idx_hole_beer        ON hole_beer     (hole_stat_id);
CREATE INDEX idx_hole_beer_beer   ON hole_beer     (beer_id);

-- ---------------------------------------------------------------------------
-- keep updated_at fresh on UPDATE (Postgres)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tees_updated    BEFORE UPDATE ON tees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_holes_updated   BEFORE UPDATE ON holes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_golfers_updated BEFORE UPDATE ON golfers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rounds_updated  BEFORE UPDATE ON rounds
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_hole_stats_updated BEFORE UPDATE ON hole_stats
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_beer_options_updated BEFORE UPDATE ON beer_options
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- round_stats  (round-level totals derived from hole_stats; not a stored table)
-- ---------------------------------------------------------------------------
CREATE VIEW round_stats AS
SELECT
    hs.round_id,
    COUNT(*)                                                  AS holes_played,
    SUM(hs.score)                                             AS total_score,
    SUM(hs.putts)                                             AS total_putts,
    COUNT(*) FILTER (WHERE hs.gir)                            AS greens_in_reg,
    COUNT(*) FILTER (WHERE hs.driving_accuracy = 'fairway')   AS fairways_hit,
    COUNT(*) FILTER (WHERE hs.driving_accuracy IS NOT NULL)   AS driving_holes,
    COUNT(*) FILTER (WHERE hs.up_and_down)                    AS up_and_downs,
    COUNT(*) FILTER (WHERE hs.penalty_strokes > 0)           AS penalty_holes,
    SUM(hs.balls_lost)                                        AS balls_lost,
    COALESCE(b.beers, 0)                                      AS beers_finished,
    COALESCE(b.beer_oz, 0)                                    AS beer_oz
FROM hole_stats hs
LEFT JOIN (
    SELECT hs2.round_id,
           COUNT(*)        AS beers,
           SUM(hb.size_oz) AS beer_oz
    FROM hole_beer hb
    JOIN hole_stats hs2 ON hs2.id = hb.hole_stat_id
    GROUP BY hs2.round_id
) b ON b.round_id = hs.round_id
GROUP BY hs.round_id, b.beers, b.beer_oz;

-- ===========================================================================
-- Portability notes
-- ===========================================================================
-- Primary keys: the DDL above uses Postgres identity columns. For SQLite,
-- swap each `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` for
-- `INTEGER PRIMARY KEY`.
-- SQLite also has no TIMESTAMPTZ (use TEXT/INTEGER), no plpgsql trigger
-- syntax (use a plain BEFORE UPDATE trigger or set updated_at in app code),
-- and treats CHECK/UNIQUE the same. Replace now() with CURRENT_TIMESTAMP.
