
-- Normalized activity store
create table activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  external_id text not null,
  source text not null default 'intervals',
  start_date date not null,
  name text,
  sport_type text,
  duration_seconds integer,
  distance_meters numeric,
  tss numeric,
  normalized_power integer,
  avg_hr integer,
  ftp_at_time integer,
  intensity_factor numeric,
  zone_times jsonb default '{}',
  raw_data jsonb default '{}',
  created_at timestamptz default now(),
  unique(user_id, external_id, source)
);

-- Wellness store
create table wellness_days (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  date date not null,
  ctl numeric,
  atl numeric,
  tsb numeric,
  ramp_rate numeric,
  hrv numeric,
  resting_hr integer,
  sleep_score numeric,
  weight numeric,
  source text default 'intervals',
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- Training plans (structured, versioned)
create table plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  version integer not null default 1,
  status text not null default 'active',
  goal_event text,
  goal_type text,
  event_date date,
  race_priority text default 'A',
  philosophy text default 'ai_decides',
  fitness_context text,
  current_ctl numeric,
  target_ctl numeric,
  hours_per_week numeric,
  available_days jsonb default '[]',
  phases jsonb default '[]',
  rationale text,
  created_at timestamptz default now()
);

-- Planned workouts
create table planned_workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  plan_id uuid references plans,
  date date not null,
  name text not null,
  purpose text,
  workout_type text,
  duration_minutes integer,
  tss_target numeric,
  description text,
  intervals_event_id text,
  synced_to_intervals boolean default false,
  created_at timestamptz default now()
);

-- Plan adjustments
create table plan_adjustments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  plan_id uuid references plans not null,
  reason text not null,
  trigger_type text not null,
  affected_workout_ids jsonb default '[]',
  changes jsonb not null default '{}',
  explanation text,
  created_at timestamptz default now()
);

-- RLS
alter table activities enable row level security;
alter table wellness_days enable row level security;
alter table plans enable row level security;
alter table planned_workouts enable row level security;
alter table plan_adjustments enable row level security;

-- Policies
create policy "own data only" on activities for all using (auth.uid() = user_id);
create policy "own data only" on wellness_days for all using (auth.uid() = user_id);
create policy "own data only" on plans for all using (auth.uid() = user_id);
create policy "own data only" on planned_workouts for all using (auth.uid() = user_id);
create policy "own data only" on plan_adjustments for all using (auth.uid() = user_id);
