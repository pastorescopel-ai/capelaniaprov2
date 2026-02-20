
-- #################################################################
-- # RPC: CURA EM MASSA DE ALUNOS (bible_class_attendees)
-- # Objetivo: Preencher staff_id em registros órfãos automaticamente
-- # comparando nomes com o RH (pro_staff).
-- #################################################################

CREATE OR REPLACE FUNCTION bulk_heal_attendees()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    count_updated int := 0;
BEGIN
    -- Atualiza a tabela de presença (attendees) cruzando com staff
    UPDATE bible_class_attendees a
    SET staff_id = p.id
    FROM pro_staff p
    WHERE 
        -- Regra 1: O registro atual não tem ID (é órfão)
        a.staff_id IS NULL
        
        -- Regra 2: O nome batiza com o RH (Normalizado: sem acentos/espaços/símbolos)
        AND lower(regexp_replace(a.student_name, '[^a-zA-Z0-9]', '', 'g')) = 
            lower(regexp_replace(p.name, '[^a-zA-Z0-9]', '', 'g'));

    GET DIAGNOSTICS count_updated = ROW_COUNT;

    RETURN 'Processo concluído: ' || count_updated || ' registros de presença foram recuperados e vinculados automaticamente.';
END;
$$;
