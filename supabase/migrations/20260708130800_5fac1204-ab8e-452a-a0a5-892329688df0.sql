
DROP POLICY IF EXISTS "Anyone can insert people" ON public.people;
DROP POLICY IF EXISTS "Anyone can update people" ON public.people;
DROP POLICY IF EXISTS "Anyone can delete people" ON public.people;

-- Public read remains (kiosk display).
-- Writes are performed by trusted server code using the service role,
-- which bypasses RLS. No client-role write policies are defined.

REVOKE INSERT, UPDATE, DELETE ON public.people FROM anon, authenticated;
