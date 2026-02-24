
-- Tabela de Embaixadores da Esperança (Versão Corrigida V2)
-- Unifica a criação da tabela com a coluna de matrícula e corrige o tipo de chave estrangeira

CREATE TABLE IF NOT EXISTS ambassadors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id TEXT, -- Matrícula (Adicionado diretamente para evitar ALTER posterior)
    name TEXT NOT NULL,
    email TEXT,
    sector_id BIGINT REFERENCES pro_sectors(id), -- CORREÇÃO: Tipo alterado de UUID para BIGINT para compatibilidade
    unit TEXT NOT NULL CHECK (unit IN ('HAB', 'HABA')),
    completion_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Data da capacitação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ambassadors_sector ON ambassadors(sector_id);
CREATE INDEX IF NOT EXISTS idx_ambassadors_unit ON ambassadors(unit);

-- Índice Único para Matrícula (Garante que não haja duplicatas de matrícula)
-- Nota: Se a tabela já existir com dados duplicados, a criação deste índice falhará.
-- O comando abaixo tenta criar apenas se não existir.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ambassadors_registration_id ON ambassadors(registration_id);

-- Política de Segurança (RLS)
ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;

-- Remove política anterior se existir para evitar erro de duplicidade ao rodar novamente
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON ambassadors;

CREATE POLICY "Enable all access for authenticated users" ON ambassadors
    FOR ALL USING (auth.role() = 'authenticated');
