
-- #################################################################
-- # CONVERSÃO DE TIPO DE IDENTIDADE
-- # Objetivo: Marcar registros como Paciente/Prestador e limpar StaffID
-- #################################################################

CREATE OR REPLACE FUNCTION convert_identity_type(target_name text, new_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    count_studies int := 0;
    count_visits int := 0;
    total_affected int := 0;
    clean_target text;
BEGIN
    -- Normalização nuclear para garantir que pegue variações
    clean_target := lower(regexp_replace(target_name, '[^a-zA-Z0-9]', '', 'g'));

    -- Atualiza ESTUDOS BÍBLICOS
    UPDATE bible_studies
    SET participant_type = new_type,
        staff_id = NULL -- Remove vínculo de staff pois não é staff
    WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = clean_target;
    
    GET DIAGNOSTICS count_studies = ROW_COUNT;

    -- Atualiza VISITAS PASTORAIS
    UPDATE staff_visits
    SET participant_type = new_type,
        staff_id = NULL
    WHERE lower(regexp_replace(staff_name, '[^a-zA-Z0-9]', '', 'g')) = clean_target;

    GET DIAGNOSTICS count_visits = ROW_COUNT;

    total_affected := count_studies + count_visits;

    RETURN 'Convertido: ' || total_affected || ' registros de "' || target_name || '" agora são do tipo ' || new_type || '.';
END;
$$;
