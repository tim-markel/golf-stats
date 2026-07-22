-- 004_course_state.sql :: state/region for courses
--
-- Lets the UI show "City, ST" (e.g. "Lansing, MI"). Populated by the scraper;
-- NULL for courses added before this column existed.
ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS state TEXT;
