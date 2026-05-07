
-- ============================================================================
-- DIAGNÓSTICO DE INTEGRIDADE - CRISE DE ABRIL/2026
-- Objetivo: Identificar por que os dados de PGs "sumiram" após importação de RH
-- ============================================================================

-- 1. SETORES DUPLICADOS OU COM NOMES ALTERADOS
-- Busca por IDs de setores que possuem nomes diferentes ou registros duplicados
SELECT 
    id, 
    unit, 
    COUNT(name) as total_nomes,
    string_agg(name, ' | ') as nomes_encontrados,
    min(created_at) as primeira_criacao,
    max(updated_at) as ultima_atualizacao
FROM public.pro_sectors
GROUP BY id, unit
HAVING COUNT(name) > 1 OR string_agg(name, '|') LIKE '%|%';

-- 2. COLABORADORES ÓRFÃOS (VÍNCULO DE SETOR QUEBRADO)
-- Lista colaboradores cujo sector_id não aponta para um setor ATIVO ou existente
SELECT 
    s.id as matricula,
    s.name as colaborador,
    s.unit,
    s.sector_id,
    sec.name as nome_setor_atual,
    s.active as status_colaborador,
    sec.active as status_setor
FROM public.pro_staff s
LEFT JOIN public.pro_sectors sec ON s.sector_id = sec.id AND s.unit = sec.unit
WHERE sec.id IS NULL OR sec.active = false OR s.sector_id IS NULL;

-- 3. MATRÍCULAS EM PGS ENCERRADAS EM ABRIL (O GATILHO DO PROBLEMA)
-- Identifica quem saiu dos PGs no período em que a planilha foi importada
SELECT 
    m.staff_id as matricula,
    s.name as colaborador,
    g.name as nome_pg,
    m.joined_at,
    m.left_at,
    m.cycle_month
FROM public.pro_group_members m
JOIN public.pro_staff s ON m.staff_id = s.id
JOIN public.pro_groups g ON m.group_id = g.id
WHERE m.left_at >= '2026-04-01' AND m.left_at <= '2026-04-30'
ORDER BY m.left_at DESC;

-- 4. SETORES CITADOS EM PGs QUE NÃO EXISTEM MAIS NA TABELA DE SETORES
-- Se o ID do setor no PG mudou, as métricas zeram.
SELECT 
    g.id as pg_id,
    g.name as pg_name,
    g.sector_id as id_setor_no_pg,
    sec.name as nome_setor_no_db
FROM public.pro_groups g
LEFT JOIN public.pro_sectors sec ON g.sector_id = sec.id
WHERE sec.id IS NULL;
