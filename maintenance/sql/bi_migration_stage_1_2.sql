
-- #################################################################
-- # MIGRAÇÃO PARA B.I. (BUSINESS INTELLIGENCE) - ETAPAS 1 & 2
-- # Objetivo: Criar vínculos numéricos sólidos sem perder histórico
-- #################################################################

BEGIN;

-- =================================================================
-- ETAPA 1: EXPANSÃO DA ESTRUTURA (SCHEMA)
-- Adiciona colunas de ID silenciosas. O App continua usando as de texto por enquanto.
-- =================================================================

-- 1. Tabela de Estudos Bíblicos (bible_studies)
ALTER TABLE bible_studies 
ADD COLUMN IF NOT EXISTS staff_id BIGINT REFERENCES pro_staff(id),
ADD COLUMN IF NOT EXISTS sector_id BIGINT REFERENCES pro_sectors(id);

-- 2. Tabela de Visitas (staff_visits)
ALTER TABLE staff_visits 
ADD COLUMN IF NOT EXISTS staff_id BIGINT REFERENCES pro_staff(id),
ALTER TABLE staff_visits 
ADD COLUMN IF NOT EXISTS sector_id BIGINT REFERENCES pro_sectors(id);

-- 3. Tabela de PGs Histórico (small_groups)
ALTER TABLE small_groups 
ADD COLUMN IF NOT EXISTS group_id BIGINT REFERENCES pro_groups(id),
ADD COLUMN IF NOT EXISTS sector_id BIGINT REFERENCES pro_sectors(id);

-- 4. Tabela de Classes Bíblicas (bible_classes)
ALTER TABLE bible_classes 
ADD COLUMN IF NOT EXISTS sector_id BIGINT REFERENCES pro_sectors(id);

-- =================================================================
-- ETAPA 2: O ROBÔ DE PREENCHIMENTO (DATA FILLING)
-- Varre o texto antigo e tenta achar o ID correspondente no cadastro oficial.
-- =================================================================

-- A) VINCULAR SETORES (Em todas as tabelas)
-- Lógica: Bater o nome do setor (texto) com a tabela pro_sectors, respeitando a Unidade.

-- Estudos
UPDATE bible_studies t
SET sector_id = s.id
FROM pro_sectors s
WHERE lower(trim(t.sector)) = lower(trim(s.name)) 
AND t.unit = s.unit
AND t.sector_id IS NULL;

-- Visitas
UPDATE staff_visits t
SET sector_id = s.id
FROM pro_sectors s
WHERE lower(trim(t.sector)) = lower(trim(s.name)) 
AND t.unit = s.unit
AND t.sector_id IS NULL;

-- PGs (Encontros)
UPDATE small_groups t
SET sector_id = s.id
FROM pro_sectors s
WHERE lower(trim(t.sector)) = lower(trim(s.name)) 
AND t.unit = s.unit
AND t.sector_id IS NULL;

-- Classes
UPDATE bible_classes t
SET sector_id = s.id
FROM pro_sectors s
WHERE lower(trim(t.sector)) = lower(trim(s.name)) 
AND t.unit = s.unit
AND t.sector_id IS NULL;


-- B) VINCULAR PESSOAS (Colaboradores)
-- Lógica: Bater o nome da pessoa com a tabela pro_staff.
-- Tratamento extra: Remove "(Matrícula)" do texto caso exista, para comparar só o nome.

-- Estudos (Aluno/Colaborador)
UPDATE bible_studies t
SET staff_id = p.id
FROM pro_staff p
WHERE lower(trim(split_part(t.name, '(', 1))) = lower(trim(p.name))
AND t.unit = p.unit
AND t.staff_id IS NULL;

-- Visitas (Colaborador Visitado)
UPDATE staff_visits t
SET staff_id = p.id
FROM pro_staff p
WHERE lower(trim(split_part(t.staff_name, '(', 1))) = lower(trim(p.name))
AND t.unit = p.unit
AND t.staff_id IS NULL;


-- C) VINCULAR GRUPOS (PGs)
-- Lógica: Bater o nome do grupo com a tabela pro_groups.

UPDATE small_groups t
SET group_id = g.id
FROM pro_groups g
WHERE lower(trim(t.group_name)) = lower(trim(g.name))
AND t.unit = g.unit
AND t.group_id IS NULL;

-- =================================================================
-- RELATÓRIO FINAL DA OPERAÇÃO
-- =================================================================
-- Apenas para log (não afeta dados)
DO $$
DECLARE
    count_studies int;
    count_visits int;
BEGIN
    SELECT count(*) INTO count_studies FROM bible_studies WHERE staff_id IS NOT NULL;
    SELECT count(*) INTO count_visits FROM staff_visits WHERE staff_id IS NOT NULL;
    
    RAISE NOTICE 'Migração BI Concluída.';
    RAISE NOTICE 'Estudos vinculados a IDs: %', count_studies;
    RAISE NOTICE 'Visitas vinculadas a IDs: %', count_visits;
END $$;

COMMIT;
