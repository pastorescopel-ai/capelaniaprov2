
-- ##########################################################################
-- # CORREÇÃO DE PERMISSÕES E TYPES PARA BI / RELATÓRIOS
-- ##########################################################################

BEGIN;

-- 1. Garantir RLS aberto para usuários autenticados (ou ajustar conforme sua necessidade)
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados em pro_monthly_stats" ON pro_monthly_stats;
CREATE POLICY "Permitir tudo para usuários autenticados em pro_monthly_stats" ON pro_monthly_stats FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados em pro_history_records" ON pro_history_records;
CREATE POLICY "Permitir tudo para usuários autenticados em pro_history_records" ON pro_history_records FOR ALL USING (true);

-- 2. Correção de tipo se necessário (Opcional, mas ajuda a evitar o erro 42883 se você não quiser usar cast na query)
-- Nota: manteremos target_id como TEXT por ser polimórfico, mas esta query mostra como converter se desejar.
-- ALTER TABLE pro_monthly_stats ALTER COLUMN target_id TYPE BIGINT USING (target_id::bigint);

COMMIT;
