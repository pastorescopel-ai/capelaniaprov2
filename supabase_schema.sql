
-- #################################################################
-- # SCHEMA V3.4 - CORREÇÃO DE MIGRAÇÃO (RLS SAFE)
-- #################################################################

-- 1. GARANTIR TABELAS (IF NOT EXISTS preserva dados)

CREATE TABLE IF NOT EXISTS pro_sectors (
    id TEXT PRIMARY KEY, 
    name TEXT NOT NULL, 
    unit TEXT NOT NULL CHECK (unit IN ('HAB', 'HABA')), 
    active BOOLEAN DEFAULT true,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

CREATE TABLE IF NOT EXISTS pro_staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, 
    sector_id TEXT REFERENCES pro_sectors(id) ON UPDATE CASCADE, 
    unit TEXT NOT NULL,
    whatsapp TEXT,
    active BOOLEAN DEFAULT true,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

CREATE TABLE IF NOT EXISTS pro_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, 
    current_leader TEXT, 
    leader_phone TEXT,
    sector_id TEXT REFERENCES pro_sectors(id) ON UPDATE CASCADE, 
    unit TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

CREATE TABLE IF NOT EXISTS visit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pg_name TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    leader_phone TEXT,
    unit TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    request_notes TEXT,
    preferred_chaplain_id TEXT,
    assigned_chaplain_id TEXT,
    chaplain_response TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- 2. FUNÇÕES RPC DE MIGRAÇÃO (CREATE OR REPLACE atualiza sem erro)

CREATE OR REPLACE FUNCTION migrate_legacy_sector(old_name text, new_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    count_studies int;
    count_classes int;
    count_groups int;
    count_visits int;
BEGIN
    -- Atualiza Estudos Bíblicos
    UPDATE bible_studies SET sector = new_name WHERE sector = old_name;
    GET DIAGNOSTICS count_studies = ROW_COUNT;

    -- Atualiza Classes Bíblicas
    UPDATE bible_classes SET sector = new_name WHERE sector = old_name;
    GET DIAGNOSTICS count_classes = ROW_COUNT;

    -- Atualiza Pequenos Grupos (Histórico)
    UPDATE small_groups SET sector = new_name WHERE sector = old_name;
    GET DIAGNOSTICS count_groups = ROW_COUNT;

    -- Atualiza Visitas
    UPDATE staff_visits SET sector = new_name WHERE sector = old_name;
    GET DIAGNOSTICS count_visits = ROW_COUNT;

    RETURN 'Migração Concluída: ' || count_studies || ' estudos, ' || count_classes || ' classes, ' || count_groups || ' PGs, ' || count_visits || ' visitas.';
END;
$$;

CREATE OR REPLACE FUNCTION migrate_legacy_pg(old_name text, new_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    count_groups int;
    count_requests int;
BEGIN
    -- Atualiza Pequenos Grupos (Histórico)
    UPDATE small_groups SET group_name = new_name WHERE group_name = old_name;
    GET DIAGNOSTICS count_groups = ROW_COUNT;

    -- Atualiza Visit Requests
    UPDATE visit_requests SET pg_name = new_name WHERE pg_name = old_name;
    GET DIAGNOSTICS count_requests = ROW_COUNT;

    RETURN 'PG Migrado: ' || count_groups || ' registros de histórico, ' || count_requests || ' solicitações.';
END;
$$;

-- 3. POLÍTICAS RLS (DROP + CREATE para evitar erro 42710)

-- Habilitar RLS nas tabelas (se já estiver habilitado, não gera erro)
ALTER TABLE pro_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_requests ENABLE ROW LEVEL SECURITY;

-- Visit Requests
DROP POLICY IF EXISTS "Permitir inserção via bridge" ON visit_requests;
CREATE POLICY "Permitir inserção via bridge" ON visit_requests FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso completo autenticado" ON visit_requests;
CREATE POLICY "Acesso completo autenticado" ON visit_requests FOR ALL TO authenticated USING (true);

-- Pro Sectors
DROP POLICY IF EXISTS "Public Read Sectors" ON pro_sectors;
CREATE POLICY "Public Read Sectors" ON pro_sectors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Write Sectors" ON pro_sectors;
CREATE POLICY "Public Write Sectors" ON pro_sectors FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Sectors" ON pro_sectors;
CREATE POLICY "Public Update Sectors" ON pro_sectors FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Sectors" ON pro_sectors;
CREATE POLICY "Public Delete Sectors" ON pro_sectors FOR DELETE USING (true);

-- Pro Staff
DROP POLICY IF EXISTS "Public Read Staff" ON pro_staff;
CREATE POLICY "Public Read Staff" ON pro_staff FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Write Staff" ON pro_staff;
CREATE POLICY "Public Write Staff" ON pro_staff FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Staff" ON pro_staff;
CREATE POLICY "Public Update Staff" ON pro_staff FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Staff" ON pro_staff;
CREATE POLICY "Public Delete Staff" ON pro_staff FOR DELETE USING (true);

-- Pro Groups
DROP POLICY IF EXISTS "Public Read Groups" ON pro_groups;
CREATE POLICY "Public Read Groups" ON pro_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Write Groups" ON pro_groups;
CREATE POLICY "Public Write Groups" ON pro_groups FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Groups" ON pro_groups;
CREATE POLICY "Public Update Groups" ON pro_groups FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Groups" ON pro_groups;
CREATE POLICY "Public Delete Groups" ON pro_groups FOR DELETE USING (true);
