
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Extend profiles with plan + credit + block fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS credits_remaining integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS daily_credit_limit integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS last_credit_reset date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS blocked_until timestamptz,
  ADD COLUMN IF NOT EXISTS block_reason text;

-- Admin can view + update all profiles
CREATE POLICY "admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Replace handle_new_user trigger to also seed role + plan defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, plan, daily_credit_limit, credits_remaining, last_credit_reset)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'free', 30, 30, CURRENT_DATE
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Seed roles + plan for existing users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::app_role FROM auth.users
ON CONFLICT DO NOTHING;

-- Hex => admin + premium
INSERT INTO public.user_roles (user_id, role) VALUES
  ('2fa3c2de-dcb8-4e77-88cd-84411c934231', 'admin')
ON CONFLICT DO NOTHING;

UPDATE public.profiles
  SET plan = 'premium', billing_cycle = 'yearly',
      daily_credit_limit = 100000, credits_remaining = 100000, last_credit_reset = CURRENT_DATE
  WHERE user_id = '2fa3c2de-dcb8-4e77-88cd-84411c934231';

-- 5. Credit consumption RPC (security definer)
CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _prof public.profiles;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO _prof FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
  END IF;

  -- blocked check
  IF _prof.blocked_until IS NOT NULL AND _prof.blocked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'blocked', 'blocked_until', _prof.blocked_until, 'block_reason', _prof.block_reason);
  END IF;

  -- daily reset
  IF _prof.last_credit_reset < CURRENT_DATE THEN
    UPDATE public.profiles
      SET credits_remaining = daily_credit_limit, last_credit_reset = CURRENT_DATE
      WHERE user_id = _uid
      RETURNING * INTO _prof;
  END IF;

  IF _prof.credits_remaining < _amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'remaining', _prof.credits_remaining);
  END IF;

  UPDATE public.profiles SET credits_remaining = credits_remaining - _amount WHERE user_id = _uid
    RETURNING * INTO _prof;

  RETURN jsonb_build_object('ok', true, 'remaining', _prof.credits_remaining, 'limit', _prof.daily_credit_limit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_credits(integer) TO authenticated;

-- 6. Daily reset job
CREATE OR REPLACE FUNCTION public.reset_daily_credits_all()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.profiles
    SET credits_remaining = daily_credit_limit, last_credit_reset = CURRENT_DATE
    WHERE last_credit_reset < CURRENT_DATE;
$$;

-- pg_cron should already be enabled from monitor migration
SELECT cron.schedule(
  'meow-daily-credit-reset',
  '5 0 * * *',
  $$SELECT public.reset_daily_credits_all();$$
);
