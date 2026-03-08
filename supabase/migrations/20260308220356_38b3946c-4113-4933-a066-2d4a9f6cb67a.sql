
-- Columns were already added by previous migration (IF NOT EXISTS). 
-- Just verify they exist by selecting from the table.
SELECT column_name FROM information_schema.columns WHERE table_name = 'athlete_connections' AND table_schema = 'public';
