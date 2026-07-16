-- Bloqueia gravar um registro (presença de classe, estudo individual, matrícula em PG)
-- vinculado a um colaborador oficial (staff_id) numa unidade diferente da unidade
-- cadastrada dele no RH (pro_staff.unit). Isso é o que causou 9 classes bíblicas
-- gravadas como HAB tendo só colaboradores HABA (toggle de unidade errado no form).
-- Registros sem staff_id vinculado (paciente/prestador/nome legado) não são afetados.

-- 1) Presenças de Classe Bíblica: valida contra o staff, senão herda da classe.
CREATE OR REPLACE FUNCTION public.sync_attendee_unit_from_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_class_unit text;
    v_staff_unit text;
    v_staff_name text;
BEGIN
    SELECT unit INTO v_class_unit FROM public.bible_classes WHERE id = NEW.class_id;

    IF NEW.staff_id IS NOT NULL THEN
        SELECT unit, name INTO v_staff_unit, v_staff_name FROM public.pro_staff WHERE id = NEW.staff_id;
        IF v_staff_unit IS NOT NULL AND v_class_unit IS NOT NULL AND v_staff_unit <> v_class_unit THEN
            RAISE EXCEPTION 'BLOQUEIO_UNIDADE: % é colaborador(a) da unidade % e não pode ser registrado(a) numa classe da unidade %.', v_staff_name, v_staff_unit, v_class_unit;
        END IF;
    END IF;

    IF v_class_unit IS NOT NULL THEN
        NEW.unit := v_class_unit;
    END IF;
    RETURN NEW;
END;
$function$;

-- 2) Estudos Bíblicos Individuais
CREATE OR REPLACE FUNCTION public.block_study_unit_mismatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_staff_unit text;
    v_staff_name text;
BEGIN
    IF NEW.staff_id IS NOT NULL THEN
        SELECT unit, name INTO v_staff_unit, v_staff_name FROM public.pro_staff WHERE id = NEW.staff_id;
        IF v_staff_unit IS NOT NULL AND NEW.unit IS NOT NULL AND v_staff_unit <> NEW.unit THEN
            RAISE EXCEPTION 'BLOQUEIO_UNIDADE: % é colaborador(a) da unidade % e não pode ter um estudo bíblico registrado na unidade %.', v_staff_name, v_staff_unit, NEW.unit;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_block_study_unit_mismatch ON public.bible_study_sessions;
CREATE TRIGGER trg_block_study_unit_mismatch
    BEFORE INSERT OR UPDATE OF staff_id, unit ON public.bible_study_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.block_study_unit_mismatch();

-- 3) Matrícula em PG (pro_group_members): valida contra a unidade do PG de destino
CREATE OR REPLACE FUNCTION public.block_group_member_unit_mismatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_group_unit text;
    v_staff_unit text;
    v_staff_name text;
BEGIN
    SELECT unit INTO v_group_unit FROM public.pro_groups WHERE id = NEW.group_id;
    IF NEW.staff_id IS NOT NULL AND v_group_unit IS NOT NULL THEN
        SELECT unit, name INTO v_staff_unit, v_staff_name FROM public.pro_staff WHERE id = NEW.staff_id;
        IF v_staff_unit IS NOT NULL AND v_staff_unit <> v_group_unit THEN
            RAISE EXCEPTION 'BLOQUEIO_UNIDADE: % é colaborador(a) da unidade % e não pode ser matriculado(a) num PG da unidade %.', v_staff_name, v_staff_unit, v_group_unit;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_block_group_member_unit_mismatch ON public.pro_group_members;
CREATE TRIGGER trg_block_group_member_unit_mismatch
    BEFORE INSERT OR UPDATE OF group_id, staff_id ON public.pro_group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.block_group_member_unit_mismatch();
