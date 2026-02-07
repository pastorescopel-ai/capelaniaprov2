
-- ##########################################################################
-- # CORREÇÃO DEFINITIVA: 42883 + PERMISSÕES + LOGS DETALHADOS
-- # ESCOPO: Apenas tabela pro_groups
-- ##########################################################################

CREATE OR REPLACE FUNCTION unify_ids_total()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    r RECORD;
    target_id text;
    moved_count int := 0;
    log_out text := '';
    found_count int := 0;
BEGIN
    log_out := '=== INÍCIO DO DIAGNÓSTICO ===' || chr(10);
    
    SELECT count(*) INTO found_count FROM pro_groups WHERE id::text ~* '^(HAB|HABA)[-\s]+[0-9]+';
    log_out := log_out || 'Registros encontrados com prefixo: ' || found_count || chr(10);

    IF found_count = 0 THEN
        RETURN log_out || 'Nenhum PG precisando de limpeza foi encontrado.';
    END IF;

    FOR r IN SELECT * FROM pro_groups WHERE id::text ~* '^(HAB|HABA)[-\s]+[0-9]+' LOOP
        target_id := regexp_replace(r.id::text, '^(HAB|HABA)[-\s]*', '', 'i');
        target_id := trim(target_id); 
        
        log_out := log_out || '> Processando [' || r.id || '] -> Alvo: [' || target_id || ']';

        IF target_id = '' OR target_id IS NULL THEN
            log_out := log_out || ' ... PULEI (ID vazio)' || chr(10);
            CONTINUE; 
        END IF;

        IF target_id = r.id::text THEN
            log_out := log_out || ' ... PULEI (ID idêntico)' || chr(10);
            CONTINUE;
        END IF;

        IF EXISTS (SELECT 1 FROM pro_groups WHERE id::text = target_id) THEN
            log_out := log_out || ' ... FUSÃO detectada.';
            DELETE FROM pro_group_locations 
            WHERE group_id = r.id 
            AND sector_id IN (SELECT sector_id FROM pro_group_locations WHERE group_id = target_id);
            UPDATE pro_group_locations SET group_id = target_id WHERE group_id = r.id;
            DELETE FROM pro_groups WHERE id = r.id;
        ELSE
            log_out := log_out || ' ... MIGRAÇÃO (Criando novo).';
            INSERT INTO pro_groups (id, name, current_leader, sector_id, unit, active, updated_at)
            VALUES (target_id, r.name, r.current_leader, r.sector_id, r.unit, r.active, r.updated_at);
            UPDATE pro_group_locations SET group_id = target_id WHERE group_id = r.id;
            DELETE FROM pro_groups WHERE id = r.id;
        END IF;
        
        log_out := log_out || ' [OK]' || chr(10);
        moved_count := moved_count + 1;
    END LOOP;

    RETURN log_out || '=== CONCLUÍDO ===' || chr(10) || 'Total de registros alterados: ' || moved_count;
END;
$$;
