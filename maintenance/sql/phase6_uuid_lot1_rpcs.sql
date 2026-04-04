-- Fase 6: Atualização de RPCs (Data Healer) para suportar UUIDs e BIGINTs mistos
-- Como estamos migrando em lotes, algumas tabelas usam UUID e outras BIGINT.
-- As funções RPC precisam aceitar TEXT e fazer o cast correto dependendo do tipo de alvo.

BEGIN;

-- 1. heal_sector_global
DROP FUNCTION IF EXISTS heal_sector_global(text, bigint);
CREATE OR REPLACE FUNCTION heal_sector_global(bad_name text, target_sector_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    updated_count int := 0;
    clean_bad text;
BEGIN
    clean_bad := lower(regexp_replace(bad_name, '[^a-zA-Z0-9]', '', 'g'));

    -- Busca o nome oficial do setor (agora usando UUID)
    SELECT name INTO official_name FROM pro_sectors WHERE id = target_sector_id::uuid;
    
    IF official_name IS NULL THEN
        RETURN 'Erro: Setor alvo não encontrado.';
    END IF;

    -- Atualiza PGs
    UPDATE pro_groups
    SET sector_id = target_sector_id::uuid
    WHERE lower(regexp_replace(unit, '[^a-zA-Z0-9]', '', 'g')) = clean_bad;
    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Atualiza Colaboradores
    UPDATE pro_staff
    SET sector_id = target_sector_id::uuid
    WHERE lower(regexp_replace(unit, '[^a-zA-Z0-9]', '', 'g')) = clean_bad;
    updated_count := updated_count + FOUND::int;

    -- Atualiza Estudos Bíblicos
    UPDATE bible_study_sessions
    SET sector_id = target_sector_id::uuid, sector = official_name
    WHERE lower(regexp_replace(sector, '[^a-zA-Z0-9]', '', 'g')) = clean_bad;

    RETURN 'Sucesso! Setor unificado.';
END;
$$;

-- 2. unify_identity_v6
DROP FUNCTION IF EXISTS unify_identity_v6(text, bigint, text);
CREATE OR REPLACE FUNCTION unify_identity_v6(
    orphan_name text, 
    target_id text, 
    target_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    official_sector_id uuid;
    deleted_duplicates int := 0;
    updated_classes int := 0;
    updated_others int := 0;
    temp_count int := 0;
    clean_orphan text;
BEGIN
    clean_orphan := lower(regexp_replace(orphan_name, '[^a-zA-Z0-9]', '', 'g'));

    IF target_type = 'Colaborador' THEN
        SELECT name, sector_id INTO official_name, official_sector_id 
        FROM pro_staff WHERE id = target_id::uuid;
        IF official_name IS NULL THEN RETURN 'Erro: Colaborador não encontrado.'; END IF;
    ELSIF target_type = 'Paciente' THEN
        SELECT name INTO official_name FROM pro_patients WHERE id = target_id::bigint;
        IF official_name IS NULL THEN RETURN 'Erro: Paciente não encontrado.'; END IF;
    ELSIF target_type = 'Prestador' THEN
        SELECT name INTO official_name FROM pro_providers WHERE id = target_id::bigint;
        IF official_name IS NULL THEN RETURN 'Erro: Prestador não encontrado.'; END IF;
    ELSE
        RETURN 'Erro: Tipo inválido.';
    END IF;

    -- DEDUPLICAÇÃO EM CLASSES
    DELETE FROM bible_class_attendees orphan
    USING bible_class_attendees official
    WHERE orphan.class_id = official.class_id
      AND lower(regexp_replace(orphan.student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
      AND (
          (target_type = 'Colaborador' AND official.staff_id = target_id::uuid) OR
          (target_type != 'Colaborador' AND lower(regexp_replace(official.student_name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(official_name, '[^a-zA-Z0-9]', '', 'g')))
      )
      AND orphan.id != official.id;
    GET DIAGNOSTICS deleted_duplicates = ROW_COUNT;

    -- VINCULAÇÃO EM CLASSES
    IF target_type = 'Colaborador' THEN
        UPDATE bible_class_attendees
        SET staff_id = target_id::uuid, student_name = official_name
        WHERE lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
          AND staff_id IS NULL;
    ELSE
        UPDATE bible_class_attendees
        SET student_name = official_name
        WHERE lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    END IF;
    GET DIAGNOSTICS updated_classes = ROW_COUNT;

    -- VINCULAÇÃO EM ESTUDOS BÍBLICOS
    IF target_type = 'Colaborador' THEN
        UPDATE bible_study_sessions
        SET staff_id = target_id::uuid, name = official_name, participant_type = 'Colaborador', sector_id = COALESCE(sector_id, official_sector_id)
        WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    ELSE
        UPDATE bible_study_sessions
        SET name = official_name, participant_type = target_type
        WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    END IF;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    updated_others := updated_others + temp_count;

    -- VINCULAÇÃO EM VISITAS
    IF target_type = 'Colaborador' THEN
        UPDATE staff_visits
        SET staff_id = target_id::uuid, staff_name = official_name, participant_type = 'Colaborador'
        WHERE lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    ELSE
        UPDATE staff_visits
        SET staff_name = official_name, participant_type = target_type
        WHERE lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    END IF;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    updated_others := updated_others + temp_count;

    -- VINCULAÇÃO EM PGs (Apenas se for Colaborador)
    IF target_type = 'Colaborador' THEN
        UPDATE small_group_sessions
        SET leader = official_name
        WHERE lower(regexp_replace(leader, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
        
        UPDATE visit_requests
        SET leader_name = official_name
        WHERE lower(regexp_replace(leader_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    END IF;

    RETURN 'Sucesso! Duplicatas removidas: ' || deleted_duplicates || '. Aulas atualizadas: ' || updated_classes || '. Outros registros: ' || updated_others || '.';
END;
$$;

-- 3. merge_identities_v6
DROP FUNCTION IF EXISTS merge_identities_v6(bigint, text, bigint, text);
CREATE OR REPLACE FUNCTION merge_identities_v6(
    source_id text,
    source_type text,
    target_id text,
    target_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    official_sector_id uuid;
    source_name text;
    deleted_duplicates int := 0;
    updated_classes int := 0;
    updated_others int := 0;
    temp_count int := 0;
BEGIN
    -- 1. Busca dados do ALVO (Target)
    IF target_type = 'Colaborador' THEN
        SELECT name, sector_id INTO official_name, official_sector_id FROM pro_staff WHERE id = target_id::uuid;
    ELSIF target_type = 'Paciente' THEN
        SELECT name INTO official_name FROM pro_patients WHERE id = target_id::bigint;
    ELSIF target_type = 'Prestador' THEN
        SELECT name INTO official_name FROM pro_providers WHERE id = target_id::bigint;
    END IF;

    IF official_name IS NULL THEN RETURN 'Erro: Alvo não encontrado.'; END IF;

    -- 2. Busca dados da ORIGEM (Source)
    IF source_type = 'Colaborador' THEN
        SELECT name INTO source_name FROM pro_staff WHERE id = source_id::uuid;
    ELSIF source_type = 'Paciente' THEN
        SELECT name INTO source_name FROM pro_patients WHERE id = source_id::bigint;
    ELSIF source_type = 'Prestador' THEN
        SELECT name INTO source_name FROM pro_providers WHERE id = source_id::bigint;
    END IF;

    IF source_name IS NULL THEN RETURN 'Erro: Origem não encontrada.'; END IF;

    -- 3. DEDUPLICAÇÃO EM CLASSES
    IF source_type = 'Colaborador' AND target_type = 'Colaborador' THEN
        DELETE FROM bible_class_attendees source_rec
        USING bible_class_attendees target_rec
        WHERE source_rec.class_id = target_rec.class_id
          AND source_rec.staff_id = source_id::uuid
          AND target_rec.staff_id = target_id::uuid
          AND source_rec.id != target_rec.id;
        GET DIAGNOSTICS deleted_duplicates = ROW_COUNT;
    END IF;

    -- 4. VINCULAÇÃO EM CLASSES
    IF source_type = 'Colaborador' THEN
        IF target_type = 'Colaborador' THEN
            UPDATE bible_class_attendees SET staff_id = target_id::uuid, student_name = official_name WHERE staff_id = source_id::uuid;
        ELSE
            UPDATE bible_class_attendees SET staff_id = NULL, student_name = official_name WHERE staff_id = source_id::uuid;
        END IF;
    ELSE
        IF target_type = 'Colaborador' THEN
            UPDATE bible_class_attendees SET staff_id = target_id::uuid, student_name = official_name WHERE student_name = source_name AND staff_id IS NULL;
        ELSE
            UPDATE bible_class_attendees SET student_name = official_name WHERE student_name = source_name AND staff_id IS NULL;
        END IF;
    END IF;
    GET DIAGNOSTICS updated_classes = ROW_COUNT;

    -- 5. VINCULAÇÃO EM ESTUDOS BÍBLICOS
    IF source_type = 'Colaborador' THEN
        IF target_type = 'Colaborador' THEN
            UPDATE bible_study_sessions SET staff_id = target_id::uuid, name = official_name, sector_id = COALESCE(sector_id, official_sector_id) WHERE staff_id = source_id::uuid;
        ELSE
            UPDATE bible_study_sessions SET staff_id = NULL, name = official_name, participant_type = target_type WHERE staff_id = source_id::uuid;
        END IF;
    ELSE
        IF target_type = 'Colaborador' THEN
            UPDATE bible_study_sessions SET staff_id = target_id::uuid, name = official_name, participant_type = 'Colaborador', sector_id = COALESCE(sector_id, official_sector_id) WHERE name = source_name AND staff_id IS NULL;
        ELSE
            UPDATE bible_study_sessions SET name = official_name, participant_type = target_type WHERE name = source_name AND staff_id IS NULL;
        END IF;
    END IF;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    updated_others := updated_others + temp_count;

    -- 6. VINCULAÇÃO EM VISITAS
    IF source_type = 'Colaborador' THEN
        IF target_type = 'Colaborador' THEN
            UPDATE staff_visits SET staff_id = target_id::uuid, staff_name = official_name WHERE staff_id = source_id::uuid;
        ELSE
            UPDATE staff_visits SET staff_id = NULL, staff_name = official_name, participant_type = target_type WHERE staff_id = source_id::uuid;
        END IF;
    ELSE
        IF target_type = 'Colaborador' THEN
            UPDATE staff_visits SET staff_id = target_id::uuid, staff_name = official_name, participant_type = 'Colaborador' WHERE staff_name = source_name AND staff_id IS NULL;
        ELSE
            UPDATE staff_visits SET staff_name = official_name, participant_type = target_type WHERE staff_name = source_name AND staff_id IS NULL;
        END IF;
    END IF;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    updated_others := updated_others + temp_count;

    -- 7. VINCULAÇÃO EM PGs
    IF source_type = 'Colaborador' AND target_type = 'Colaborador' THEN
        UPDATE pro_group_members SET staff_id = target_id::uuid WHERE staff_id = source_id::uuid;
        UPDATE pro_history_records SET staff_id = target_id::uuid, staff_name = official_name WHERE staff_id = source_id::uuid;
    END IF;

    -- 8. DELETAR ORIGEM
    IF source_type = 'Colaborador' THEN DELETE FROM pro_staff WHERE id = source_id::uuid;
    ELSIF source_type = 'Paciente' THEN DELETE FROM pro_patients WHERE id = source_id::bigint;
    ELSIF source_type = 'Prestador' THEN DELETE FROM pro_providers WHERE id = source_id::bigint;
    END IF;

    RETURN 'Sucesso! Duplicatas removidas: ' || deleted_duplicates || '. Aulas atualizadas: ' || updated_classes || '. Outros registros: ' || updated_others || '.';
END;
$$;

-- 4. unify_and_deduplicate_identity
DROP FUNCTION IF EXISTS unify_and_deduplicate_identity(text, bigint);
CREATE OR REPLACE FUNCTION unify_and_deduplicate_identity(orphan_name text, target_staff_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    official_sector_id uuid;
    deleted_duplicates int := 0;
    updated_classes int := 0;
    updated_others int := 0;
    temp_count int := 0;
    clean_orphan text;
BEGIN
    clean_orphan := lower(regexp_replace(orphan_name, '[^a-zA-Z0-9]', '', 'g'));

    SELECT name, sector_id INTO official_name, official_sector_id 
    FROM pro_staff WHERE id = target_staff_id::uuid;
    
    IF official_name IS NULL THEN 
        RETURN 'Erro: Colaborador alvo não encontrado no RH.'; 
    END IF;

    -- DEDUPLICAÇÃO EM CLASSES
    DELETE FROM bible_class_attendees orphan
    USING bible_class_attendees official
    WHERE orphan.class_id = official.class_id
      AND lower(regexp_replace(orphan.student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
      AND official.staff_id = target_staff_id::uuid
      AND orphan.id != official.id;
    GET DIAGNOSTICS deleted_duplicates = ROW_COUNT;

    -- VINCULAÇÃO EM CLASSES
    UPDATE bible_class_attendees
    SET staff_id = target_staff_id::uuid, student_name = official_name
    WHERE lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan
      AND staff_id IS NULL;
    GET DIAGNOSTICS updated_classes = ROW_COUNT;

    -- VINCULAÇÃO EM ESTUDOS BÍBLICOS
    UPDATE bible_study_sessions
    SET staff_id = target_staff_id::uuid, name = official_name, participant_type = 'Colaborador', sector_id = COALESCE(sector_id, official_sector_id)
    WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    updated_others := updated_others + temp_count;

    -- VINCULAÇÃO EM VISITAS
    UPDATE staff_visits
    SET staff_id = target_staff_id::uuid, staff_name = official_name, participant_type = 'Colaborador'
    WHERE lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    updated_others := updated_others + temp_count;

    -- VINCULAÇÃO EM PGs
    UPDATE small_group_sessions
    SET leader = official_name
    WHERE lower(regexp_replace(leader, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    
    UPDATE visit_requests
    SET leader_name = official_name
    WHERE lower(regexp_replace(leader_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;

    RETURN 'Sucesso! Duplicatas removidas: ' || deleted_duplicates || '. Aulas atualizadas: ' || updated_classes || '. Outros registros: ' || updated_others || '.';
END;
$$;

-- 5. unify_identity_global
DROP FUNCTION IF EXISTS unify_identity_global(text, bigint);
CREATE OR REPLACE FUNCTION unify_identity_global(orphan_name text, target_staff_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    official_sector_id uuid;
    count_classes int := 0;
    count_studies int := 0;
    count_visits int := 0;
    clean_orphan text;
BEGIN
    clean_orphan := lower(regexp_replace(orphan_name, '[^a-zA-Z0-9]', '', 'g'));

    SELECT name, sector_id INTO official_name, official_sector_id 
    FROM pro_staff WHERE id = target_staff_id::uuid;
    
    IF official_name IS NULL THEN 
        RETURN 'Erro: Colaborador alvo não encontrado no RH.'; 
    END IF;

    -- VINCULAÇÃO EM CLASSES
    UPDATE bible_class_attendees
    SET staff_id = target_staff_id::uuid, student_name = official_name
    WHERE lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    GET DIAGNOSTICS count_classes = ROW_COUNT;

    -- VINCULAÇÃO EM ESTUDOS BÍBLICOS
    UPDATE bible_study_sessions
    SET staff_id = target_staff_id::uuid, name = official_name, participant_type = 'Colaborador', sector_id = COALESCE(sector_id, official_sector_id)
    WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    GET DIAGNOSTICS count_studies = ROW_COUNT;

    -- VINCULAÇÃO EM VISITAS
    UPDATE staff_visits
    SET staff_id = target_staff_id::uuid, staff_name = official_name, participant_type = 'Colaborador'
    WHERE lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    GET DIAGNOSTICS count_visits = ROW_COUNT;

    -- VINCULAÇÃO EM PGs
    UPDATE small_group_sessions
    SET leader = official_name
    WHERE lower(regexp_replace(leader, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;
    
    UPDATE visit_requests
    SET leader_name = official_name
    WHERE lower(regexp_replace(leader_name, '[^a-zA-Z0-9]', '', 'g')) = clean_orphan;

    RETURN 'Sucesso! Aulas: ' || count_classes || '. Estudos: ' || count_studies || '. Visitas: ' || count_visits || '.';
END;
$$;

COMMIT;
