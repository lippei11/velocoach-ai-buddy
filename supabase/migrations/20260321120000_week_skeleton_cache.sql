-- ============================================================
-- week_skeleton_cache
-- Cached output of the generate-week-skeleton edge function.
--
-- Keyed by (user_id, week_start_date) — one cached skeleton
-- per user per week.  The input_fingerprint encodes the full
-- set of planning inputs; a fingerprint mismatch means the
-- athlete_state changed or the model changed, so the cache
-- is stale and must be regenerated.
--
-- Only successfully validated WeekSkeletons are ever written.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.week_skeleton_cache (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        REFERENCES auth.users NOT NULL,
  week_start_date           date        NOT NULL,
  input_fingerprint         text        NOT NULL,
  athlete_state_computed_at timestamptz NOT NULL,
  planning_model            text        NOT NULL,
  week_skeleton_json        jsonb       NOT NULL,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS week_skeleton_cache_user_week
  ON public.week_skeleton_cache (user_id, week_start_date);

ALTER TABLE public.week_skeleton_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'week_skeleton_cache'
      AND policyname = 'own data only'
  ) THEN
    CREATE POLICY "own data only" ON public.week_skeleton_cache
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
