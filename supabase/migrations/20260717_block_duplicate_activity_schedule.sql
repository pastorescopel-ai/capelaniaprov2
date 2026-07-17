-- Impede que se agende o mesmo local/dia/período de atividade mais de uma vez,
-- seja para o mesmo capelão ou para outro. A tela de agendar já bloqueia isso na
-- interface, mas a função de "Replicar Escala" não verificava nada, e é a causa
-- mais provável dos grupos de local/dia/período já duplicados hoje (alguns
-- com capelães diferentes na mesma vaga). Isto é uma rede de segurança no banco,
-- para qualquer caminho de escrita (app, replicação, etc).
CREATE OR REPLACE FUNCTION public.block_duplicate_activity_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_conflict_id uuid;
    v_conflict_user text;
    v_slot_key text;
BEGIN
    v_slot_key := CASE WHEN NEW.date IS NOT NULL THEN NEW.date::text ELSE 'dow' || NEW.day_of_week::text END;

    SELECT s.id, s.user_id::text INTO v_conflict_id, v_conflict_user
    FROM public.activity_schedules s
    WHERE s.unit = NEW.unit
      AND s.month = NEW.month
      AND s.activity_type = NEW.activity_type
      AND s.location = NEW.location
      AND coalesce(s.period,'tarde') = coalesce(NEW.period,'tarde')
      AND (CASE WHEN s.date IS NOT NULL THEN s.date::text ELSE 'dow' || s.day_of_week::text END) = v_slot_key
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
        RAISE EXCEPTION 'CONFLITO_AGENDA: já existe uma atividade agendada neste local/dia/período (registro %, colaborador %).', v_conflict_id, v_conflict_user;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_block_duplicate_activity_schedule ON public.activity_schedules;
CREATE TRIGGER trg_block_duplicate_activity_schedule
    BEFORE INSERT ON public.activity_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.block_duplicate_activity_schedule();
