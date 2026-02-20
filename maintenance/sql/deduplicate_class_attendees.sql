
-- #################################################################
-- # LIMPEZA CIRÚRGICA DE DUPLICATAS NA MESMA AULA
-- # Objetivo: Remover alunos duplicados na mesma chamada (bible_class_attendees)
-- # Mantém o registro com staff_id (oficial) ou o mais recente.
-- #################################################################

CREATE OR REPLACE FUNCTION deduplicate_class_attendees()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count int := 0;
BEGIN
    -- Utiliza CTE para identificar duplicatas baseadas em normalização de nome e class_id
    WITH Duplicates AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY class_id, lower(regexp_replace(student_name, '[^a-zA-Z0-9]', '', 'g')) 
                ORDER BY 
                    CASE WHEN staff_id IS NOT NULL THEN 1 ELSE 0 END DESC, -- Prioridade 1: Tem vínculo oficial
                    id DESC -- Prioridade 2: É o registro mais novo
            ) as rn
        FROM bible_class_attendees
    )
    DELETE FROM bible_class_attendees
    WHERE id IN (SELECT id FROM Duplicates WHERE rn > 1);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN 'Limpeza concluída: ' || deleted_count || ' duplicatas removidas da tabela de presenças.';
END;
$$;
