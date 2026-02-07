
-- ##########################################################################
-- # FUNÇÃO DE FUSÃO MANUAL DE PGs (MERGE TOOL)
-- #
-- # INSTRUÇÕES:
-- # 1. Copie este código.
-- # 2. Cole no SQL Editor do Supabase.
-- # 3. Execute (Run).
-- ##########################################################################

CREATE OR REPLACE FUNCTION merge_pro_group(old_id text, new_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    old_exists boolean;
    new_exists boolean;
    old_name text;
    old_leader text;
    old_sector text;
    old_unit text;
    move_count int := 0;
BEGIN
    -- 1. Verificar existências
    SELECT EXISTS(SELECT 1 FROM pro_groups WHERE id = old_id) INTO old_exists;
    IF NOT old_exists THEN
        RETURN 'Erro: PG de origem (' || old_id || ') não encontrado.';
    END IF;

    SELECT EXISTS(SELECT 1 FROM pro_groups WHERE id = new_id) INTO new_exists;

    -- 2. Se o destino não existe, cria ele copiando os dados da origem
    IF NOT new_exists THEN
        SELECT name, current_leader, sector_id, unit INTO old_name, old_leader, old_sector, old_unit
        FROM pro_groups WHERE id = old_id;

        INSERT INTO pro_groups (id, name, current_leader, sector_id, unit, active, updated_at)
        VALUES (new_id, old_name, old_leader, old_sector, old_unit, true, (extract(epoch from now()) * 1000));
    END IF;

    -- 3. Gerenciar Conflitos de Vínculos (pro_group_locations)
    -- Se o PG "105" já atende a UTI, e o "HAB-105" também atende a UTI,
    -- deletamos o vínculo do "HAB-105" pois ele seria duplicado.
    DELETE FROM pro_group_locations
    WHERE group_id = old_id
    AND sector_id IN (SELECT sector_id FROM pro_group_locations WHERE group_id = new_id);

    -- 4. Mover vínculos restantes
    -- Os vínculos que o "HAB-105" tinha que o "105" NÃO tinha são transferidos.
    UPDATE pro_group_locations
    SET group_id = new_id
    WHERE group_id = old_id;
    
    GET DIAGNOSTICS move_count = ROW_COUNT;

    -- 5. Apagar o PG antigo
    DELETE FROM pro_groups WHERE id = old_id;

    IF new_exists THEN
        RETURN 'Fusão realizada: Vínculos transferidos para PG existente ' || new_id || '.';
    ELSE
        RETURN 'Migração realizada: Novo PG ' || new_id || ' criado e vínculos transferidos.';
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN 'Erro Crítico no Banco: ' || SQLERRM;
END;
$$;
