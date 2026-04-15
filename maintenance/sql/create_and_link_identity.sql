
-- #################################################################
-- # CRIAÇÃO E VÍNCULO DE IDENTIDADE (AUTO-ID GENERATION)
-- # Objetivo: Criar Pacientes (9B) e Prestadores (8B) e vincular
-- #################################################################

CREATE OR REPLACE FUNCTION create_and_link_identity(
    target_name text, 
    entity_type text, -- 'Paciente' ou 'Prestador'
    target_unit text DEFAULT 'HAB'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id bigint;
    range_start bigint;
    clean_name text;
    existing_id bigint;
    affected_rows int := 0;
    total_history int := 0;
    official_name text;
BEGIN
    clean_name := lower(regexp_replace(target_name, '[^a-zA-Z0-9]', '', 'g'));

    -- 1. LÓGICA DE PACIENTE (9 Bilhões)
    IF entity_type = 'Paciente' THEN
        range_start := 9000000000;
        
        -- Tenta encontrar existente. O cast ::bigint garante comparação numérica.
        SELECT id, name INTO existing_id, official_name FROM pro_patients 
        WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_name
        LIMIT 1;
        
        IF existing_id IS NULL THEN
            -- Pega o maior ID atual (assegurando que seja tratado como bigint)
            SELECT COALESCE(MAX(id), range_start) + 1 INTO new_id FROM pro_patients WHERE id >= range_start;
            
            INSERT INTO pro_patients (id, name, unit, updated_at) 
            VALUES (new_id, target_name, target_unit, now());
            official_name := target_name;
        ELSE
            new_id := existing_id;
        END IF;

    -- 2. LÓGICA DE PRESTADOR (8 Bilhões)
    ELSIF entity_type = 'Prestador' THEN
        range_start := 8000000000;
        
        SELECT id, name INTO existing_id, official_name FROM pro_providers 
        WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_name
        LIMIT 1;
        
        IF existing_id IS NULL THEN
            SELECT COALESCE(MAX(id), range_start) + 1 INTO new_id FROM pro_providers WHERE id >= range_start;
            
            INSERT INTO pro_providers (id, name, unit, updated_at) 
            VALUES (new_id, target_name, target_unit, now());
            official_name := target_name;
        ELSE
            new_id := existing_id;
        END IF;
    ELSE
        RETURN 'Erro: Tipo inválido. Use "Paciente" ou "Prestador".';
    END IF;

    -- 3. VÍNCULO NO HISTÓRICO
    -- Atualiza tabelas históricas usando o novo BIGINT e corrigindo o tipo de participante
    
    -- Estudos (bible_study_sessions)
    UPDATE bible_study_sessions 
    SET staff_id = CASE WHEN entity_type = 'Colaborador' THEN new_id ELSE NULL END,
        participant_id = CASE WHEN entity_type IN ('Paciente', 'Prestador') THEN new_id ELSE NULL END,
        participant_type = entity_type, 
        name = official_name
    WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_name 
    AND (staff_id IS NULL OR staff_id != new_id OR participant_type != entity_type);
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    total_history := total_history + affected_rows;

    -- Visitas (staff_visits)
    UPDATE staff_visits 
    SET staff_id = CASE WHEN entity_type = 'Colaborador' THEN new_id ELSE NULL END,
        provider_id = CASE WHEN entity_type = 'Prestador' THEN new_id ELSE NULL END,
        participant_type = entity_type, 
        staff_name = official_name
    WHERE lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_name 
    AND (
        (entity_type = 'Colaborador' AND (staff_id IS NULL OR staff_id != new_id)) OR
        (entity_type = 'Prestador' AND (provider_id IS NULL OR provider_id != new_id)) OR
        (entity_type = 'Paciente' AND (participant_type != 'Paciente'))
    );
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    total_history := total_history + affected_rows;
    
    -- Classes (bible_class_attendees)
    UPDATE bible_class_attendees
    SET staff_id = CASE WHEN entity_type = 'Colaborador' THEN new_id ELSE NULL END,
        participant_id = CASE WHEN entity_type IN ('Paciente', 'Prestador') THEN new_id ELSE NULL END,
        student_name = official_name
    WHERE lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_name 
    AND (staff_id IS NULL AND participant_id IS NULL OR staff_id != new_id OR participant_id != new_id);
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    total_history := total_history + affected_rows;

    RETURN 'Sucesso! ' || entity_type || ' "' || official_name || '" ID: ' || new_id || '. (' || total_history || ' registros históricos vinculados)';
END;
$$;
