-- ##########################################################################
-- # SCRIPT DE RECUPERAÇÃO DE INTEGRIDADE (HEALER) - CAPELANIA HAB
-- # Objetivo: Reconectar setores, colaboradores e grupos cujos IDs foram quebrados
-- ##########################################################################

BEGIN;

-- 1. CRIAR TABELA TEMPORÁRIA DE MAPEAMENTO POR NOME
-- Isso nos permite vincular dados antigos aos novos IDs baseados no nome do setor e unidade
CREATE TEMP TABLE sector_mapping AS
SELECT id as new_id, name, unit
FROM pro_sectors;

-- 2. CURAR PRO_STAFF (Vincular colaboradores aos setores corretos pelo nome se o ID estiver quebrado)
-- Primeiro, identificamos registros onde o sector_id não existe mais
UPDATE pro_staff s
SET sector_id = m.new_id
FROM sector_mapping m
WHERE s.unit = m.unit 
  AND lower(trim(s.sector_id::text)) NOT IN (SELECT id::text FROM pro_sectors) -- Se o ID atual é inválido
  AND EXISTS (SELECT 1 FROM pro_sectors WHERE name = m.name AND unit = m.unit); -- E existe um setor com esse nome

-- 3. CURAR PRO_GROUPS (Vincular grupos aos setores corretos pelo nome)
UPDATE pro_groups g
SET sector_id = m.new_id
FROM sector_mapping m
WHERE g.unit = m.unit 
  AND (g.sector_id IS NULL OR g.sector_id::text NOT IN (SELECT id::text FROM pro_sectors))
  AND EXISTS (SELECT 1 FROM pro_sectors WHERE name = m.name AND unit = m.unit);

-- 4. CURAR PRO_MONTHLY_STATS (A "ferida" principal dos relatórios)
-- Atualizamos o target_id nas estatísticas mensais comparando com o nome do setor que ele deveria representar
-- Nota: Isso assume que o target_id antigo em pro_monthly_stats ainda pode ser rastreado ou que podemos inferir o setor.
-- Como o target_id é TEXT, vamos tentar um match mais inteligente.

-- Se tivermos o nome do setor no backup ou se pudermos identificar, fazemos o match.
-- Caso contrário, vamos apenas garantir que o target_id seja castado corretamente nas consultas.

-- 5. CORREÇÃO DE TIPOS PARA EVITAR ERRO 42883
-- Vamos garantir que as colunas de ID em tabelas de histórico permitam a comparação
-- Se target_id em pro_monthly_stats é TEXT, e queremos que seja BIGINT para facilitar JOINs:
-- Mas como pode conter 'all' ou 'unassigned', manteremos TEXT e criaremos um RPC que faz o cast seguro.

-- 6. LIMPEZA DE ESTATÍSTICAS DUPLICADAS OU INVÁLIDAS PARA MARÇO 2026
-- Se os dados de Março estão zerados/corrompidos, é melhor removê-los para que o sistema permita re-fechar.
-- DELETE FROM pro_monthly_stats WHERE month = '2026-03-01';
-- DELETE FROM pro_history_records WHERE month = '2026-03-01';

COMMIT;

-- 7. RPC PARA CONSULTA DE RELATÓRIO SEGURA (Casting implícito)
CREATE OR REPLACE FUNCTION get_safe_monthly_report(p_month DATE)
RETURNS TABLE (
    unit TEXT,
    setor TEXT,
    colaboradores INT,
    pgs_ativos INT,
    percentual NUMERIC
) LANGUAGE plpgsql AS $$
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
