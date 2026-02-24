
-- Adicionar coluna de matrícula e garantir unicidade
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS registration_id TEXT;

-- Remover duplicatas existentes antes de criar o índice único (se houver)
DELETE FROM ambassadors a USING (
      SELECT min(ctid) as ctid, registration_id
        FROM ambassadors 
        GROUP BY registration_id HAVING COUNT(*) > 1
      ) b
      WHERE a.registration_id = b.registration_id 
      AND a.ctid <> b.ctid;

-- Criar índice único para evitar duplicatas futuras pela matrícula
CREATE UNIQUE INDEX IF NOT EXISTS idx_ambassadors_registration_id ON ambassadors(registration_id);

-- Adicionar coluna para data da capacitação explicitamente se diferir de completion_date (ou usar completion_date como data da capacitação)
-- Vamos assumir que completion_date É a data da capacitação.
