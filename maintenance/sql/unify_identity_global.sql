
-- #################################################################
-- # UNIFICAÇÃO DE IDENTIDADE GLOBAL (V4 - NUCLEAR MATCH)
-- # Objetivo: Vínculo total ignorando espaços extras e acentos
-- #################################################################

CREATE OR REPLACE FUNCTION unify_identity_global(orphan_name text, target_staff_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    official_sector_id bigint;
    count_classes int := 0;
    count_studies int := 0;
    count_visits int := 0;
    total_affected int := 0;
    -- Função interna para normalizar (remove tudo que não é letra/número e minúsculo)
    clean_orphan text;
BEGIN
    -- Prepara o nome órfão para comparação "nuclear" (sem espaços, sem símbolos)
    clean_orphan := lower(regexp_replace(orphan_name, '[^a-zA-Z0-9]', '', 'g'));

    -- 1. Busca dados oficiais do colaborador no RH
    SELECT name, sector_id INTO official_name, official_sector_id 
    FROM pro_staff WHERE id = target_staff_id;
    
    IF official_name IS NULL THEN
        RETURN 'Erro: Colaborador alvo (ID ' || target_staff_id || ') não encontrado no RH.';
    END IF;

    -- 2. Atualiza ALUNOS DE CLASSES
    UPDATE bible_class_attendees
    SET staff_id = target_staff_id,
        student_name = official_name
    WHERE lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND (staff_id IS NULL OR staff_id != target_staff_id);
    
    GET DIAGNOSTICS count_classes = ROW_COUNT;

    -- 3. Atualiza ESTUDOS BÍBLICOS
    UPDATE bible_studies
    SET name = official_name,
        staff_id = target_staff_id,
        sector_id = COALESCE(official_sector_id, sector_id),
        participant_type = 'Colaborador'
    WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND (staff_id IS NULL OR staff_id != target_staff_id);

    GET DIAGNOSTICS count_studies = ROW_COUNT;

    -- 4. Atualiza VISITAS PASTORAIS
    UPDATE staff_visits
    SET staff_name = official_name,
        staff_id = target_staff_id,
        sector_id = COALESCE(official_sector_id, sector_id),
        participant_type = 'Colaborador'
    WHERE lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND (staff_id IS NULL OR staff_id != target_staff_id);

    GET DIAGNOSTICS count_visits = ROW_COUNT;

    total_affected := count_classes + count_studies + count_visits;

    RETURN 'Vínculo Forte Realizado! ' || total_affected || ' registros de "' || orphan_name || '" foram unificados para ' || official_name;
END;
$$;
