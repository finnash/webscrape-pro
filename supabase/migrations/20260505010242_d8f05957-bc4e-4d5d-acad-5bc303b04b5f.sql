-- Allowlist of emails permitted to sign up.
CREATE TABLE IF NOT EXISTS public.signup_allowlist (
  email TEXT PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_allowlist ENABLE ROW LEVEL SECURITY;
-- No policies: only service role / triggers can read it. Clients cannot.

INSERT INTO public.signup_allowlist (email, note) VALUES
  ('iamhex.contact@gmail.com', 'admin (Finn)'),
  ('statemediaandco@gmail.com', 'state media')
ON CONFLICT (email) DO NOTHING;

-- Trigger that blocks any new auth.users insert whose email is not allowlisted.
CREATE OR REPLACE FUNCTION public.enforce_signup_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.signup_allowlist WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'SIGNUP_RESTRICTED: Signup is restricted. Contact Finn for a Firecrawl Pro invite.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_signup_allowlist_trg ON auth.users;
CREATE TRIGGER enforce_signup_allowlist_trg
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_signup_allowlist();