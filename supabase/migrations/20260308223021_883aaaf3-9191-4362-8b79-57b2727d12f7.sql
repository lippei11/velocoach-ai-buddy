
-- athlete_profiles table
CREATE TABLE public.athlete_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  intervals_athlete_id text,
  name text,
  email text,
  ftp integer,
  max_hr integer,
  resting_hr integer,
  weight numeric,
  sport_types jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data only" ON public.athlete_profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (auth.uid() = user_id);
