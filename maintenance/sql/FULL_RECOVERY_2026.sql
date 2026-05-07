-- ##########################################################################
-- # PLANO DE RECUPERAÇÃO INTEGRAL (CONSOLIDADO) - CAPELANIA HAB
-- # Use este script no Painel SQL do Supabase para restaurar a integridade
-- ##########################################################################

BEGIN;

-- 1. CORREÇÃO DE TIPOS E REMOÇÃO DO ERRO 42883
-- Garantimos que pro_monthly_stats e tabelas de histórico permitam comparação segura
-- Alteramos target_id para ser comparável a BIGINT sem quebrar strings como 'all'
DO $$ 
BEGIN 
    -- Se a coluna target_id for do tipo BIGINT (tentativa de migração anterior), 
    -- vamos voltar para TEXT para suportar 'summary', 'all', etc., mas com cast seguro.
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'pro_monthly_stats' AND column_name = 'target_id') != 'text' THEN
        ALTER TABLE pro_monthly_stats ALTER COLUMN target_id TYPE TEXT USING target_id::text;
    END IF;
END $$;

-- 2. CURA DE DADOS (DATA HEALING) - SETORES E COLABORADORES
-- Se os IDs mudaram, os colaboradores podem estar órfãos. Vamos re-vincular pelo NOME.
CREATE TEMP TABLE sectors_lookup AS SELECT id, name, unit FROM pro_sectors;

-- 2.1 Vincular Staff
UPDATE pro_staff s
SET sector_id = l.id
FROM sectors_lookup l
WHERE s.unit = l.unit 
  AND (s.sector_id IS NULL OR s.sector_id NOT IN (SELECT id FROM pro_sectors))
  AND EXISTS (SELECT 1 FROM pro_sectors ps WHERE ps.name = l.name AND ps.unit = l.unit);

-- 2.2 Vincular Grupos
UPDATE pro_groups g
SET sector_id = l.id
FROM sectors_lookup l
WHERE g.unit = l.unit 
  AND (g.sector_id IS NULL OR g.sector_id NOT IN (SELECT id FROM pro_sectors))
  AND EXISTS (SELECT 1 FROM pro_sectors ps WHERE ps.name = l.name AND ps.unit = l.unit);

-- 2.3 Vincular Embaixadores
UPDATE ambassadors a
SET sector_id = l.id::text
FROM sectors_lookup l
WHERE a.unit = l.unit 
  AND (a.sector_id IS NULL OR a.sector_id NOT IN (SELECT id::text FROM pro_sectors))
  AND EXISTS (SELECT 1 FROM pro_sectors ps WHERE ps.name = l.name AND ps.unit = l.unit);

-- 3. REGENERAÇÃO DE INDICADORES DE MARÇO 2026
-- Se os IDs mudaram, os snapshots antigos em pro_monthly_stats podem estar apontando para IDs inexistentes.
-- A forma mais segura é o usuário RE-FECHAR o mês no sistema após a cura dos dados acima.
-- O comando abaixo limpa os dados inconsistentes de Março para permitir um fechamento limpo.

-- DELETE FROM pro_monthly_stats WHERE month = '2026-03-01';
-- DELETE FROM pro_history_records WHERE month = '2026-03-01';

-- 4. RPC DE SEGURANÇA PARA RELATÓRIOS (USADO PELO FRONTEND)
-- Drop anterior se existir para evitar conflito de parâmetros
DROP FUNCTION IF EXISTS get_safe_monthly_report(date);
DROP FUNCTION IF EXISTS get_table_info(text);

CREATE OR REPLACE FUNCTION get_safe_monthly_report(p_month DATE)
RETURNS TABLE (
    unit TEXT,
    setor TEXT,
    colaboradores INT,
    pgs_ativos INT,
    percentual NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sec.unit::TEXT,
        sec.name::TEXT as setor,
        COALESCE(ms.total_staff, 0)::INT as colaboradores,
        COALESCE(ms.active_groups, 0)::INT as pgs_ativos,
        COALESCE(ms.percentage, 0)::NUMERIC as percentual
    FROM pro_sectors sec
    LEFT JOIN pro_monthly_stats ms ON ms.target_id = sec.id::text 
    WHERE ms.month = p_month 
      AND ms.type = 'sector'
    ORDER BY sec.unit, sec.name;
END;
$$;

COMMIT;

-- MENSAGEM DE INSTRUÇÃO:
-- Após aplicar este script no Supabase:
-- 1. Vá na aba "Gestão de PGs" -> "Fechamento de Mês"
-- 2. Selecione Março de 2026.
-- 3. Clique em "Atualizar Fechamento".
-- Isso irá recalcular todos os PGs Ativos com base nos IDs corrigidos.
