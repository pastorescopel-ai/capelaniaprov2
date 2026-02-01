-- #################################################################
-- # SCHEMA V3.1 - CAPELANIA PRO (SISTEMA DE NOTIFICAÇÕES)
-- #################################################################

-- Adição da coluna de leitura na tabela de convites
ALTER TABLE visit_requests ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

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

-- TABELA: BIBLE STUDIES
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

-- TABELA: BIBLE CLASSES
CREATE TABLE IF NOT EXISTS bible_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    unit TEXT NOT NULL,
    sector TEXT NOT NULL,
    students JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL,
    guide TEXT NOT NULL,
    lesson TEXT NOT NULL,
    observations TEXT,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- TABELA: SMALL GROUPS
CREATE TABLE IF NOT EXISTS small_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    unit TEXT NOT NULL,
    sector TEXT NOT NULL,
    group_name TEXT NOT NULL,
    leader TEXT NOT NULL,
    shift TEXT DEFAULT 'Manhã',
    participants_count INTEGER DEFAULT 0,
    observations TEXT,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- TABELA: STAFF VISITS
CREATE TABLE IF NOT EXISTS staff_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    unit TEXT NOT NULL,
    sector TEXT NOT NULL,
    reason TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    requires_return BOOLEAN DEFAULT false,
    return_date DATE,
    return_completed BOOLEAN DEFAULT false,
    observations TEXT,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- TABELA: VISIT REQUESTS
CREATE TABLE IF NOT EXISTS visit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pg_name TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    leader_phone TEXT,
    unit TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    request_notes TEXT,
    preferred_chaplain_id UUID,
    assigned_chaplain_id UUID,
    chaplain_response TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- TABELA: CONFIG
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
    updated_at BIGINT
);

-- TABELA: MASTER LISTS
CREATE TABLE IF NOT EXISTS master_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sectors_hab JSONB DEFAULT '[]'::jsonb,
    sectors_haba JSONB DEFAULT '[]'::jsonb,
    staff_hab JSONB DEFAULT '[]'::jsonb,
    staff_haba JSONB DEFAULT '[]'::jsonb,
    groups_hab JSONB DEFAULT '[]'::jsonb,
    groups_haba JSONB DEFAULT '[]'::jsonb,
    updated_at BIGINT
);

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE small_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_lists ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público
CREATE POLICY "Public Access" ON users FOR ALL USING (true);
CREATE POLICY "Public Access" ON bible_studies FOR ALL USING (true);
CREATE POLICY "Public Access" ON bible_classes FOR ALL USING (true);
CREATE POLICY "Public Access" ON small_groups FOR ALL USING (true);
CREATE POLICY "Public Access" ON staff_visits FOR ALL USING (true);
CREATE POLICY "Public Access" ON visit_requests FOR ALL USING (true);
CREATE POLICY "Public Access" ON app_config FOR ALL USING (true);
CREATE POLICY "Public Access" ON master_lists FOR ALL USING (true);