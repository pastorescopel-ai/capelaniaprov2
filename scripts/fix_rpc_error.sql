
-- ##########################################################################
-- # CORREÇÃO DEFINITIVA: 42883 + PERMISSÕES + LOGS DETALHADOS
-- # ESCOPO: Apenas tabela pro_groups
-- #
-- # INSTRUÇÕES: 
-- # 1. Copie este código.
-- # 2. Cole no SQL Editor do Supabase.
-- # 3. Execute (Run).
-- # 4. Volte ao App e clique em "Limpar Prefixos" novamente.
-- ##########################################################################

CREATE OR REPLACE FUNCTION unify_ids_total()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com permissões de admin (ignora RLS)
SET search_path = public -- Segurança contra search_path hijacking
AS $$
DECLARE
    r RECORD;
    target_id text;
    moved_count int := 0;
    log_out text := '';
    found_count int := 0;
BEGIN
    log_out := '=== INÍCIO DO DIAGNÓSTICO ===' || chr(10);
    
    -- Contagem inicial para verificar se o Regex está funcionando
    SELECT count(*) INTO found_count FROM pro_groups WHERE id::text ~* '^(HAB|HABA)[-\s]+[0-9]+';
    log_out := log_out || 'Registros encontrados com prefixo: ' || found_count || chr(10);

    IF found_count = 0 THEN
        RETURN log_out || 'Nenhum PG precisando de limpeza foi encontrado.';
    END IF;

    FOR r IN SELECT * FROM pro_groups WHERE id::text ~* '^(HAB|HABA)[-\s]+[0-9]+' LOOP
        
        -- Extrai apenas os números (ex: HAB-105 -> 105)
        target_id := regexp_replace(r.id::text, '^(HAB|HABA)[-\s]*', '', 'i');
        target_id := trim(target_id); -- Remove espaços extras
        
        log_out := log_out || '> Processando [' || r.id || '] -> Alvo: [' || target_id || ']';

        -- Validações de Segurança
        IF target_id = '' OR target_id IS NULL THEN
            log_out := log_out || ' ... PULEI (ID vazio)' || chr(10);
            CONTINUE; 
        END IF;

        IF target_id = r.id::text THEN
            log_out := log_out || ' ... PULEI (ID idêntico)' || chr(10);
            CONTINUE;
        END IF;

        -- Lógica de Fusão ou Renomeação
        IF EXISTS (SELECT 1 FROM pro_groups WHERE id::text = target_id) THEN
            -- CENÁRIO A: FUSÃO (O PG "105" já existe)
            log_out := log_out || ' ... FUSÃO detectada.';
            
            -- 1. Limpa vínculos duplicados (evita erro de unique constraint)
            DELETE FROM pro_group_locations 
            WHERE group_id = r.id 
            AND sector_id IN (SELECT sector_id FROM pro_group_locations WHERE group_id = target_id);
            
            -- 2. Move os vínculos restantes
            UPDATE pro_group_locations SET group_id = target_id WHERE group_id = r.id;
            
            -- 3. Remove o PG antigo
            DELETE FROM pro_groups WHERE id = r.id;
            
        ELSE
            -- CENÁRIO B: MIGRAÇÃO (O PG "105" não existe)
            log_out := log_out || ' ... MIGRAÇÃO (Criando novo).';
            
            -- 1. Cria o novo PG "105"
            INSERT INTO pro_groups (id, name, current_leader, sector_id, unit, active, updated_at)
            VALUES (target_id, r.name, r.current_leader, r.sector_id, r.unit, r.active, r.updated_at);
            
            -- 2. Move todos os vínculos
            UPDATE pro_group_locations SET group_id = target_id WHERE group_id = r.id;
            
            -- 3. Remove o PG antigo
            DELETE FROM pro_groups WHERE id = r.id;
        END IF;
        
        log_out := log_out || ' [OK]' || chr(10);
        moved_count := moved_count + 1;
    END LOOP;

    RETURN log_out || '=== CONCLUÍDO ===' || chr(10) || 'Total de registros alterados: ' || moved_count;

EXCEPTION WHEN OTHERS THEN
    -- Captura qualquer erro SQL e retorna no log para você ver na tela
    RETURN log_out || chr(10) || '!!! ERRO FATAL NO BANCO !!!' || chr(10) || SQLERRM || chr(10) || 'Detalhe: ' || SQLSTATE;
END;
$$;
