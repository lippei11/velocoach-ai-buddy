ALTER TABLE public.athlete_connections
  ADD COLUMN IF NOT EXISTS dexcom_username text,
  ADD COLUMN IF NOT EXISTS dexcom_password_vault_id uuid,
  ADD COLUMN IF NOT EXISTS dexcom_session_id text,
  ADD COLUMN IF NOT EXISTS dexcom_connected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dexcom_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS dexcom_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS dexcom_last_error text;