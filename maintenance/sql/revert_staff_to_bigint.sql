BEGIN;

-- 1. Criar colunas temporárias BIGINT nas tabelas filhas
ALTER TABLE pro_group_members ADD COLUMN num_staff_id BIGINT;
ALTER TABLE bible_study_sessions ADD COLUMN num_staff_id BIGINT;
ALTER TABLE staff_visits ADD COLUMN num_staff_id BIGINT;
ALTER TABLE bible_class_attendees ADD COLUMN num_staff_id BIGINT;
ALTER TABLE pro_history_records ADD COLUMN num_staff_id BIGINT;

-- 2. Preencher as colunas temporárias com o registration_id do pro_staff
UPDATE pro_group_members SET num_staff_id = NULLIF(regexp_replace(s.registration_id, '\D', '', 'g'), '')::BIGINT FROM pro_staff s WHERE pro_group_members.staff_id = s.id;
UPDATE bible_study_sessions SET num_staff_id = NULLIF(regexp_replace(s.registration_id, '\D', '', 'g'), '')::BIGINT FROM pro_staff s WHERE bible_study_sessions.staff_id = s.id;
UPDATE staff_visits SET num_staff_id = NULLIF(regexp_replace(s.registration_id, '\D', '', 'g'), '')::BIGINT FROM pro_staff s WHERE staff_visits.staff_id = s.id;
UPDATE bible_class_attendees SET num_staff_id = NULLIF(regexp_replace(s.registration_id, '\D', '', 'g'), '')::BIGINT FROM pro_staff s WHERE bible_class_attendees.staff_id = s.id;
UPDATE pro_history_records SET num_staff_id = NULLIF(regexp_replace(s.registration_id, '\D', '', 'g'), '')::BIGINT FROM pro_staff s WHERE pro_history_records.staff_id = s.id;

-- 3. Remover constraints antigas
ALTER TABLE pro_group_members DROP CONSTRAINT IF EXISTS pro_group_members_staff_id_fkey;
ALTER TABLE bible_study_sessions DROP CONSTRAINT IF EXISTS bible_study_sessions_staff_id_fkey;
ALTER TABLE staff_visits DROP CONSTRAINT IF EXISTS staff_visits_staff_id_fkey;
ALTER TABLE bible_class_attendees DROP CONSTRAINT IF EXISTS bible_class_attendees_staff_id_fkey;

DROP VIEW IF EXISTS bi_active_memberships;

ALTER TABLE pro_staff DROP CONSTRAINT IF EXISTS pro_staff_pkey CASCADE;

-- 4. Substituir a coluna ID na tabela pro_staff
CREATE SEQUENCE IF NOT EXISTS temp_staff_seq START 900000;
UPDATE pro_staff SET registration_id = nextval('temp_staff_seq')::TEXT WHERE registration_id IS NULL OR registration_id = '';

ALTER TABLE pro_staff ADD COLUMN num_id BIGINT;
UPDATE pro_staff SET num_id = NULLIF(regexp_replace(registration_id, '\D', '', 'g'), '')::BIGINT;
UPDATE pro_staff SET num_id = nextval('temp_staff_seq') WHERE num_id IS NULL;

ALTER TABLE pro_staff DROP COLUMN id CASCADE;
ALTER TABLE pro_staff RENAME COLUMN num_id TO id;
ALTER TABLE pro_staff ADD PRIMARY KEY (id);

-- 5. Substituir as colunas nas tabelas filhas
ALTER TABLE pro_group_members DROP COLUMN staff_id CASCADE;
ALTER TABLE pro_group_members RENAME COLUMN num_staff_id TO staff_id;

ALTER TABLE bible_study_sessions DROP COLUMN staff_id CASCADE;
ALTER TABLE bible_study_sessions RENAME COLUMN num_staff_id TO staff_id;

ALTER TABLE staff_visits DROP COLUMN staff_id CASCADE;
ALTER TABLE staff_visits RENAME COLUMN num_staff_id TO staff_id;

ALTER TABLE bible_class_attendees DROP COLUMN staff_id CASCADE;
ALTER TABLE bible_class_attendees RENAME COLUMN num_staff_id TO staff_id;

ALTER TABLE pro_history_records DROP COLUMN staff_id CASCADE;
ALTER TABLE pro_history_records RENAME COLUMN num_staff_id TO staff_id;

-- 6. Recriar Foreign Keys
ALTER TABLE pro_group_members ADD CONSTRAINT pro_group_members_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES pro_staff(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE bible_study_sessions ADD CONSTRAINT bible_study_sessions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES pro_staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE staff_visits ADD CONSTRAINT staff_visits_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES pro_staff(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE bible_class_attendees ADD CONSTRAINT bible_class_attendees_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES pro_staff(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 7. Limpar coluna registration_id
ALTER TABLE pro_staff DROP COLUMN IF EXISTS registration_id;
ALTER TABLE pro_history_records DROP COLUMN IF EXISTS registration_id;

-- 8. Recriar View
CREATE OR REPLACE VIEW bi_active_memberships AS
SELECT 
    m.id as matricula_id,
    p.name as colaborador,
    s.name as setor,
    s.unit as unidade,
    g.name as nome_pg,
    m.joined_at::date as data_entrada,
    m.left_at::date as data_saida,
    CASE WHEN m.left_at IS NULL THEN 'ATIVO' ELSE 'INATIVO' END as status_atual
FROM pro_group_members m
JOIN pro_staff p ON m.staff_id = p.id
JOIN pro_groups g ON m.group_id = g.id
JOIN pro_sectors s ON g.sector_id = s.id;

COMMIT;
