
-- #################################################################
-- # UNIFICAÇÃO DE IDENTIDADE GLOBAL (V2)
-- # Objetivo: Corrigir nomes em TODAS as tabelas de histórico
-- #################################################################

CREATE OR REPLACE FUNCTION unify_identity_global(orphan_name text, target_staff_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    count_classes int := 0;
    count_studies int := 0;
    count_visits int := 0;
    total_affected int := 0;
BEGIN
    -- 1. Busca o nome oficial do colaborador no RH
    SELECT name INTO official_name FROM pro_staff WHERE id = target_staff_id;
    
    IF official_name IS NULL THEN
        RETURN 'Erro: Colaborador alvo (ID ' || target_staff_id || ') não encontrado no RH.';
    END IF;

    -- 2. Atualiza Classes Bíblicas (Tabela de Participantes)
    UPDATE bible_class_attendees
    SET staff_id = target_staff_id,
        student_name = official_name
    WHERE lower(trim(student_name)) = lower(trim(orphan_name)) 
    AND (staff_id IS NULL OR staff_id != target_staff_id);
    
    GET DIAGNOSTICS count_classes = ROW_COUNT;

    -- 3. Atualiza Estudos Bíblicos (Apenas Colaboradores)
    -- Assume que 'Colaborador' é o valor padrão para participant_type
    UPDATE bible_studies
    SET name = official_name
    WHERE lower(trim(name)) = lower(trim(orphan_name))
    AND (participant_type = 'Colaborador' OR participant_type IS NULL);

    GET DIAGNOSTICS count_studies = ROW_COUNT;

    -- 4. Atualiza Visitas Pastorais (Apenas Colaboradores)
    UPDATE staff_visits
    SET staff_name = official_name
    WHERE lower(trim(staff_name)) = lower(trim(orphan_name))
    AND (participant_type = 'Colaborador' OR participant_type IS NULL);

    GET DIAGNOSTICS count_visits = ROW_COUNT;

    total_affected := count_classes + count_studies + count_visits;

    RETURN 'Sucesso! Unificados: ' || total_affected || ' registros para ' || official_name || 
           '. (Classes: ' || count_classes || ', Estudos: ' || count_studies || ', Visitas: ' || count_visits || ')';
END;
$$;
