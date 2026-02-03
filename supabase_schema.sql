
-- #################################################################
-- # SCHEMA V3.4 - CAPELANIA PRO (INTEGRIDADE EXCEL-DRIVEN)
-- #################################################################

-- --- TABELAS LEGADAS (Compatibilidade V1/V2) ---
-- Mantidas para garantir funcionamento do Login e Históricos Antigos

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CHAPLAIN',
    profile_pic TEXT,
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

-- RLS para Solicitações de Visita (Bridge Externa)
ALTER TABLE visit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir inserção via bridge" ON visit_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Acesso completo autenticado" ON visit_requests FOR ALL TO authenticated USING (true);

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

-- Tabela de Configuração Global
CREATE TABLE IF NOT EXISTS app_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mural_text TEXT,
    header_line1 TEXT,
    header_line2 TEXT,
    header_line3 TEXT,
    font_size1 INTEGER,
    font_size2 INTEGER,
    font_size3 INTEGER,
    report_logo_width INTEGER,
    report_logo_x INTEGER,
    report_logo_y INTEGER,
    header_line1_x INTEGER,
    header_line1_y INTEGER,
    header_line2_x INTEGER,
    header_line2_y INTEGER,
    header_line3_x INTEGER,
    header_line3_y INTEGER,
    header_padding_top INTEGER,
    header_text_align TEXT,
    primary_color TEXT,
    app_logo_url TEXT,
    report_logo_url TEXT,
    last_modified_by TEXT,
    last_modified_at BIGINT,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- Tabela Legada de Listas (Será substituída gradualmente pelas tabelas PRO)
CREATE TABLE IF NOT EXISTS master_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sectors_hab TEXT[],
    sectors_haba TEXT[],
    staff_hab TEXT[],
    staff_haba TEXT[],
    groups_hab TEXT[],
    groups_haba TEXT[],
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- --- ARQUITETURA PRO RELACIONAL (V3.4) ---
-- Estrutura espelhada no Excel para importação direta e integridade

-- 1. TABELA DE SETORES (A Raiz)
-- ID = "N DEPTO" / Código do Excel (ex: "1020", "UTI-A")
CREATE TABLE IF NOT EXISTS pro_sectors (
    id TEXT PRIMARY KEY, 
    name TEXT NOT NULL, -- Coluna "DEPTO"
    unit TEXT NOT NULL CHECK (unit IN ('HAB', 'HABA')), -- Coluna "UNIDADE" ou Aba
    active BOOLEAN DEFAULT true,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- 2. TABELA DE COLABORADORES (Vínculo Forte)
-- ID = "MAT" / Matrícula (ex: "004592")
-- sector_id = "Nº DPTO" (Deve existir em pro_sectors)
CREATE TABLE IF NOT EXISTS pro_staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, -- Coluna "NOME"
    sector_id TEXT REFERENCES pro_sectors(id) ON UPDATE CASCADE, 
    unit TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- 3. TABELA DE PEQUENOS GRUPOS (Memória Corporativa)
-- ID = "N Pg" (ex: "PG-105")
-- current_leader = Preenchido pelo App na 1ª visita ("Persistent Leader")
CREATE TABLE IF NOT EXISTS pro_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, -- Coluna "nome PG"
    current_leader TEXT, 
    sector_id TEXT REFERENCES pro_sectors(id) ON UPDATE CASCADE, 
    unit TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- Índices de Performance para Autocomplete
CREATE INDEX IF NOT EXISTS idx_staff_name ON pro_staff(name);
CREATE INDEX IF NOT EXISTS idx_sectors_name ON pro_sectors(name);
CREATE INDEX IF NOT EXISTS idx_groups_leader ON pro_groups(current_leader);

-- --- SEGURANÇA (Row Level Security) ---

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_lists ENABLE ROW LEVEL SECURITY;

-- Políticas Públicas (Acesso Aberto para App Autenticado)
CREATE POLICY "Public Access Users" ON users FOR ALL USING (true);
CREATE POLICY "Public Access Studies" ON bible_studies FOR ALL USING (true);
CREATE POLICY "Public Access Config" ON app_config FOR ALL USING (true);
CREATE POLICY "Public Access MasterLists" ON master_lists FOR ALL USING (true);

-- Políticas PRO (Leitura/Escrita para Usuários Logados)
CREATE POLICY "Public Read Sectors" ON pro_sectors FOR SELECT USING (true);
CREATE POLICY "Public Write Sectors" ON pro_sectors FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Sectors" ON pro_sectors FOR UPDATE USING (true);

CREATE POLICY "Public Read Staff" ON pro_staff FOR SELECT USING (true);
CREATE POLICY "Public Write Staff" ON pro_staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Staff" ON pro_staff FOR UPDATE USING (true);

CREATE POLICY "Public Read Groups" ON pro_groups FOR SELECT USING (true);
CREATE POLICY "Public Write Groups" ON pro_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Groups" ON pro_groups FOR UPDATE USING (true);
