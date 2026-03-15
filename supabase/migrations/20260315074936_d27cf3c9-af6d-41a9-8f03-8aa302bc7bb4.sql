
CREATE TABLE public.athlete_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_type text DEFAULT 'event',
  event_name text,
  event_date date,
  event_demand_profile text DEFAULT 'road_race',
  hours_per_week numeric DEFAULT 10,
  available_days jsonb DEFAULT '["Tue","Thu","Sat","Sun"]'::jsonb,
  prefer_outdoor_long_ride boolean DEFAULT true,
  prefer_indoor_intervals boolean DEFAULT true,
  strength_sessions_per_week integer DEFAULT 0,
  constraints_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.athlete_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own data only" ON public.athlete_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
