
-- #################################################################
-- # CURA DE HISTÓRICO: PREENCHER STAFF_ID EM NULOS
-- # Objetivo: Localizar alunos sem ID na lista de presença e 
-- # vincular ao colaborador oficial (pro_staff) pelo nome.
-- #################################################################

DO $$
DECLARE
    count_updated int := 0;
BEGIN
    -- Atualiza a tabela de presença (attendees)
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

    RAISE NOTICE 'SUCESSO: % registros de presença foram recuperados e vinculados ao ID oficial.', count_updated;
END $$;
