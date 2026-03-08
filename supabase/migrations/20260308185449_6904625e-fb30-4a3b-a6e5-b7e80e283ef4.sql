
-- Athlete connections
create table athlete_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  intervals_athlete_id text not null,
  intervals_api_key text not null,
  dexcom_access_token text,
  dexcom_refresh_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chat conversations
create table conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null default 'New Chat',
  created_at timestamptz default now()
);

-- Chat messages
create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations not null,
  user_id uuid references auth.users not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Training plans
create table training_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  goal_event text,
  event_date date,
  plan_data jsonb not null default '{}',
  fitness_context text,
  generated_at timestamptz default now(),
  synced_to_intervals boolean default false
);

-- RLS policies
create policy "own data only" on athlete_connections
  for all using (auth.uid() = user_id);

create policy "own data only" on conversations
  for all using (auth.uid() = user_id);

create policy "own data only" on chat_messages
  for all using (auth.uid() = user_id);

create policy "own data only" on training_plans
  for all using (auth.uid() = user_id);
