-- Fase 6: Padronização de IDs (Lote 1 - Cadastros PRO: Setores e Colaboradores)
-- Este script migra os IDs de BIGINT para UUID e preserva a matrícula em registration_id.

BEGIN;

-- 1. ADICIONAR COLUNAS TEMPORÁRIAS UUID
ALTER TABLE pro_sectors ADD COLUMN new_id UUID DEFAULT gen_random_uuid();
ALTER TABLE pro_staff ADD COLUMN new_id UUID DEFAULT gen_random_uuid();

-- 2. ADICIONAR COLUNAS DE REFERÊNCIA TEMPORÁRIAS NAS TABELAS FILHAS
-- Filhas de pro_sectors
ALTER TABLE pro_groups ADD COLUMN new_sector_id UUID;
ALTER TABLE pro_staff ADD COLUMN new_sector_id UUID;
ALTER TABLE bible_study_sessions ADD COLUMN new_sector_id UUID;
ALTER TABLE visit_requests ADD COLUMN new_sector_id UUID;
ALTER TABLE pro_group_locations ADD COLUMN new_sector_id UUID;
ALTER TABLE ambassadors ADD COLUMN new_sector_id UUID;
ALTER TABLE pro_history_records ADD COLUMN new_sector_id UUID;

-- Filhas de pro_staff
ALTER TABLE pro_group_members ADD COLUMN new_staff_id UUID;
ALTER TABLE bible_study_sessions ADD COLUMN new_staff_id UUID;
ALTER TABLE staff_visits ADD COLUMN new_staff_id UUID;
ALTER TABLE bible_class_attendees ADD COLUMN new_staff_id UUID;
ALTER TABLE pro_history_records ADD COLUMN new_staff_id UUID;

-- 3. PREENCHER AS COLUNAS DE REFERÊNCIA (UPDATE CASCADE MANUAL)
-- Atualizando referências de pro_sectors
UPDATE pro_groups SET new_sector_id = s.new_id FROM pro_sectors s WHERE pro_groups.sector_id::text = s.id::text;
UPDATE pro_staff SET new_sector_id = s.new_id FROM pro_sectors s WHERE pro_staff.sector_id::text = s.id::text;
UPDATE bible_study_sessions SET new_sector_id = s.new_id FROM pro_sectors s WHERE bible_study_sessions.sector_id::text = s.id::text;
UPDATE visit_requests SET new_sector_id = s.new_id FROM pro_sectors s WHERE visit_requests.sector_id::text = s.id::text;
UPDATE pro_group_locations SET new_sector_id = s.new_id FROM pro_sectors s WHERE pro_group_locations.sector_id::text = s.id::text;
UPDATE ambassadors SET new_sector_id = s.new_id FROM pro_sectors s WHERE ambassadors.sector_id::text = s.id::text;
UPDATE pro_history_records SET new_sector_id = s.new_id FROM pro_sectors s WHERE pro_history_records.sector_id::text = s.id::text;

-- Atualizando referências de pro_staff
UPDATE pro_group_members SET new_staff_id = s.new_id FROM pro_staff s WHERE pro_group_members.staff_id::text = s.id::text;
UPDATE bible_study_sessions SET new_staff_id = s.new_id FROM pro_staff s WHERE bible_study_sessions.staff_id::text = s.id::text;
UPDATE staff_visits SET new_staff_id = s.new_id FROM pro_staff s WHERE staff_visits.staff_id::text = s.id::text;
UPDATE bible_class_attendees SET new_staff_id = s.new_id FROM pro_staff s WHERE bible_class_attendees.staff_id::text = s.id::text;
UPDATE pro_history_records SET new_staff_id = s.new_id FROM pro_staff s WHERE pro_history_records.staff_id::text = s.id::text;

-- 4. REMOVER CONSTRAINTS ANTIGAS (FOREIGN KEYS E PRIMARY KEYS)
-- Foreign Keys apontando para pro_sectors
ALTER TABLE pro_groups DROP CONSTRAINT IF EXISTS pro_groups_sector_id_fkey;
ALTER TABLE pro_staff DROP CONSTRAINT IF EXISTS pro_staff_sector_id_fkey;
ALTER TABLE pro_group_locations DROP CONSTRAINT IF EXISTS pro_group_locations_sector_id_fkey;

-- Foreign Keys apontando para pro_staff
ALTER TABLE pro_group_members DROP CONSTRAINT IF EXISTS pro_group_members_staff_id_fkey;
ALTER TABLE bible_study_sessions DROP CONSTRAINT IF EXISTS bible_study_sessions_staff_id_fkey;
ALTER TABLE staff_visits DROP CONSTRAINT IF EXISTS staff_visits_staff_id_fkey;

-- Views que dependem dessas colunas (se houver, precisamos recriar depois)
DROP VIEW IF EXISTS bi_active_memberships;

-- Primary Keys
ALTER TABLE pro_sectors DROP CONSTRAINT IF EXISTS pro_sectors_pkey CASCADE;
ALTER TABLE pro_staff DROP CONSTRAINT IF EXISTS pro_staff_pkey CASCADE;

-- 5. RENOMEAR COLUNAS E DEFINIR NOVOS TIPOS
-- pro_sectors
ALTER TABLE pro_sectors DROP COLUMN id CASCADE;
ALTER TABLE pro_sectors RENAME COLUMN new_id TO id;
ALTER TABLE pro_sectors ADD PRIMARY KEY (id);

-- pro_staff (Preservar ID antigo como registration_id)
ALTER TABLE pro_staff ADD COLUMN IF NOT EXISTS registration_id TEXT;
UPDATE pro_staff SET registration_id = id::TEXT WHERE registration_id IS NULL;
ALTER TABLE pro_staff DROP COLUMN id CASCADE;
ALTER TABLE pro_staff RENAME COLUMN new_id TO id;
ALTER TABLE pro_staff ADD PRIMARY KEY (id);

-- Renomear colunas nas tabelas filhas (pro_sectors)
ALTER TABLE pro_groups DROP COLUMN sector_id CASCADE;
ALTER TABLE pro_groups RENAME COLUMN new_sector_id TO sector_id;

ALTER TABLE pro_staff DROP COLUMN sector_id CASCADE;
ALTER TABLE pro_staff RENAME COLUMN new_sector_id TO sector_id;

ALTER TABLE bible_study_sessions DROP COLUMN sector_id CASCADE;
ALTER TABLE bible_study_sessions RENAME COLUMN new_sector_id TO sector_id;

ALTER TABLE visit_requests DROP COLUMN sector_id CASCADE;
ALTER TABLE visit_requests RENAME COLUMN new_sector_id TO sector_id;

ALTER TABLE pro_group_locations DROP COLUMN sector_id CASCADE;
ALTER TABLE pro_group_locations RENAME COLUMN new_sector_id TO sector_id;

ALTER TABLE ambassadors DROP COLUMN sector_id CASCADE;
ALTER TABLE ambassadors RENAME COLUMN new_sector_id TO sector_id;

ALTER TABLE pro_history_records DROP COLUMN sector_id CASCADE;
ALTER TABLE pro_history_records RENAME COLUMN new_sector_id TO sector_id;

-- Renomear colunas nas tabelas filhas (pro_staff)
ALTER TABLE pro_group_members DROP COLUMN staff_id CASCADE;
ALTER TABLE pro_group_members RENAME COLUMN new_staff_id TO staff_id;

ALTER TABLE bible_study_sessions DROP COLUMN staff_id CASCADE;
ALTER TABLE bible_study_sessions RENAME COLUMN new_staff_id TO staff_id;

ALTER TABLE staff_visits DROP COLUMN staff_id CASCADE;
ALTER TABLE staff_visits RENAME COLUMN new_staff_id TO staff_id;

ALTER TABLE bible_class_attendees DROP COLUMN staff_id CASCADE;
ALTER TABLE bible_class_attendees RENAME COLUMN new_staff_id TO staff_id;

ALTER TABLE pro_history_records DROP COLUMN staff_id CASCADE;
ALTER TABLE pro_history_records RENAME COLUMN new_staff_id TO staff_id;

-- 6. RECRIAR FOREIGN KEYS
ALTER TABLE pro_groups ADD CONSTRAINT pro_groups_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON DELETE SET NULL;
ALTER TABLE pro_staff ADD CONSTRAINT pro_staff_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON DELETE SET NULL;
ALTER TABLE pro_group_locations ADD CONSTRAINT pro_group_locations_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON DELETE CASCADE;

ALTER TABLE pro_group_members ADD CONSTRAINT pro_group_members_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES pro_staff(id) ON DELETE CASCADE;
-- (As outras tabelas podem não precisar de FK estrita se os registros puderem existir sem o staff/sector, mas é boa prática)

-- 7. RECRIAR VIEW
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
