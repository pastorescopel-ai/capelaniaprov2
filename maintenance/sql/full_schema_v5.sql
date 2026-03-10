
-- #################################################################
-- # SCHEMA CONSOLIDADO V5 - CAPELANIA PRO
-- # Este script unifica todas as tabelas e políticas, corrigindo erros de duplicidade.
-- #################################################################

-- 1. TABELAS DE ATIVIDADES (RECENTES)
CREATE TABLE IF NOT EXISTS activity_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    unit TEXT NOT NULL, -- 'HAB' ou 'HABA'
    month DATE NOT NULL, -- Primeiro dia do mês (YYYY-MM-01)
    day_of_week INTEGER NOT NULL, -- 0 (Domingo) a 6 (Sábado)
    activity_type TEXT NOT NULL, -- 'blueprint', 'cult', 'encontro', 'visiteCantando'
    location TEXT NOT NULL, -- Nome do local ou ID do Setor
    time TEXT, -- Horário da atividade (HH:mm)
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

CREATE TABLE IF NOT EXISTS daily_activity_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL, -- YYYY-MM-DD
    unit TEXT NOT NULL,
    completed_blueprints TEXT[] DEFAULT '{}',
    completed_cults TEXT[] DEFAULT '{}',
    completed_encontro BOOLEAN DEFAULT FALSE,
    completed_visite_cantando BOOLEAN DEFAULT FALSE,
    palliative_count INTEGER DEFAULT 0,
    surgical_count INTEGER DEFAULT 0,
    pediatric_count INTEGER DEFAULT 0,
    uti_count INTEGER DEFAULT 0,
    observations TEXT,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    UNIQUE(user_id, date)
);

-- 2. TABELA DE PARTICIPANTES DE CLASSES BÍBLICAS (FALTANTE)
CREATE TABLE IF NOT EXISTS bible_class_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES bible_classes(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    staff_id BIGINT, -- ID numérico do colaborador se houver
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- 3. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE activity_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_class_attendees ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE SEGURANÇA (USANDO DROP IF EXISTS PARA EVITAR ERROS)
DO $$ 
BEGIN 
    -- activity_schedules
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir tudo para usuários autenticados em activity_schedules') THEN
        DROP POLICY "Permitir tudo para usuários autenticados em activity_schedules" ON activity_schedules;
    END IF;
    CREATE POLICY "Permitir tudo para usuários autenticados em activity_schedules" ON activity_schedules FOR ALL USING (auth.role() = 'authenticated');

    -- daily_activity_reports
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir tudo para usuários autenticados em daily_activity_reports') THEN
        DROP POLICY "Permitir tudo para usuários autenticados em daily_activity_reports" ON daily_activity_reports;
    END IF;
    CREATE POLICY "Permitir tudo para usuários autenticados em daily_activity_reports" ON daily_activity_reports FOR ALL USING (auth.role() = 'authenticated');

    -- bible_class_attendees
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir tudo para usuários autenticados em bible_class_attendees') THEN
        DROP POLICY "Permitir tudo para usuários autenticados em bible_class_attendees" ON bible_class_attendees;
    END IF;
    CREATE POLICY "Permitir tudo para usuários autenticados em bible_class_attendees" ON bible_class_attendees FOR ALL USING (auth.role() = 'authenticated');
END $$;

-- 5. TABELA DE MEMBROS PRESTADORES (FALTANTE)
CREATE TABLE IF NOT EXISTS pro_group_provider_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id BIGINT REFERENCES pro_groups(id) ON DELETE CASCADE,
    provider_id BIGINT REFERENCES pro_providers(id) ON DELETE CASCADE,
    joined_at BIGINT,
    left_at BIGINT,
    is_error BOOLEAN DEFAULT FALSE,
    cycle_month TEXT,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

ALTER TABLE pro_group_provider_members ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir tudo para usuários autenticados em pro_group_provider_members') THEN
        DROP POLICY "Permitir tudo para usuários autenticados em pro_group_provider_members" ON pro_group_provider_members;
    END IF;
    CREATE POLICY "Permitir tudo para usuários autenticados em pro_group_provider_members" ON pro_group_provider_members FOR ALL USING (auth.role() = 'authenticated');
END $$;

-- 6. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_activity_schedules_user_month ON activity_schedules(user_id, month);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON daily_activity_reports(user_id, date);
CREATE INDEX IF NOT EXISTS idx_class_attendees_class_id ON bible_class_attendees(class_id);

-- #################################################################
-- # SQL ADICIONAL PARA OUTRAS TABELAS (GARANTIA DE EXISTÊNCIA)
-- #################################################################

-- Certifique-se de que a tabela ambassadors tenha a matrícula
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ambassadors' AND column_name = 'registration_id') THEN
        ALTER TABLE ambassadors ADD COLUMN registration_id TEXT;
    END IF;
END $$;

-- Certifique-se de que a tabela visit_requests tenha o local da reunião
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visit_requests' AND column_name = 'meeting_location') THEN
        ALTER TABLE visit_requests ADD COLUMN meeting_location TEXT;
    END IF;
END $$;
