
-- #################################################################
-- # RELAXAMENTO DE RESTRIÇÕES (FK DROP)
-- # Necessário para permitir IDs de Pacientes (9B) e Prestadores (8B)
-- # nas colunas staff_id que antes aceitavam apenas pro_staff.
-- #################################################################

DO $$ 
BEGIN
    -- Remove FK de Estudos
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bible_studies_staff_id_fkey') THEN
        ALTER TABLE bible_studies DROP CONSTRAINT bible_studies_staff_id_fkey;
    END IF;

    -- Remove FK de Visitas
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'staff_visits_staff_id_fkey') THEN
        ALTER TABLE staff_visits DROP CONSTRAINT staff_visits_staff_id_fkey;
    END IF;

    -- Remove FK de Participantes de Classe
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bible_class_attendees_staff_id_fkey') THEN
        ALTER TABLE bible_class_attendees DROP CONSTRAINT bible_class_attendees_staff_id_fkey;
    END IF;
    
    -- Nota: Mantemos o tipo BIGINT, mas agora sem a restrição de integridade referencial estrita
    -- Isso permite que o sistema funcione como um "Polymorphic ID" (Staff, Patient, Provider no mesmo campo)
END $$;
