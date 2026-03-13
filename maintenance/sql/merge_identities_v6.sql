
-- #################################################################
-- # MESCLAGEM DE IDENTIDADES UNIVERSAL (V6)
-- # Objetivo: Mesclar dois cadastros existentes, transferindo histórico e removendo a origem.
-- #################################################################

CREATE OR REPLACE FUNCTION merge_identities_v6(
    source_id bigint,
    source_type text, -- 'Colaborador', 'Paciente', 'Prestador'
    target_id bigint,
    target_type text  -- 'Colaborador', 'Paciente', 'Prestador'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    source_name text;
    target_name text;
    target_sector_id bigint;
    target_whatsapp text;
    clean_source text;
BEGIN
    -- 1. Busca dados de origem
    IF source_type = 'Colaborador' THEN SELECT name INTO source_name FROM pro_staff WHERE id = source_id;
    ELSIF source_type = 'Paciente' THEN SELECT name INTO source_name FROM pro_patients WHERE id = source_id;
    ELSIF source_type = 'Prestador' THEN SELECT name INTO source_name FROM pro_providers WHERE id = source_id;
    END IF;

    -- 2. Busca dados de destino
    IF target_type = 'Colaborador' THEN 
        SELECT name, sector_id, whatsapp INTO target_name, target_sector_id, target_whatsapp FROM pro_staff WHERE id = target_id;
    ELSIF target_type = 'Paciente' THEN 
        SELECT name INTO target_name FROM pro_patients WHERE id = target_id;
    ELSIF target_type = 'Prestador' THEN 
        SELECT name INTO target_name FROM pro_providers WHERE id = target_id;
    END IF;

    IF source_name IS NULL THEN RETURN 'Erro: Cadastro de origem não encontrado.'; END IF;
    IF target_name IS NULL THEN RETURN 'Erro: Cadastro de destino não encontrado.'; END IF;

    clean_source := lower(regexp_replace(source_name, '[^a-zA-Z0-9]', '', 'g'));

    -- 3. Atualizar Estudos Bíblicos
    UPDATE bible_studies
    SET name = target_name || ' (' || target_id || ')',
        staff_id = target_id,
        participant_type = target_type,
        sector_id = COALESCE(target_sector_id, sector_id)
    WHERE staff_id = source_id 
       OR lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_source;

    -- 4. Atualizar Visitas Pastorais
    UPDATE staff_visits
    SET staff_name = target_name || ' (' || target_id || ')',
        staff_id = CASE WHEN target_type = 'Colaborador' THEN target_id ELSE NULL END,
        provider_id = CASE WHEN target_type = 'Prestador' THEN target_id ELSE NULL END,
        participant_type = target_type,
        sector_id = COALESCE(target_sector_id, sector_id)
    WHERE staff_id = source_id 
       OR provider_id = source_id 
       OR lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_source;

    -- 5. Atualizar Aulas Bíblicas
    UPDATE bible_class_attendees
    SET staff_id = target_id,
        student_name = target_name
    WHERE staff_id = source_id 
       OR lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) = clean_source;

    -- 6. Atualizar PGs (Liderança)
    UPDATE pro_groups
    SET leader = target_name,
        leader_phone = COALESCE(target_whatsapp, leader_phone)
    WHERE lower(regexp_replace(leader, '[^a-zA-Z0-9]', '', 'g')) = clean_source;

    UPDATE pro_groups
    SET current_leader = target_name
    WHERE lower(regexp_replace(current_leader, '[^a-zA-Z0-9]', '', 'g')) = clean_source;

    UPDATE small_groups
    SET leader = target_name
    WHERE lower(regexp_replace(leader, '[^a-zA-Z0-9]', '', 'g')) = clean_source;

    -- 7. Apagar o registro de origem
    IF source_type = 'Colaborador' THEN DELETE FROM pro_staff WHERE id = source_id;
    ELSIF source_type = 'Paciente' THEN DELETE FROM pro_patients WHERE id = source_id;
    ELSIF source_type = 'Prestador' THEN DELETE FROM pro_providers WHERE id = source_id;
    END IF;

    RETURN 'Sucesso: Histórico de ' || source_name || ' transferido para ' || target_name || ' e cadastro duplicado removido.';
END;
$$;
