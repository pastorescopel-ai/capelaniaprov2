-- 1. Adiciona a coluna auth_id na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- 2. Cria a função auxiliar para obter o ID do usuário interno a partir do auth.uid()
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Atualiza as políticas RLS da tabela users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas (se existirem)
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;
DROP POLICY IF EXISTS "Enable update for users based on email" ON users;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON users;
DROP POLICY IF EXISTS "Allow public read users" ON users;
DROP POLICY IF EXISTS "Allow users to update themselves" ON users;

-- Nova política: Leitura pública (necessário para o login legado/migração achar o usuário pelo e-mail)
CREATE POLICY "Allow public read users" ON users FOR SELECT USING (true);

-- Nova política: Inserção
CREATE POLICY "Allow authenticated to insert users" ON users FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.uid() IS NULL);

-- Nova política: Atualização (o usuário pode se atualizar se o auth_id bater, ou se ainda não tiver auth_id - migração)
CREATE POLICY "Allow users to update themselves" ON users FOR UPDATE 
USING (auth_id = auth.uid() OR auth.uid() IS NULL);

-- 4. Atualiza as políticas RLS da tabela activity_schedules
ALTER TABLE activity_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON activity_schedules;
DROP POLICY IF EXISTS "Allow public read schedules" ON activity_schedules;
DROP POLICY IF EXISTS "Allow authenticated to insert schedules" ON activity_schedules;
DROP POLICY IF EXISTS "Allow authenticated to update schedules" ON activity_schedules;
DROP POLICY IF EXISTS "Allow authenticated to delete schedules" ON activity_schedules;

CREATE POLICY "Allow public read schedules" ON activity_schedules FOR SELECT USING (true);
CREATE POLICY "Allow authenticated to insert schedules" ON activity_schedules FOR INSERT WITH CHECK (user_id = auth_user_id() OR auth.uid() IS NULL);
CREATE POLICY "Allow authenticated to update schedules" ON activity_schedules FOR UPDATE USING (user_id = auth_user_id() OR auth.uid() IS NULL);
CREATE POLICY "Allow authenticated to delete schedules" ON activity_schedules FOR DELETE USING (user_id = auth_user_id() OR auth.uid() IS NULL);

-- 5. Atualiza as políticas RLS da tabela daily_activity_reports
ALTER TABLE daily_activity_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON daily_activity_reports;
DROP POLICY IF EXISTS "Allow public read reports" ON daily_activity_reports;
DROP POLICY IF EXISTS "Allow authenticated to insert reports" ON daily_activity_reports;
DROP POLICY IF EXISTS "Allow authenticated to update reports" ON daily_activity_reports;
DROP POLICY IF EXISTS "Allow authenticated to delete reports" ON daily_activity_reports;

CREATE POLICY "Allow public read reports" ON daily_activity_reports FOR SELECT USING (true);
CREATE POLICY "Allow authenticated to insert reports" ON daily_activity_reports FOR INSERT WITH CHECK (user_id = auth_user_id() OR auth.uid() IS NULL);
CREATE POLICY "Allow authenticated to update reports" ON daily_activity_reports FOR UPDATE USING (user_id = auth_user_id() OR auth.uid() IS NULL);
CREATE POLICY "Allow authenticated to delete reports" ON daily_activity_reports FOR DELETE USING (user_id = auth_user_id() OR auth.uid() IS NULL);

-- Nota: O 'OR auth.uid() IS NULL' é mantido temporariamente para garantir que a migração não quebre
-- requisições legadas durante o rollout. Assim que todos migrarem, podemos remover essa cláusula.
