-- ============================================================
-- plans: new columns for plan creation flow
-- ============================================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS plan_start_date date,
  ADD COLUMN IF NOT EXISTS macro_strategy text,
  ADD COLUMN IF NOT EXISTS plan_structure_json jsonb,
  ADD COLUMN IF NOT EXISTS entry_state text DEFAULT 'fresh_start',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Ensure status column exists with correct default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN status text DEFAULT 'active';
  END IF;
END $$;

-- ============================================================
-- blocks: mesocycle records derived from plan phases
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.plans NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  phase text NOT NULL,
  block_number integer NOT NULL,
  block_number_in_phase integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  weeks integer NOT NULL,
  load_weeks integer NOT NULL,
  deload_week_numbers jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'upcoming',
  user_inputs_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blocks_plan_id ON public.blocks (plan_id);
CREATE INDEX IF NOT EXISTS blocks_user_status ON public.blocks (user_id, status);
CREATE INDEX IF NOT EXISTS blocks_user_dates ON public.blocks (user_id, start_date, end_date);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blocks'
      AND policyname = 'own data only'
  ) THEN
    CREATE POLICY "own data only" ON public.blocks
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- athlete_preferences: formalize columns used by hook
-- ============================================================
ALTER TABLE public.athlete_preferences
  ADD COLUMN IF NOT EXISTS goal_type text,
  ADD COLUMN IF NOT EXISTS event_name text,
  ADD COLUMN IF NOT EXISTS constraints_notes text;
