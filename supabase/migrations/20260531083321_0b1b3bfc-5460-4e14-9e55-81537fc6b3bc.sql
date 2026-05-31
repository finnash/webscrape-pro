-- Monitors: watch a URL on a schedule, diff content, fire Discord webhook on change
CREATE TABLE public.monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  interval_minutes integer NOT NULL DEFAULT 60,
  discord_webhook_url text,
  selector text,
  keywords text[],
  enabled boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_hash text,
  last_snapshot text,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.monitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  summary text,
  diff text,
  matched_keywords text[],
  snapshot text,
  delivered_to_discord boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_monitors_user ON public.monitors(user_id);
CREATE INDEX idx_monitors_enabled_due ON public.monitors(enabled, last_checked_at);
CREATE INDEX idx_monitor_events_monitor ON public.monitor_events(monitor_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitors TO authenticated;
GRANT ALL ON public.monitors TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitor_events TO authenticated;
GRANT ALL ON public.monitor_events TO service_role;

ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own monitors" ON public.monitors
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own monitor events" ON public.monitor_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own monitor events" ON public.monitor_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_monitors_updated_at
BEFORE UPDATE ON public.monitors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();