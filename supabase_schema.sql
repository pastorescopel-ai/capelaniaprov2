
-- #################################################################
-- # SCHEMA V4.3 - ESTRUTURA OFICIAL (BIGINT + RELATIONAL)
-- #################################################################

-- 1. TABELAS MESTRAS (Tipos Numéricos para IDs Oficiais)

CREATE TABLE IF NOT EXISTS pro_sectors (
    id BIGINT PRIMARY KEY, -- ID Numérico (ex: 10, 20)
    name TEXT NOT NULL, 
    unit TEXT NOT NULL CHECK (unit IN ('HAB', 'HABA')), 
    active BOOLEAN DEFAULT true,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

CREATE TABLE IF NOT EXISTS pro_staff (
    id BIGINT PRIMARY KEY, -- Matrícula Numérica (ex: 102030)
    name TEXT NOT NULL, 
    sector_id BIGINT REFERENCES pro_sectors(id) ON UPDATE CASCADE, 
    unit TEXT NOT NULL,
    whatsapp TEXT,
    active BOOLEAN DEFAULT true,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

CREATE TABLE IF NOT EXISTS pro_groups (
    id BIGINT PRIMARY KEY, -- ID Numérico do PG
    name TEXT NOT NULL, 
    current_leader TEXT, 
    leader_phone TEXT,
    sector_id BIGINT REFERENCES pro_sectors(id) ON UPDATE CASCADE, 
    unit TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- 2. TABELAS DE VÍNCULO E OPERAÇÃO

CREATE TABLE IF NOT EXISTS pro_group_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id BIGINT REFERENCES pro_groups(id) ON DELETE CASCADE,
    sector_id BIGINT REFERENCES pro_sectors(id) ON DELETE CASCADE,
    unit TEXT NOT NULL,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

CREATE TABLE IF NOT EXISTS pro_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id BIGINT REFERENCES pro_groups(id) ON DELETE CASCADE,
    staff_id BIGINT REFERENCES pro_staff(id) ON DELETE CASCADE,
    joined_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    left_at BIGINT -- Data de saída (Soft Delete de membresia)
);

-- Tabelas de Entidades Externas (Mantêm UUID/Text pois são gerados pelo App)
CREATE TABLE IF NOT EXISTS pro_patients (
    id TEXT PRIMARY KEY, 
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    whatsapp TEXT,
    last_lesson TEXT,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

CREATE TABLE IF NOT EXISTS pro_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    whatsapp TEXT,
    sector TEXT,
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

-- 3. POLÍTICAS RLS (Segurança)

ALTER TABLE pro_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_group_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_requests ENABLE ROW LEVEL SECURITY;

-- Políticas Públicas (Ajuste conforme necessidade de auth)
CREATE POLICY "Public Access Sectors" ON pro_sectors FOR ALL USING (true);
CREATE POLICY "Public Access Staff" ON pro_staff FOR ALL USING (true);
CREATE POLICY "Public Access Groups" ON pro_groups FOR ALL USING (true);
CREATE POLICY "Public Access Group Locations" ON pro_group_locations FOR ALL USING (true);
CREATE POLICY "Public Access Group Members" ON pro_group_members FOR ALL USING (true);
CREATE POLICY "Public Access Patients" ON pro_patients FOR ALL USING (true);
CREATE POLICY "Public Access Providers" ON pro_providers FOR ALL USING (true);
CREATE POLICY "Public Access Visits" ON visit_requests FOR ALL USING (true);
