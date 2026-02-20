
-- #################################################################
-- # CURA DE DADOS: UNIFICAÇÃO DE SETORES (GLOBAL)
-- # Objetivo: Corrigir grafia antiga e vincular ID oficial
-- #################################################################

CREATE OR REPLACE FUNCTION heal_sector_global(bad_name text, target_sector_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    official_name text;
    official_unit text;
    count_studies int := 0;
    count_visits int := 0;
    count_pgs int := 0;
    count_classes int := 0;
    total_affected int := 0;
BEGIN
    -- 1. Busca os dados oficiais do setor alvo
    SELECT name, unit INTO official_name, official_unit 
    FROM pro_sectors WHERE id = target_sector_id;
    
    IF official_name IS NULL THEN
        RETURN 'Erro: Setor alvo (ID ' || target_sector_id || ') não encontrado.';
    END IF;

    -- 2. Atualiza Estudos Bíblicos
    UPDATE bible_studies
    SET sector = official_name,
        sector_id = target_sector_id
    WHERE lower(trim(sector)) = lower(trim(bad_name))
    AND unit = official_unit -- Garante que não misture unidades
    AND (sector_id IS NULL OR sector_id != target_sector_id);
    
    GET DIAGNOSTICS count_studies = ROW_COUNT;

    -- 3. Atualiza Visitas Pastorais
    UPDATE staff_visits
    SET sector = official_name,
        sector_id = target_sector_id
    WHERE lower(trim(sector)) = lower(trim(bad_name))
    AND unit = official_unit
    AND (sector_id IS NULL OR sector_id != target_sector_id);

    GET DIAGNOSTICS count_visits = ROW_COUNT;

    -- 4. Atualiza Pequenos Grupos
    UPDATE small_groups
    SET sector = official_name,
        sector_id = target_sector_id
    WHERE lower(trim(sector)) = lower(trim(bad_name))
    AND unit = official_unit
    AND (sector_id IS NULL OR sector_id != target_sector_id);

    GET DIAGNOSTICS count_pgs = ROW_COUNT;

    -- 5. Atualiza Classes Bíblicas
    UPDATE bible_classes
    SET sector = official_name,
        sector_id = target_sector_id
    WHERE lower(trim(sector)) = lower(trim(bad_name))
    AND unit = official_unit
    AND (sector_id IS NULL OR sector_id != target_sector_id);

    GET DIAGNOSTICS count_classes = ROW_COUNT;

    total_affected := count_studies + count_visits + count_pgs + count_classes;

    RETURN 'Sucesso! Setor "' || bad_name || '" unificado para "' || official_name || '" (' || official_unit || '). ' || 
           total_affected || ' registros corrigidos.';
END;
$$;
