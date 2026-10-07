-- SECURITY FIX (P0): any signed-in employee could set their own profiles.role to
-- 'admin' straight through the public Supabase API, and anyone (even signed out)
-- could read every profile (emails + roles).
--
-- The app only touches `profiles` from the server with the service-role key, which
-- bypasses RLS — so locking the table down for anon/authenticated breaks nothing.
-- Run once in Supabase → SQL Editor.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy on profiles (names unknown / created in the dashboard)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', p.policyname);
  END LOOP;
END $$;

-- A signed-in user may read their own row only. No INSERT/UPDATE/DELETE policies:
-- writes happen only from the server (service role).
CREATE POLICY "profiles: read own row" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Belt and braces: even if a permissive policy is added later, the role column
-- can't be changed by API users.
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;

-- Verify (should list only the policy above):
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'profiles';
