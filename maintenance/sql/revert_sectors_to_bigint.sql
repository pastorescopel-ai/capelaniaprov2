BEGIN;

-- 1. Criar colunas temporárias BIGINT
ALTER TABLE pro_sectors ADD COLUMN num_id BIGINT;
ALTER TABLE pro_groups ADD COLUMN num_sector_id BIGINT;
ALTER TABLE pro_staff ADD COLUMN num_sector_id BIGINT;
ALTER TABLE bible_study_sessions ADD COLUMN num_sector_id BIGINT;
ALTER TABLE visit_requests ADD COLUMN num_sector_id BIGINT;
ALTER TABLE pro_group_locations ADD COLUMN num_sector_id BIGINT;
ALTER TABLE ambassadors ADD COLUMN num_sector_id BIGINT;
ALTER TABLE pro_history_records ADD COLUMN num_sector_id BIGINT;

-- 2. Extrair o número do setor a partir do nome
UPDATE pro_sectors
SET num_id = NULLIF(regexp_replace(name, '\D', '', 'g'), '')::BIGINT
WHERE name ILIKE '%Setor%';

-- Se houver setores sem número no nome, eles ficarão com num_id NULL.
-- Para evitar erro de Primary Key, podemos gerar um número alto para eles temporariamente,
-- ou o usuário pode reimportar a planilha depois.
CREATE SEQUENCE IF NOT EXISTS temp_sector_seq START 9000;
UPDATE pro_sectors SET num_id = nextval('temp_sector_seq') WHERE num_id IS NULL;

-- 3. Atualizar as tabelas filhas com o novo num_id
UPDATE pro_groups SET num_sector_id = s.num_id FROM pro_sectors s WHERE pro_groups.sector_id = s.id;
UPDATE pro_staff SET num_sector_id = s.num_id FROM pro_sectors s WHERE pro_staff.sector_id = s.id;
UPDATE bible_study_sessions SET num_sector_id = s.num_id FROM pro_sectors s WHERE bible_study_sessions.sector_id = s.id;
UPDATE visit_requests SET num_sector_id = s.num_id FROM pro_sectors s WHERE visit_requests.sector_id = s.id;
UPDATE pro_group_locations SET num_sector_id = s.num_id FROM pro_sectors s WHERE pro_group_locations.sector_id = s.id;
UPDATE ambassadors SET num_sector_id = s.num_id FROM pro_sectors s WHERE ambassadors.sector_id = s.id;
UPDATE pro_history_records SET num_sector_id = s.num_id FROM pro_sectors s WHERE pro_history_records.sector_id = s.id;

-- 4. Remover constraints antigas
ALTER TABLE pro_groups DROP CONSTRAINT IF EXISTS pro_groups_sector_id_fkey;
ALTER TABLE pro_staff DROP CONSTRAINT IF EXISTS pro_staff_sector_id_fkey;
ALTER TABLE pro_group_locations DROP CONSTRAINT IF EXISTS pro_group_locations_sector_id_fkey;
ALTER TABLE pro_sectors DROP CONSTRAINT IF EXISTS pro_sectors_pkey CASCADE;

DROP VIEW IF EXISTS bi_active_memberships;

-- 5. Substituir as colunas
ALTER TABLE pro_sectors DROP COLUMN id CASCADE;
ALTER TABLE pro_sectors RENAME COLUMN num_id TO id;
ALTER TABLE pro_sectors ADD PRIMARY KEY (id);

ALTER TABLE pro_groups DROP COLUMN sector_id CASCADE;
ALTER TABLE pro_groups RENAME COLUMN num_sector_id TO sector_id;

ALTER TABLE pro_staff DROP COLUMN sector_id CASCADE;
ALTER TABLE pro_staff RENAME COLUMN num_sector_id TO sector_id;

ALTER TABLE bible_study_sessions DROP COLUMN sector_id CASCADE;
ALTER TABLE bible_study_sessions RENAME COLUMN num_sector_id TO sector_id;

ALTER TABLE visit_requests DROP COLUMN sector_id CASCADE;
ALTER TABLE visit_requests RENAME COLUMN num_sector_id TO sector_id;

ALTER TABLE pro_group_locations DROP COLUMN sector_id CASCADE;
ALTER TABLE pro_group_locations RENAME COLUMN num_sector_id TO sector_id;

ALTER TABLE ambassadors DROP COLUMN sector_id CASCADE;
ALTER TABLE ambassadors RENAME COLUMN num_sector_id TO sector_id;

ALTER TABLE pro_history_records DROP COLUMN sector_id CASCADE;
ALTER TABLE pro_history_records RENAME COLUMN num_sector_id TO sector_id;

-- 6. Recriar Foreign Keys
ALTER TABLE pro_groups ADD CONSTRAINT pro_groups_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON DELETE SET NULL;
ALTER TABLE pro_staff ADD CONSTRAINT pro_staff_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON DELETE SET NULL;
ALTER TABLE pro_group_locations ADD CONSTRAINT pro_group_locations_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON DELETE CASCADE;

-- 7. Recriar View
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
