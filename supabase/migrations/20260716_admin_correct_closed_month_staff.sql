-- Corrige o setor/PG de UM colaborador em um mês já fechado, sem reabrir o mês inteiro.
-- Ajusta apenas: o registro histórico do colaborador, os setores antigo/novo (headcount),
-- os PGs pertencentes a esses dois setores (denominador da % é o headcount do setor) e,
-- se o PG também mudou, os participantes do PG antigo/novo e active_groups do resumo global.
-- Todos os demais colaboradores/setores/PGs do mês permanecem intactos.
CREATE OR REPLACE FUNCTION public.admin_correct_closed_month_staff(
    p_month date,
    p_unit text,
    p_staff_id bigint,
    p_new_sector_id bigint,
    p_new_group_id bigint DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_history public.pro_history_records%ROWTYPE;
    v_old_sector_id bigint;
    v_old_group_id bigint;
    v_new_sector_name text;
    v_new_group_name text;
    v_new_group_leader text;
    v_new_group_sector bigint;
    v_old_group_participants int;
    v_new_group_participants int;
BEGIN
    SELECT * INTO v_history FROM public.pro_history_records
    WHERE month = p_month AND unit = p_unit AND staff_id = p_staff_id
    ORDER BY updated_at DESC LIMIT 1;

    IF NOT FOUND THEN
        RETURN 'Erro: nenhum registro de histórico encontrado para este colaborador neste mês/unidade.';
    END IF;

    IF v_history.is_enrolled IS NOT TRUE THEN
        RETURN 'Erro: esta ferramenta corrige apenas colaboradores que já estavam matriculados em um PG naquele mês.';
    END IF;

    SELECT name INTO v_new_sector_name FROM public.pro_sectors WHERE id = p_new_sector_id AND unit = p_unit;
    IF v_new_sector_name IS NULL THEN
        RETURN 'Erro: setor de destino não encontrado nesta unidade.';
    END IF;

    v_old_sector_id := v_history.sector_id;
    v_old_group_id := v_history.group_id;

    IF p_new_group_id IS NOT NULL THEN
        SELECT name, current_leader, sector_id INTO v_new_group_name, v_new_group_leader, v_new_group_sector
        FROM public.pro_groups WHERE id = p_new_group_id AND unit = p_unit;
        IF v_new_group_name IS NULL THEN
            RETURN 'Erro: PG de destino não encontrado nesta unidade.';
        END IF;
    END IF;

    -- 1. Corrige o registro histórico do colaborador (não recalcula o mês inteiro, só este registro)
    UPDATE public.pro_history_records
    SET sector_id = p_new_sector_id,
        sector_name = v_new_sector_name,
        group_id = COALESCE(p_new_group_id, group_id),
        group_name = CASE WHEN p_new_group_id IS NOT NULL THEN v_new_group_name ELSE group_name END,
        leader_name = CASE WHEN p_new_group_id IS NOT NULL THEN v_new_group_leader ELSE leader_name END,
        updated_at = now()
    WHERE id = v_history.id;

    -- 2. Setor antigo: -1 no headcount, e os PGs desse setor perdem 1 no denominador
    IF v_old_sector_id IS NOT NULL AND v_old_sector_id <> p_new_sector_id THEN
        UPDATE public.pro_monthly_stats
        SET total_staff = GREATEST(total_staff - 1, 0), updated_at = now()
        WHERE month = p_month AND unit = p_unit AND type = 'sector' AND target_id = v_old_sector_id::text;

        UPDATE public.pro_monthly_stats
        SET percentage = CASE WHEN total_staff > 0 THEN round((total_participants::numeric / total_staff) * 100, 2) ELSE 0 END
        WHERE month = p_month AND unit = p_unit AND type = 'sector' AND target_id = v_old_sector_id::text;

        UPDATE public.pro_monthly_stats pms
        SET total_staff = GREATEST(pms.total_staff - 1, 0), updated_at = now()
        FROM public.pro_groups g
        WHERE pms.month = p_month AND pms.unit = p_unit AND pms.type = 'pg'
          AND pms.target_id = g.id::text AND g.sector_id = v_old_sector_id;

        UPDATE public.pro_monthly_stats pms
        SET percentage = CASE WHEN pms.total_staff > 0 THEN round((pms.total_participants::numeric / pms.total_staff) * 100, 2) ELSE 0 END
        FROM public.pro_groups g
        WHERE pms.month = p_month AND pms.unit = p_unit AND pms.type = 'pg'
          AND pms.target_id = g.id::text AND g.sector_id = v_old_sector_id;
    END IF;

    -- 3. Setor novo: +1 no headcount, e os PGs desse setor ganham 1 no denominador
    IF v_old_sector_id IS DISTINCT FROM p_new_sector_id THEN
        UPDATE public.pro_monthly_stats
        SET total_staff = total_staff + 1, updated_at = now()
        WHERE month = p_month AND unit = p_unit AND type = 'sector' AND target_id = p_new_sector_id::text;

        UPDATE public.pro_monthly_stats
        SET percentage = CASE WHEN total_staff > 0 THEN round((total_participants::numeric / total_staff) * 100, 2) ELSE 0 END
        WHERE month = p_month AND unit = p_unit AND type = 'sector' AND target_id = p_new_sector_id::text;

        UPDATE public.pro_monthly_stats pms
        SET total_staff = pms.total_staff + 1, updated_at = now()
        FROM public.pro_groups g
        WHERE pms.month = p_month AND pms.unit = p_unit AND pms.type = 'pg'
          AND pms.target_id = g.id::text AND g.sector_id = p_new_sector_id;

        UPDATE public.pro_monthly_stats pms
        SET percentage = CASE WHEN pms.total_staff > 0 THEN round((pms.total_participants::numeric / pms.total_staff) * 100, 2) ELSE 0 END
        FROM public.pro_groups g
        WHERE pms.month = p_month AND pms.unit = p_unit AND pms.type = 'pg'
          AND pms.target_id = g.id::text AND g.sector_id = p_new_sector_id;
    END IF;

    -- 4. Se o PG também mudou: ajusta o número de participantes do PG antigo e do novo
    IF p_new_group_id IS NOT NULL AND v_old_group_id IS DISTINCT FROM p_new_group_id THEN
        IF v_old_group_id IS NOT NULL THEN
            UPDATE public.pro_monthly_stats
            SET total_participants = GREATEST(total_participants - 1, 0), updated_at = now()
            WHERE month = p_month AND unit = p_unit AND type = 'pg' AND target_id = v_old_group_id::text;

            UPDATE public.pro_monthly_stats
            SET percentage = CASE WHEN total_staff > 0 THEN round((total_participants::numeric / total_staff) * 100, 2) ELSE 0 END
            WHERE month = p_month AND unit = p_unit AND type = 'pg' AND target_id = v_old_group_id::text
            RETURNING total_participants INTO v_old_group_participants;
        END IF;

        UPDATE public.pro_monthly_stats
        SET total_participants = total_participants + 1, updated_at = now()
        WHERE month = p_month AND unit = p_unit AND type = 'pg' AND target_id = p_new_group_id::text;

        UPDATE public.pro_monthly_stats
        SET percentage = CASE WHEN total_staff > 0 THEN round((total_participants::numeric / total_staff) * 100, 2) ELSE 0 END
        WHERE month = p_month AND unit = p_unit AND type = 'pg' AND target_id = p_new_group_id::text
        RETURNING total_participants INTO v_new_group_participants;

        IF v_old_group_participants = 0 THEN
            UPDATE public.pro_monthly_stats
            SET active_groups = GREATEST(active_groups - 1, 0), updated_at = now()
            WHERE month = p_month AND unit = p_unit AND type = 'pg' AND target_id = 'all';
        END IF;
        IF v_new_group_participants = 1 THEN
            UPDATE public.pro_monthly_stats
            SET active_groups = active_groups + 1, updated_at = now()
            WHERE month = p_month AND unit = p_unit AND type = 'pg' AND target_id = 'all';
        END IF;
    END IF;

    RETURN 'Sucesso! Registro de ' || v_history.staff_name || ' corrigido para setor ' || v_new_sector_name || COALESCE(' / PG ' || v_new_group_name, '') || ' em ' || to_char(p_month, 'MM/YYYY') || '.';
EXCEPTION WHEN OTHERS THEN
    RETURN 'Erro: ' || SQLERRM;
END;
$function$;
