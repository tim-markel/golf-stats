-- 005_course_dedup.sql :: prevent duplicate courses
--
-- Unique on a normalized course name (case-insensitive, dash-insensitive) so
-- the same course can't be scraped in twice. The scraper also checks this
-- before inserting (see scraper/db.py); the index is the safety net.
CREATE UNIQUE INDEX IF NOT EXISTS courses_norm_name_key
    ON courses (lower(regexp_replace(name, '[–—]', '-', 'g')));
