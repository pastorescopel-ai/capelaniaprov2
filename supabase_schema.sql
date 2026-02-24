
-- #################################################################
-- # SCHEMA V6.0 - BI SNAPSHOT NUMÉRICO PURO (HIGH PERFORMANCE)
-- # Objetivo: Contagem exata baseada em BIGINT (Sem Regex)
-- #################################################################

-- 1. VIEWS E RELATÓRIOS EM TEMPO REAL
-- View atualizada para usar JOIN numérico direto, muito mais rápido e preciso.

CREATE OR REPLACE VIEW bi_active_memberships AS
SELECT 
    m.id as matricula_id,
    p.name as colaborador,
    COALESCE(s.name, 'Setor Não Identificado') as setor,
    COALESCE(s.unit, 'N/A') as unidade,
    COALESCE(g.name, 'PG Desconhecido') as nome_pg,
    to_timestamp(m.joined_at / 1000)::date as data_entrada,
    CASE 
        WHEN m.left_at IS NOT NULL THEN to_timestamp(m.left_at / 1000)::date 
        ELSE NULL 
    END as data_saida,
    CASE 
        WHEN m.left_at IS NULL THEN 'ATIVO' 
        ELSE 'INATIVO' 
    END as status_atual
FROM pro_group_members m
-- JOINs numéricos diretos (assumindo que a migração para BIGINT foi feita)
JOIN pro_staff p ON m.staff_id = p.id
LEFT JOIN pro_sectors s ON p.sector_id = s.id
LEFT JOIN pro_groups g ON m.group_id = g.id;

-- 2. FUNÇÃO DE SNAPSHOT (A CÂMERA DO BI)
-- Versão V6.0: Removeu regex. Usa comparação direta de IDs numéricos.

CREATE OR REPLACE FUNCTION capture_daily_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    curr_time BIGINT;
BEGIN
    curr_time := (extract(epoch from now()) * 1000)::bigint;

    -- Remove snapshot de hoje para recalcular (permite rodar várias vezes no dia)
    DELETE FROM bi_daily_sector_counts WHERE snapshot_date = CURRENT_DATE;

    INSERT INTO bi_daily_sector_counts (
        snapshot_date, unit, sector_name, sector_id, 
        total_staff_count, enrolled_staff_count, created_at
    )
    SELECT 
        CURRENT_DATE,
        s.unit,
        s.name,
        s.id::text, 
        
        -- A: Total de Funcionários no Setor
        (
            SELECT count(*) 
            FROM pro_staff st 
            WHERE st.sector_id = s.id 
            AND (st.active IS TRUE OR st.active IS NULL)
        ),

        -- B: Total de Matriculados (O número crítico)
        (
            SELECT count(DISTINCT m.staff_id)
            FROM pro_group_members m
            JOIN pro_staff st ON m.staff_id = st.id
            WHERE st.sector_id = s.id 
            AND (st.active IS TRUE OR st.active IS NULL)
            AND (m.left_at IS NULL OR m.left_at > curr_time) 
        ),
        now()
    FROM pro_sectors s
    WHERE s.active IS NOT FALSE;
END;
$$;

-- 3. FUNÇÃO DE UNIFICAÇÃO DE IDENTIDADE (DATA HEALING - ALUNOS)
-- Vincula registros de aula órfãos (sem ID) a um colaborador oficial (com ID)
-- Atualiza tanto o staff_id quanto o nome para o padrão oficial
CREATE OR REPLACE FUNCTION unify_student_identity(orphan_name text, target_staff_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    affected_rows int;
BEGIN
    -- Busca o nome oficial do colaborador
    SELECT name INTO official_name FROM pro_staff WHERE id = target_staff_id;
    
    IF official_name IS NULL THEN
        RETURN 'Erro: Colaborador alvo não encontrado.';
    END IF;

    -- Atualiza os registros órfãos
    UPDATE bible_class_attendees
    SET staff_id = target_staff_id,
        student_name = official_name -- Padroniza o nome no histórico
    WHERE lower(trim(student_name)) = lower(trim(orphan_name)) 
    AND staff_id IS NULL;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    RETURN 'Sucesso: ' || affected_rows || ' registros de histórico unificados para ' || official_name;
END;
$$;

-- 4. REPARO DE INTEGRIDADE - MATRÍCULAS (V6.1)
-- Objetivo: Impedir duplicatas e limpar registros fantasmas

-- A. Limpeza de duplicatas existentes (Desativa as mais antigas)
-- Execute isso no SQL Editor do Supabase para correção imediata:
/*
UPDATE pro_group_members 
SET left_at = (extract(epoch from now()) * 1000)::bigint
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY staff_id, group_id ORDER BY joined_at DESC) as rn
        FROM pro_group_members
        WHERE left_at IS NULL
    ) t WHERE t.rn > 1
);
*/

-- B. Blindagem contra novas duplicatas
-- Garante que um colaborador só possa ter UMA matrícula ativa por grupo
-- Se tentar inserir de novo, o banco deve permitir o UPSERT ou rejeitar a duplicata
DROP INDEX IF EXISTS idx_unique_active_membership;
CREATE UNIQUE INDEX idx_unique_active_membership ON pro_group_members (staff_id, group_id) WHERE (left_at IS NULL);

-- #################################################################
-- # SCHEMA V7.0 - LIBERAÇÃO TOTAL E REMOÇÃO INTELIGENTE
-- #################################################################

-- 1. SEGURANÇA DE ACESSO (MATA ERRO 401/42501)
-- Desbloqueia a tabela para que o sistema possa Gravar, Editar e Excluir
ALTER TABLE IF EXISTS pro_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON pro_group_members;
DROP POLICY IF EXISTS "Chave Mestra de Matriculas" ON pro_group_members;
DROP POLICY IF EXISTS "Full access for authenticated users" ON pro_group_members;

CREATE POLICY "Acesso Total Autenticado" 
ON pro_group_members 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. PERMISSÕES DIRETAS
GRANT ALL ON pro_group_members TO authenticated;
GRANT ALL ON pro_group_members TO service_role;
GRANT ALL ON pro_group_members TO anon;

-- 3. COLUNA DE APOIO PARA HISTÓRICO
ALTER TABLE IF EXISTS pro_group_members 
ADD COLUMN IF NOT EXISTS is_error BOOLEAN DEFAULT FALSE;

-- 4. ÍNDICE DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_pro_group_members_staff_active 
ON pro_group_members (staff_id) 
WHERE (left_at IS NULL);
