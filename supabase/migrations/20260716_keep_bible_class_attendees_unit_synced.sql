-- Impede que bible_class_attendees.unit fique dessincronizado de bible_classes.unit
-- (bug que causou "58 vs 47 alunos" no card de Relatórios de junho/2026: presenças
-- antigas mantinham a unidade errada depois que a classe foi corrigida de unidade).
--
-- Gatilho 1: ao inserir/atualizar uma presença, a unidade é sempre herdada da classe
-- (ignora o que a aplicação mandar em `unit` — a classe é a fonte da verdade).
CREATE OR REPLACE FUNCTION public.sync_attendee_unit_from_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_class_unit text;
BEGIN
    SELECT unit INTO v_class_unit FROM public.bible_classes WHERE id = NEW.class_id;
    IF v_class_unit IS NOT NULL THEN
        NEW.unit := v_class_unit;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_attendee_unit_from_class ON public.bible_class_attendees;
CREATE TRIGGER trg_sync_attendee_unit_from_class
    BEFORE INSERT OR UPDATE OF class_id ON public.bible_class_attendees
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_attendee_unit_from_class();

-- Gatilho 2: se a unidade de uma classe for corrigida depois (ex: cadastro errado
-- ajustado de HABA para HAB), propaga a mudança para todas as presenças já lançadas
-- daquela classe, em vez de deixá-las com a unidade antiga.
CREATE OR REPLACE FUNCTION public.cascade_class_unit_to_attendees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.unit IS DISTINCT FROM OLD.unit THEN
        UPDATE public.bible_class_attendees
        SET unit = NEW.unit, updated_at = now()
        WHERE class_id = NEW.id AND unit IS DISTINCT FROM NEW.unit;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cascade_class_unit_to_attendees ON public.bible_classes;
CREATE TRIGGER trg_cascade_class_unit_to_attendees
    AFTER UPDATE OF unit ON public.bible_classes
    FOR EACH ROW
    EXECUTE FUNCTION public.cascade_class_unit_to_attendees();
