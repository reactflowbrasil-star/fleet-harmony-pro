-- =====================================================
-- Auto-link driver record by email on first login
-- =====================================================
-- When a driver logs in for the first time and the admin had created their
-- drivers row but the user_id link wasn't set (e.g., Edge Function not
-- deployed, or client-side signUp returned no user_id), the driver landed
-- on a friendly "no driver linked" empty state.
--
-- This RPC, callable from the driver portal, looks up a drivers row in the
-- caller's email AND with user_id NULL, and links it to the caller's auth
-- user id. Runs as SECURITY DEFINER so it doesn't require opening up the
-- drivers UPDATE RLS to drivers themselves.
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_link_driver_self()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id  UUID := auth.uid();
  _email    TEXT;
  _driver_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the caller's email from the JWT
  SELECT lower(email) INTO _email
  FROM auth.users
  WHERE id = _user_id;
  IF _email IS NULL OR length(_email) = 0 THEN
    RETURN NULL;
  END IF;

  -- If already linked, return current driver id
  SELECT id INTO _driver_id
  FROM public.drivers
  WHERE user_id = _user_id
  LIMIT 1;
  IF _driver_id IS NOT NULL THEN
    RETURN _driver_id;
  END IF;

  -- Find an unlinked drivers row with matching email
  SELECT id INTO _driver_id
  FROM public.drivers
  WHERE lower(email) = _email
    AND user_id IS NULL
  LIMIT 1;
  IF _driver_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Link
  UPDATE public.drivers
     SET user_id = _user_id,
         updated_at = now()
   WHERE id = _driver_id;

  -- Ensure user has 'driver' role inside the right company (idempotent)
  INSERT INTO public.user_roles (user_id, role, company_id)
  SELECT _user_id, 'driver'::public.app_role, d.company_id
  FROM public.drivers d
  WHERE d.id = _driver_id
  ON CONFLICT DO NOTHING;

  RETURN _driver_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_link_driver_self() TO authenticated;
