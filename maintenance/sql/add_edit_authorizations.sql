-- Create edit_authorizations table
CREATE TABLE IF NOT EXISTS edit_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  allowed_tabs TEXT[] NOT NULL,
  month_to_unlock DATE NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id)
);

-- Enable RLS
ALTER TABLE edit_authorizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid errors on re-run
DROP POLICY IF EXISTS "Admins can do everything on edit_authorizations" ON edit_authorizations;
DROP POLICY IF EXISTS "Users can read their own edit_authorizations" ON edit_authorizations;

-- Policies
CREATE POLICY "Admins can do everything on edit_authorizations"
  ON edit_authorizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Users can read their own edit_authorizations"
  ON edit_authorizations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
