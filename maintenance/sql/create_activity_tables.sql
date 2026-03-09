
-- Tabela de Escala Mensal de Atividades
CREATE TABLE IF NOT EXISTS activity_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    unit TEXT NOT NULL, -- 'HAB' ou 'HABA'
    month DATE NOT NULL, -- Primeiro dia do mês (YYYY-MM-01)
    day_of_week INTEGER NOT NULL, -- 0 (Domingo) a 6 (Sábado)
    activity_type TEXT NOT NULL, -- 'blueprint' ou 'cult'
    location TEXT NOT NULL, -- Nome do local (Blueprint) ou ID do Setor (Culto)
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- Tabela de Relatórios Diários de Atividades
CREATE TABLE IF NOT EXISTS daily_activity_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL, -- YYYY-MM-DD
    unit TEXT NOT NULL,
    completed_blueprints TEXT[] DEFAULT '{}',
    completed_cults TEXT[] DEFAULT '{}',
    palliative_count INTEGER DEFAULT 0,
    surgical_count INTEGER DEFAULT 0,
    pediatric_count INTEGER DEFAULT 0,
    uti_count INTEGER DEFAULT 0,
    observations TEXT,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000),
    UNIQUE(user_id, date)
);

-- Habilitar RLS
ALTER TABLE activity_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity_reports ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Simplificadas para o contexto)
CREATE POLICY "Permitir tudo para usuários autenticados em activity_schedules" ON activity_schedules FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados em daily_activity_reports" ON daily_activity_reports FOR ALL USING (true);
