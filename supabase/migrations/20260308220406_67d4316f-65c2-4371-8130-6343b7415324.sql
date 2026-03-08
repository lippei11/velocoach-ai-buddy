
ALTER TABLE athlete_connections
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;
