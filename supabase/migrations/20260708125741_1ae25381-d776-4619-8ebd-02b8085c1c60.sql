
CREATE TABLE public.people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  photo_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO anon, authenticated;
GRANT ALL ON public.people TO service_role;

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read people" ON public.people FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert people" ON public.people FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update people" ON public.people FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete people" ON public.people FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
