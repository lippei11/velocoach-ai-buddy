-- ============================================================
-- athlete_preferences
-- Source of Truth for Training Setup (see docs/data-ownership.md)
-- Create only if missing; otherwise add missing columns only.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.athlete_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  event_demand_profile text,
  event_date date,
  hours_per_week numeric,
  available_days jsonb DEFAULT '[]',
  prefer_outdoor_long_ride boolean DEFAULT false,
  prefer_indoor_intervals boolean DEFAULT false,
  training_time_of_day text,
  strength_sessions_per_week integer,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.athlete_preferences
  ADD COLUMN IF NOT EXISTS event_demand_profile text,
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS hours_per_week numeric,
  ADD COLUMN IF NOT EXISTS available_days jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS prefer_outdoor_long_ride boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS prefer_indoor_intervals boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_time_of_day text,
  ADD COLUMN IF NOT EXISTS strength_sessions_per_week integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.athlete_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'athlete_preferences'
      AND policyname = 'own data only'
  ) THEN
    CREATE POLICY "own data only" ON public.athlete_preferences
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- athlete_state
-- Cached output of compute-athlete-context Edge Function
-- This is a compiled snapshot/cache table, NOT a source-of-truth table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.athlete_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  computed_at timestamptz NOT NULL,
  state_json jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.athlete_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'athlete_state'
      AND policyname = 'own data only'
  ) THEN
    CREATE POLICY "own data only" ON public.athlete_state
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- Extend planned_workouts with completion/runtime fields
-- ============================================================

ALTER TABLE public.planned_workouts
  ADD COLUMN IF NOT EXISTS stress_type text,
  ADD COLUMN IF NOT EXISTS planned_tss numeric,
  ADD COLUMN IF NOT EXISTS executed_tss numeric,
  ADD COLUMN IF NOT EXISTS completion_status text DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS match_confidence numeric,
  ADD COLUMN IF NOT EXISTS intervals_icu_id text;

-- ============================================================
-- Extend plans with coaching snapshot metadata
-- plans are snapshots, not current setup source of truth
-- ============================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS event_demand_profile text,
  ADD COLUMN IF NOT EXISTS typology text,
  ADD COLUMN IF NOT EXISTS constitution_version text;
