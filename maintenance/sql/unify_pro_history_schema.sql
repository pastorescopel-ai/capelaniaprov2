
-- #################################################################
-- # MIGRATION: UNIFICAÇÃO E CORREÇÃO DE PRO_HISTORY_RECORDS
-- # Ajusta tipos para consistência com pro_monthly_stats e evita erros de tipo
-- #################################################################

-- 1. Recriar a tabela com UUID e tipos consistentes
DROP TABLE IF EXISTS pro_history_records;

CREATE TABLE pro_history_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month DATE NOT NULL, -- Alterado de TEXT para DATE para consistência
    unit TEXT NOT NULL,
    staff_id BIGINT NOT NULL,
    staff_name TEXT NOT NULL,
    registration_id TEXT,
    sector_id BIGINT,
    sector_name TEXT,
    group_id BIGINT,
    group_name TEXT,
    status TEXT,
    is_enrolled BOOLEAN DEFAULT FALSE,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)
);

-- 2. Habilitar RLS
ALTER TABLE pro_history_records ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Segurança
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir tudo para usuários autenticados em pro_history_records') THEN
        CREATE POLICY "Permitir tudo para usuários autenticados em pro_history_records" ON pro_history_records FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 4. Índices para Performance
CREATE INDEX IF NOT EXISTS idx_pro_history_month_unit ON pro_history_records(month, unit);
CREATE INDEX IF NOT EXISTS idx_pro_history_staff_id ON pro_history_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_pro_history_group_id ON pro_history_records(group_id);
