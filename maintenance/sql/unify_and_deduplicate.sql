
-- #################################################################
-- # UNIFICAÇÃO & DEDUPLICAÇÃO INTELIGENTE (V5.1 - Fix Syntax)
-- # Objetivo: Vincular registros órfãos, mas DELETAR se causar duplicidade na mesma aula.
-- #################################################################

CREATE OR REPLACE FUNCTION unify_and_deduplicate_identity(orphan_name text, target_staff_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    official_sector_id bigint;
    deleted_duplicates int := 0;
    updated_classes int := 0;
    updated_others int := 0;
    temp_count int := 0; -- Variável auxiliar para soma
    clean_orphan text;
BEGIN
    -- 1. Normaliza o nome de entrada (caixa baixa, sem símbolos)
    clean_orphan := lower(regexp_replace(orphan_name, '[^a-zA-Z0-9]', '', 'g'));

    -- 2. Busca dados oficiais do colaborador no RH
    SELECT name, sector_id INTO official_name, official_sector_id 
    FROM pro_staff WHERE id = target_staff_id;
    
    IF official_name IS NULL THEN
        RETURN 'Erro: Colaborador alvo (ID ' || target_staff_id || ') não encontrado no RH.';
    END IF;

    -- =========================================================
    -- FASE A: DEDUPLICAÇÃO (Limpeza Cirúrgica em Classes)
    -- =========================================================
    
    -- Deleta registros órfãos SE já existir um registro oficial (com ID) na MESMA aula.
    DELETE FROM bible_class_attendees orphan
    WHERE lower(regexp_replace(orphan.student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND orphan.staff_id IS NULL
    AND EXISTS (
        SELECT 1 FROM bible_class_attendees official
        WHERE official.class_id = orphan.class_id
        AND official.staff_id = target_staff_id
    );
    
    GET DIAGNOSTICS deleted_duplicates = ROW_COUNT;

    -- =========================================================
    -- FASE B: VINCULAÇÃO (Atualiza quem sobrou)
    -- =========================================================

    -- Atualiza ALUNOS DE CLASSES
    UPDATE bible_class_attendees
    SET staff_id = target_staff_id,
        student_name = official_name
    WHERE lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND staff_id IS NULL;
    
    GET DIAGNOSTICS updated_classes = ROW_COUNT;

    -- Atualiza ESTUDOS BÍBLICOS
    UPDATE bible_studies
    SET name = official_name,
        staff_id = target_staff_id,
        sector_id = COALESCE(official_sector_id, sector_id),
        participant_type = 'Colaborador'
    WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND (staff_id IS NULL OR staff_id != target_staff_id);

    GET DIAGNOSTICS updated_others = ROW_COUNT;

    -- Atualiza VISITAS PASTORAIS
    UPDATE staff_visits
    SET staff_name = official_name,
        staff_id = target_staff_id,
        sector_id = COALESCE(official_sector_id, sector_id),
        participant_type = 'Colaborador'
    WHERE lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND (staff_id IS NULL OR staff_id != target_staff_id);

    -- Correção da soma: Captura primeiro, soma depois
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    updated_others := updated_others + temp_count;

    RETURN 'Concluído: ' || deleted_duplicates || ' duplicatas removidas. ' || (updated_classes + updated_others) || ' registros unificados para ' || official_name;
END;
$$;
