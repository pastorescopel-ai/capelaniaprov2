
-- #################################################################
-- # MIGRATION: AJUSTE DE TIPOS PARA PRO_HISTORY_RECORDS
-- # Garante que IDs numéricos do sistema PRO sejam BIGINT no histórico
-- #################################################################

-- 1. Remover a tabela se existir para recriar com os tipos corretos (CUIDADO: Isso apaga dados de teste)
-- Se preferir não apagar, use ALTER TABLE, mas como a tabela está vazia/com erro, recriar é mais limpo.
DROP TABLE IF EXISTS pro_history_records;

CREATE TABLE pro_history_records (
    id BIGSERIAL PRIMARY KEY, -- ID numérico sequencial
    month TEXT NOT NULL, -- YYYY-MM-01
    unit TEXT NOT NULL,
    staff_id BIGINT NOT NULL, -- ID numérico do colaborador
    staff_name TEXT NOT NULL,
    registration_id TEXT, -- Matrícula (opcional)
    sector_id BIGINT, -- ID numérico do setor
    sector_name TEXT,
    group_id BIGINT, -- ID numérico do grupo
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
