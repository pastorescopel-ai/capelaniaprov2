-- #################################################################
-- # SCHEMA V3.2 - CAPELANIA PRO (SUPORTE TOTAL A REALTIME & BRIDGE)
-- #################################################################

-- TABELA: USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CHAPLAIN',
    profile_pic TEXT,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- TABELA: VISIT REQUESTS (BRIDGE COM APP DE PGs)
CREATE TABLE IF NOT EXISTS visit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pg_name TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    leader_phone TEXT,
    unit TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    request_notes TEXT,
    preferred_chaplain_id TEXT, -- Alterado para TEXT para flexibilidade
    assigned_chaplain_id TEXT,  -- Alterado para TEXT para flexibilidade
    chaplain_response TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- Habilitar RLS e Realtime
ALTER TABLE visit_requests ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: Ativar transmissão em tempo real
-- Execute manualmente se necessário: ALTER PUBLICATION supabase_realtime ADD TABLE visit_requests;

-- Políticas de Acesso Público para a Ponte (Permitir App PGs inserir)
CREATE POLICY "Permitir inserção via bridge" ON visit_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Acesso completo autenticado" ON visit_requests FOR ALL TO authenticated USING (true);

-- Outras tabelas do sistema seguem o padrão BIGINT para sincronia offline
CREATE TABLE IF NOT EXISTS bible_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    unit TEXT NOT NULL,
    sector TEXT NOT NULL,
    name TEXT NOT NULL,
    whatsapp TEXT,
    status TEXT NOT NULL,
    guide TEXT NOT NULL,
    lesson TEXT NOT NULL,
    observations TEXT,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- Habilitar RLS nas demais tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_studies ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para autenticados
CREATE POLICY "Public Access Users" ON users FOR ALL USING (true);
CREATE POLICY "Public Access Studies" ON bible_studies FOR ALL USING (true);