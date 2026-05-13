
CREATE TABLE public.snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  description text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipe jsonb NOT NULL DEFAULT '[]'::jsonb,
  deliverables text[] NOT NULL DEFAULT ARRAY['markdown']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own snapshots" ON public.snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own snapshots" ON public.snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own snapshots" ON public.snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own snapshots" ON public.snapshots FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_snapshots_updated_at
BEFORE UPDATE ON public.snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.snapshot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  credits_used int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snapshot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own snapshot runs" ON public.snapshot_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own snapshot runs" ON public.snapshot_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own snapshot runs" ON public.snapshot_runs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own snapshot runs" ON public.snapshot_runs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_snapshot_runs_snapshot ON public.snapshot_runs(snapshot_id);
