
ALTER TABLE public.snapshot_runs
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recipe jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

ALTER TABLE public.snapshot_runs ALTER COLUMN snapshot_id DROP NOT NULL;

DROP TRIGGER IF EXISTS update_snapshot_runs_updated_at ON public.snapshot_runs;
CREATE TRIGGER update_snapshot_runs_updated_at
  BEFORE UPDATE ON public.snapshot_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.snapshot_runs;
ALTER TABLE public.snapshot_runs REPLICA IDENTITY FULL;
