
-- ##########################################################################
-- # CORREÇÃO PARA ERRO 42883 (OPERATOR DOES NOT EXIST: TEXT = BIGINT)
-- # Ocorreu porque 'target_id' em pro_monthly_stats é TEXT e 'id' em pro_sectors é BIGINT
-- ##########################################################################

-- 1. CONSULTA CORRIGIDA PARA O RELATÓRIO DE MARÇO
-- Use ::text para comparar o ID numérico com o ID em texto
SELECT 
    sec.unit,
    sec.name as setor,
    ms.total_staff as colaboradores,
    ms.active_groups as pgs_ativos,
    ms.month
FROM pro_sectors sec
LEFT JOIN pro_monthly_stats ms ON ms.target_id = sec.id::text 
WHERE ms.month = '2026-03-01' 
  AND ms.type = 'sector'
ORDER BY sec.unit, sec.name;

-- 2. SE VOCÊ QUISER TENTAR CONVERTER A COLUNA target_id PARA BIGINT (Apenas se ela for 100% numérica)
-- ATENÇÃO: Isso pode falhar se houver registros do tipo 'summary' ou IDs 'all'.
-- Recomendamos manter como TEXT e usar o cast (::text) na query, pois a coluna é polimórfica.

-- 3. DIAGNÓSTICO: Verificar se há dados salvos para Março
SELECT count(*) FROM pro_monthly_stats WHERE month = '2026-03-01';
