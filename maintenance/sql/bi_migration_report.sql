
-- RELATORIO DE DIAGNOSTICO POS-MIGRACAO (BI)

-- 1. RESUMO ESTATISTICO GERAL

SELECT 
    'Estudos Biblicos' as tabela,
    'Colaborador (Staff)' as tipo_vinculo,
    COUNT(*) as total_registros,
    COUNT(staff_id) as vinculados_sucesso,
    COUNT(*) - COUNT(staff_id) as pendentes_correcao,
    ROUND((COUNT(staff_id)::numeric / NULLIF(COUNT(*), 0) * 100), 1) || '%' as taxa_sucesso
FROM bible_studies
WHERE participant_type = 'Colaborador' OR participant_type IS NULL

UNION ALL

SELECT 
    'Estudos Biblicos',
    'Setor',
    COUNT(*),
    COUNT(sector_id),
    COUNT(*) - COUNT(sector_id),
    ROUND((COUNT(sector_id)::numeric / NULLIF(COUNT(*), 0) * 100), 1) || '%'
FROM bible_studies

UNION ALL

SELECT 
    'Visitas Pastorais',
    'Colaborador (Staff)',
    COUNT(*),
    COUNT(staff_id),
    COUNT(*) - COUNT(staff_id),
    ROUND((COUNT(staff_id)::numeric / NULLIF(COUNT(*), 0) * 100), 1) || '%'
FROM staff_visits
WHERE participant_type = 'Colaborador' OR participant_type IS NULL

UNION ALL

SELECT 
    'Visitas Pastorais',
    'Setor',
    COUNT(*),
    COUNT(sector_id),
    COUNT(*) - COUNT(sector_id),
    ROUND((COUNT(sector_id)::numeric / NULLIF(COUNT(*), 0) * 100), 1) || '%'
FROM staff_visits

UNION ALL

SELECT 
    'Pequenos Grupos',
    'Grupo (PG)',
    COUNT(*),
    COUNT(group_id),
    COUNT(*) - COUNT(group_id),
    ROUND((COUNT(group_id)::numeric / NULLIF(COUNT(*), 0) * 100), 1) || '%'
FROM small_groups

UNION ALL

SELECT 
    'Classes Biblicas',
    'Setor',
    COUNT(*),
    COUNT(sector_id),
    COUNT(*) - COUNT(sector_id),
    ROUND((COUNT(sector_id)::numeric / NULLIF(COUNT(*), 0) * 100), 1) || '%'
FROM bible_classes;


-- 2. AMOSTRA DE DADOS PENDENTES (Para checar na Cura de Dados)

SELECT '--- AMOSTRA: NOMES PENDENTES ---' as diagnostico, '' as valor_texto, '' as unidade
UNION ALL
(SELECT 'Estudo - Nome Pendente', name, unit FROM bible_studies WHERE staff_id IS NULL AND (participant_type = 'Colaborador' OR participant_type IS NULL) LIMIT 5)
UNION ALL
(SELECT 'Visita - Nome Pendente', staff_name, unit FROM staff_visits WHERE staff_id IS NULL AND (participant_type = 'Colaborador' OR participant_type IS NULL) LIMIT 5)
UNION ALL
SELECT '--- AMOSTRA: SETORES PENDENTES ---', '', ''
UNION ALL
(SELECT 'Estudo - Setor Pendente', sector, unit FROM bible_studies WHERE sector_id IS NULL LIMIT 5)
UNION ALL
(SELECT 'Visita - Setor Pendente', sector, unit FROM staff_visits WHERE sector_id IS NULL LIMIT 5)
UNION ALL
(SELECT 'PG - Setor Pendente', sector, unit FROM small_groups WHERE sector_id IS NULL LIMIT 5);
