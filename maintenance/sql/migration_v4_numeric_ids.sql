
BEGIN;

-- 1. PREPARAÇÃO: Garantir que a tabela e coluna existam antes de criar Views
CREATE TABLE IF NOT EXISTS pro_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT,
    staff_id TEXT,
    joined_at BIGINT,
    left_at BIGINT
);

-- Adiciona a coluna left_at se ela não existir (Idempotente)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pro_group_members' AND column_name='left_at') THEN
        ALTER TABLE pro_group_members ADD COLUMN left_at BIGINT;
    END IF;
END $$;

-- 2. LIMPEZA: Remover Views e Constraints antigas para permitir alteração de tipo
DROP VIEW IF EXISTS bi_active_memberships;

ALTER TABLE pro_staff DROP CONSTRAINT IF EXISTS pro_staff_sector_id_fkey;
ALTER TABLE pro_groups DROP CONSTRAINT IF EXISTS pro_groups_sector_id_fkey;
ALTER TABLE pro_group_locations DROP CONSTRAINT IF EXISTS pro_group_locations_group_id_fkey;
ALTER TABLE pro_group_locations DROP CONSTRAINT IF EXISTS pro_group_locations_sector_id_fkey;
ALTER TABLE pro_group_members DROP CONSTRAINT IF EXISTS pro_group_members_group_id_fkey;
ALTER TABLE pro_group_members DROP CONSTRAINT IF EXISTS pro_group_members_staff_id_fkey;

-- 3. FUNÇÃO DE CONVERSÃO SEGURA (Texto -> Números Apenas)
CREATE OR REPLACE FUNCTION clean_to_int(val anyelement) RETURNS bigint AS $$
DECLARE
    text_val text;
    clean_val text;
BEGIN
    text_val := val::text; -- Converte qualquer input para texto primeiro
    IF text_val IS NULL OR text_val = '' THEN RETURN NULL; END IF;
    clean_val := regexp_replace(text_val, '[^0-9]', '', 'g'); -- Remove letras e símbolos
    IF clean_val = '' THEN RETURN NULL; END IF;
    RETURN clean_val::bigint;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. MIGRAÇÃO DE DADOS (TEXT -> BIGINT)

-- A) Setores
DELETE FROM pro_sectors WHERE clean_to_int(id) IS NULL;
ALTER TABLE pro_sectors ALTER COLUMN id TYPE BIGINT USING clean_to_int(id);

-- B) Staff (Colaboradores)
DELETE FROM pro_staff WHERE clean_to_int(id) IS NULL;
ALTER TABLE pro_staff 
    ALTER COLUMN id TYPE BIGINT USING clean_to_int(id),
    ALTER COLUMN sector_id TYPE BIGINT USING clean_to_int(sector_id);

-- C) Grupos (PGs)
DELETE FROM pro_groups WHERE clean_to_int(id) IS NULL;
ALTER TABLE pro_groups 
    ALTER COLUMN id TYPE BIGINT USING clean_to_int(id),
    ALTER COLUMN sector_id TYPE BIGINT USING clean_to_int(sector_id);

-- D) Vínculos de Localização (Se a tabela não existir, cria)
CREATE TABLE IF NOT EXISTS pro_group_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT,
    sector_id TEXT,
    unit TEXT,
    created_at BIGINT
);
ALTER TABLE pro_group_locations 
    ALTER COLUMN group_id TYPE BIGINT USING clean_to_int(group_id),
    ALTER COLUMN sector_id TYPE BIGINT USING clean_to_int(sector_id);

-- E) Membros de Grupo
ALTER TABLE pro_group_members 
    ALTER COLUMN group_id TYPE BIGINT USING clean_to_int(group_id),
    ALTER COLUMN staff_id TYPE BIGINT USING clean_to_int(staff_id);

-- 5. RECONSTRUÇÃO DE RELACIONAMENTOS (Foreign Keys)

ALTER TABLE pro_staff ADD CONSTRAINT pro_staff_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id);
ALTER TABLE pro_groups ADD CONSTRAINT pro_groups_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id);

ALTER TABLE pro_group_locations ADD CONSTRAINT pro_group_locations_group_id_fkey FOREIGN KEY (group_id) REFERENCES pro_groups(id) ON DELETE CASCADE;
ALTER TABLE pro_group_locations ADD CONSTRAINT pro_group_locations_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES pro_sectors(id) ON DELETE CASCADE;

ALTER TABLE pro_group_members ADD CONSTRAINT pro_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES pro_groups(id) ON DELETE CASCADE;
ALTER TABLE pro_group_members ADD CONSTRAINT pro_group_members_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES pro_staff(id) ON DELETE CASCADE;

-- 6. CRIAÇÃO DA VIEW DE B.I. (Agora com a coluna left_at garantida)
CREATE OR REPLACE VIEW bi_active_memberships AS
SELECT 
    m.id as matricula_id,
    p.name as colaborador,
    s.name as setor,
    s.unit as unidade,
    g.name as nome_pg,
    to_timestamp(m.joined_at / 1000)::date as data_entrada,
    CASE WHEN m.left_at IS NOT NULL THEN to_timestamp(m.left_at / 1000)::date ELSE NULL END as data_saida,
    CASE WHEN m.left_at IS NULL THEN 'ATIVO' ELSE 'INATIVO' END as status_atual
FROM pro_group_members m
JOIN pro_staff p ON m.staff_id = p.id
JOIN pro_groups g ON m.group_id = g.id
JOIN pro_sectors s ON g.sector_id = s.id;

COMMIT;
