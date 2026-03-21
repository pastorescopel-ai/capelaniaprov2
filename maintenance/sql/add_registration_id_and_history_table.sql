
-- #################################################################
-- # MIGRATION: TABELA DE HISTÓRICO PARA BI (SNAPSHOTS)
-- #################################################################

-- 1. Criar tabela de histórico pro_history_records
-- O staff_id aqui representa a Matrícula do colaborador
CREATE TABLE IF NOT EXISTS pro_history_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL, -- YYYY-MM-01
    unit TEXT NOT NULL,
    staff_id TEXT NOT NULL, -- Matrícula (ID do pro_staff)
    staff_name TEXT NOT NULL,
    sector_id UUID,
    sector_name TEXT,
    group_id UUID,
    group_name TEXT,
    status TEXT, -- 'Matriculado' ou 'Não Matriculado'
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

-- 4. Índices para Performance do BI
CREATE INDEX IF NOT EXISTS idx_pro_history_month_unit ON pro_history_records(month, unit);
CREATE INDEX IF NOT EXISTS idx_pro_history_staff_id ON pro_history_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_pro_history_group_id ON pro_history_records(group_id);
