-- ============================================================
-- TOTOYA Aiea - Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. AVAILABILITY TABLE (staff shift requests)
CREATE TABLE IF NOT EXISTS availability (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_name    TEXT NOT NULL,
  week          TEXT NOT NULL,
  selected_slots JSONB NOT NULL DEFAULT '{}',
  requests      TEXT DEFAULT '',
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_name, week)
);

-- 2. PUBLISHED SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS schedules (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week          TEXT NOT NULL UNIQUE,
  shifts        JSONB NOT NULL DEFAULT '[]',
  published_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STAFF SKILLS & RULES TABLE
CREATE TABLE IF NOT EXISTS staff_skills (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  plater      INT DEFAULT 0 CHECK (plater BETWEEN 0 AND 3),
  miso        INT DEFAULT 0 CHECK (miso BETWEEN 0 AND 3),
  host        INT DEFAULT 0 CHECK (host BETWEEN 0 AND 3),
  supporter   INT DEFAULT 0 CHECK (supporter BETWEEN 0 AND 3),
  prep        INT DEFAULT 0 CHECK (prep BETWEEN 0 AND 3),
  energy      INT DEFAULT 0 CHECK (energy BETWEEN 0 AND 3),
  leadership  INT DEFAULT 0 CHECK (leadership BETWEEN 0 AND 3),
  min_shifts  INT DEFAULT 2,
  max_shifts  INT DEFAULT 5,
  consecutive BOOLEAN DEFAULT FALSE,
  avoid       TEXT DEFAULT NULL
);

-- 4. Enable Row Level Security (RLS) - allow all for anon (simplest setup)
ALTER TABLE availability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_skills   ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write (staff uses anon key, no auth needed)
CREATE POLICY "public_all_availability"  ON availability  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all_schedules"     ON schedules     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all_staff_skills"  ON staff_skills  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE availability;
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;

-- 6. Seed initial staff data
INSERT INTO staff_skills (name, plater, miso, host, supporter, prep, energy, leadership, min_shifts, max_shifts, consecutive, avoid) VALUES
  ('Aljon Padilla',    2,2,2,2,2,2,2, 6,8, TRUE,  'Sean Rasay'),
  ('Cole Tanaka',      1,1,1,1,1,1,1, 1,3, FALSE, NULL),
  ('Donavan Tarpley',  2,2,3,2,2,2,2, 3,6, FALSE, 'Jazmin Delaney'),
  ('Elizabeth Nguyen', 2,2,2,2,2,2,2, 3,4, FALSE, NULL),
  ('Jayla Wada',       2,2,2,2,2,2,1, 3,4, FALSE, NULL),
  ('Jazmin Delaney',   2,3,2,3,2,2,2, 3,6, FALSE, 'Donavan Tarpley'),
  ('Jazmin Williams',  2,2,2,2,1,2,1, 2,4, FALSE, NULL),
  ('Martin Hu',        2,2,2,2,2,1,2, 2,4, FALSE, NULL),
  ('Noah Rosa',        1,2,1,1,1,1,1, 1,2, FALSE, NULL),
  ('Rafunzele Yap',    2,2,2,2,2,2,2, 2,3, FALSE, NULL),
  ('Sean Rasay',       3,3,3,3,2,3,3, 4,5, TRUE,  'Aljon Padilla'),
  ('Tommy Tran',       2,2,2,2,2,2,2, 2,5, FALSE, NULL),
  ('Tyrel Maielua',    2,3,2,3,2,2,2, 3,5, FALSE, NULL),
  ('Victor Khamkhay',  2,2,2,2,2,2,2, 2,4, FALSE, NULL),
  ('Yangjun Liang',    2,2,3,2,2,2,2, 3,4, TRUE,  NULL)
ON CONFLICT (name) DO NOTHING;
