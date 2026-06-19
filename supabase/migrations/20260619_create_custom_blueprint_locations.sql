-- Migration to create table for custom blueprint locations
CREATE TABLE IF NOT EXISTS public.custom_blueprint_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'HAB',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_name_unit UNIQUE (name, unit)
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.custom_blueprint_locations ENABLE ROW LEVEL SECURITY;

-- Creating policies safely (dropping first if they exist to prevent 42710 error on re-execution)
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.custom_blueprint_locations;
CREATE POLICY "Allow read access for authenticated users" ON public.custom_blueprint_locations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all access for admin users" ON public.custom_blueprint_locations;
CREATE POLICY "Allow all access for admin users" ON public.custom_blueprint_locations
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE (users.auth_id = auth.uid() OR users.id = auth.uid())
        AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE (users.auth_id = auth.uid() OR users.id = auth.uid())
        AND users.role = 'ADMIN'
    )
  );
