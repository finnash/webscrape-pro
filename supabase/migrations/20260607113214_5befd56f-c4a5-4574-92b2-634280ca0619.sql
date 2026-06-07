
CREATE TABLE public.gmb_scrape_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  location text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  limit_count integer NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'pending',
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  error text,
  credits_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmb_scrape_runs TO authenticated;
GRANT ALL ON public.gmb_scrape_runs TO service_role;

ALTER TABLE public.gmb_scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own gmb runs" ON public.gmb_scrape_runs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins view all gmb runs" ON public.gmb_scrape_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_gmb_runs_updated BEFORE UPDATE ON public.gmb_scrape_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gmb_runs_user_created ON public.gmb_scrape_runs(user_id, created_at DESC);
