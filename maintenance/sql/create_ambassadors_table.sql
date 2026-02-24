
-- Tabela de Embaixadores da Esperança
CREATE TABLE IF NOT EXISTS ambassadors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    sector_id UUID REFERENCES pro_sectors(id),
    unit TEXT NOT NULL CHECK (unit IN ('HAB', 'HABA')),
    completion_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ambassadors_sector ON ambassadors(sector_id);
CREATE INDEX IF NOT EXISTS idx_ambassadors_unit ON ambassadors(unit);

-- Política de Segurança (RLS) - Permitir tudo para autenticados por enquanto (simplificado)
ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON ambassadors
    FOR ALL USING (auth.role() = 'authenticated');
