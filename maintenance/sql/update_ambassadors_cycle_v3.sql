
-- 1. Adicionar a coluna cycle_month (Data de Referência do Ciclo)
ALTER TABLE ambassadors ADD COLUMN IF NOT EXISTS cycle_month DATE;

-- 2. Migrar dados existentes: Definir cycle_month com base no created_at ou completion_date
-- Se cycle_month for nulo, pegamos o primeiro dia do mês de created_at
UPDATE ambassadors 
SET cycle_month = date_trunc('month', created_at)::date
WHERE cycle_month IS NULL;

-- 3. Remover o índice de unicidade antigo que travava apenas pela matrícula
DROP INDEX IF EXISTS idx_ambassadors_registration_id;

-- 4. Criar o novo índice de unicidade composto: Matrícula + Mês do Ciclo
-- Isso permite que a mesma pessoa seja embaixadora em meses diferentes, mas não duplicada no mesmo mês.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ambassadors_reg_cycle ON ambassadors(registration_id, cycle_month);

-- 5. Garantir que a coluna cycle_month não seja nula para futuros registros
ALTER TABLE ambassadors ALTER COLUMN cycle_month SET NOT NULL;
