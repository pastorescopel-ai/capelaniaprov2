
-- #################################################################
-- # UNIFICAÇÃO DE IDENTIDADE UNIVERSAL (V6)
-- # Objetivo: Vincular registros órfãos a Colaboradores, Pacientes ou Prestadores.
-- #################################################################

CREATE OR REPLACE FUNCTION unify_identity_v6(
    orphan_name text, 
    target_id bigint, 
    target_type text -- 'Colaborador', 'Paciente', 'Prestador'
)
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
    temp_count int := 0;
    clean_orphan text;
BEGIN
    -- 1. Normaliza o nome de entrada
    clean_orphan := lower(regexp_replace(orphan_name, '[^a-zA-Z0-9]', '', 'g'));

    -- 2. Busca dados oficiais baseado no tipo
    IF target_type = 'Colaborador' THEN
        SELECT name, sector_id INTO official_name, official_sector_id 
        FROM pro_staff WHERE id = target_id;
        IF official_name IS NULL THEN 
            RETURN 'Erro: Colaborador alvo (ID ' || target_id || ') não encontrado no RH.'; 
        END IF;
    ELSIF target_type = 'Paciente' THEN
        SELECT name INTO official_name FROM pro_patients WHERE id = target_id;
        IF official_name IS NULL THEN 
            RETURN 'Erro: Paciente alvo (ID ' || target_id || ') não encontrado.'; 
        END IF;
    ELSIF target_type = 'Prestador' THEN
        SELECT name INTO official_name FROM pro_providers WHERE id = target_id;
        IF official_name IS NULL THEN 
            RETURN 'Erro: Prestador alvo (ID ' || target_id || ') não encontrado.'; 
        END IF;
    ELSE
        RETURN 'Erro: Tipo de alvo inválido. Use "Colaborador", "Paciente" ou "Prestador".';
    END IF;

    -- 3. DEDUPLICAÇÃO EM CLASSES (Limpeza de duplicatas na mesma aula)
    DELETE FROM bible_class_attendees orphan
    WHERE lower(regexp_replace(orphan.student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND orphan.staff_id IS NULL
    AND EXISTS (
        SELECT 1 FROM bible_class_attendees official
        WHERE official.class_id = orphan.class_id
        AND official.staff_id = target_id
    );
    GET DIAGNOSTICS deleted_duplicates = ROW_COUNT;

    -- 4. VINCULAÇÃO EM CLASSES
    UPDATE bible_class_attendees
    SET staff_id = target_id,
        student_name = official_name
    WHERE lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND staff_id IS NULL;
    GET DIAGNOSTICS updated_classes = ROW_COUNT;

    -- 5. VINCULAÇÃO EM ESTUDOS BÍBLICOS (bible_studies)
    UPDATE bible_studies
    SET name = official_name,
        staff_id = target_id,
        sector_id = COALESCE(official_sector_id, sector_id),
        participant_type = target_type
    WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND (staff_id IS NULL OR staff_id != target_id OR participant_type != target_type);
    GET DIAGNOSTICS updated_others = ROW_COUNT;

    -- 6. VINCULAÇÃO EM VISITAS PASTORAIS (staff_visits)
    UPDATE staff_visits
    SET staff_name = official_name,
        staff_id = CASE WHEN target_type = 'Colaborador' THEN target_id ELSE NULL END,
        provider_id = CASE WHEN target_type = 'Prestador' THEN target_id ELSE NULL END,
        sector_id = COALESCE(official_sector_id, sector_id),
        participant_type = target_type
    WHERE lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
    AND (
        (target_type = 'Colaborador' AND (staff_id IS NULL OR staff_id != target_id)) OR
        (target_type = 'Prestador' AND (provider_id IS NULL OR provider_id != target_id)) OR
        (target_type = 'Paciente' AND (participant_type != 'Paciente' OR staff_id IS NOT NULL OR provider_id IS NOT NULL))
    );
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    updated_others := updated_others + temp_count;

    -- 7. VINCULAÇÃO EM PGs (Liderança)
    IF target_type = 'Colaborador' THEN
        UPDATE pro_groups
        SET leader = official_name,
            leader_phone = COALESCE((SELECT whatsapp FROM pro_staff WHERE id = target_id), leader_phone)
        WHERE lower(regexp_replace(leader, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;

        UPDATE pro_groups
        SET current_leader = official_name
        WHERE lower(regexp_replace(current_leader, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;

        UPDATE small_groups
        SET leader = official_name
        WHERE lower(regexp_replace(leader, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    END IF;

    RETURN 'Sucesso: ' || deleted_duplicates || ' duplicatas removidas. ' || (updated_classes + updated_others) || ' registros unificados para ' || official_name || ' (' || target_type || ')';
END;
$$;
