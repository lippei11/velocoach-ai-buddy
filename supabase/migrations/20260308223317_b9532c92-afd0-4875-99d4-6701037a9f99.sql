
-- Add unique constraints for idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS activities_user_external_id_idx ON public.activities (user_id, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS wellness_days_user_date_idx ON public.wellness_days (user_id, date);
