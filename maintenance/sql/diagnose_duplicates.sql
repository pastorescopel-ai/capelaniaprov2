
-- #################################################################
-- # DIAGNÓSTICO DE DUPLICATAS (RAIO-X DETALHADO)
-- # Objetivo: Listar lado a lado os registros conflitantes na mesma aula.
-- # Não altera dados. Apenas leitura.
-- #################################################################

WITH NormalizedData AS (
    SELECT 
        a.id AS registro_id,
        a.class_id,
        a.student_name,
        a.staff_id,
        c.date,
        c.sector,
        -- Cria uma impressão digital do nome para comparação (remove acentos/símbolos)
        lower(regexp_replace(a.student_name, '[^a-zA-Z0-9]', '', 'g')) as nome_clean
    FROM bible_class_attendees a
    JOIN bible_classes c ON a.class_id = c.id
),
DupeClusters AS (
    -- Identifica apenas os grupos (Aula + Nome) que aparecem mais de uma vez
    SELECT class_id, nome_clean
    FROM NormalizedData
    GROUP BY class_id, nome_clean
    HAVING COUNT(*) > 1
)
SELECT 
    to_char(nd.date::date, 'DD/MM/YYYY') as data_aula,
    nd.sector as setor,
    nd.student_name as nome_no_registro,
    nd.staff_id as id_oficial_rh,
    CASE 
        WHEN nd.staff_id IS NOT NULL THEN 'MANTER (Oficial)'
        ELSE 'REMOVER (Duplicata)'
    END as acao_prevista,
    nd.registro_id as id_interno_sistema
FROM NormalizedData nd
JOIN DupeClusters dc ON nd.class_id = dc.class_id AND nd.nome_clean = dc.nome_clean
ORDER BY nd.date DESC, nd.sector, nd.student_name;
