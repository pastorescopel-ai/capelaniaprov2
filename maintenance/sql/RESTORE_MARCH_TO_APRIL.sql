-- ##########################################################################
-- # SCRIPT DE RESTAURAÇÃO: MARÇO -> ABRIL (CLONAGEM DE COMPETÊNCIA)
-- # Objetivo: Resolver a perda de dados em Abril após o "bug de setores"
-- ##########################################################################

BEGIN;

-- 1. CLONAR MEMBROS DE GRUPOS (STAFF)
-- Pegamos todos os vínculos ativos em Março que não existem em Abril
INSERT INTO pro_group_members (group_id, staff_id, cycle_month, joined_at, is_error)
SELECT group_id, staff_id, '2026-04-01', joined_at, is_error
FROM pro_group_members
WHERE cycle_month = '2026-03-01'
  AND left_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pro_group_members m2 
    WHERE m2.group_id = pro_group_members.group_id 
      AND m2.staff_id = pro_group_members.staff_id 
      AND m2.cycle_month = '2026-04-01'
  );

-- 2. CLONAR MEMBROS DE GRUPOS (PRESTADORES)
INSERT INTO pro_group_provider_members (group_id, provider_id, cycle_month, joined_at, is_error)
SELECT group_id, provider_id, '2026-04-01', joined_at, is_error
FROM pro_group_provider_members
WHERE cycle_month = '2026-03-01'
  AND left_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pro_group_provider_members m2 
    WHERE m2.group_id = pro_group_provider_members.group_id 
      AND m2.provider_id = pro_group_provider_members.provider_id 
      AND m2.cycle_month = '2026-04-01'
  );

-- 3. CLONAR EMBAIXADORES
INSERT INTO ambassadors (name, registration_id, email, sector_id, unit, completion_date, cycle_month)
SELECT name, registration_id, email, sector_id, unit, completion_date, '2026-04-01'
FROM ambassadors
WHERE cycle_month = '2026-03-01'
  AND NOT EXISTS (
    SELECT 1 FROM ambassadors a2 
    WHERE a2.registration_id = ambassadors.registration_id 
      AND a2.cycle_month = '2026-04-01'
  );

-- 4. LIMPAR ESTATÍSTICAS DE ABRIL PARA PERMITIR RE-CÁLCULO
-- O sistema irá regenerar pro_monthly_stats quando o usuário abrir o Dashboard de Abril
DELETE FROM pro_monthly_stats WHERE month = '2026-04-01';

COMMIT;

-- ORIENTAÇÃO:
-- 1. Execute este script no Supabase.
-- 2. No sistema, vá em Gestão de PGs -> Auditoria de Abril para verificar se os vínculos voltaram.
-- 3. Caso os setores ainda estejam inconsistentes, execute primeiro o FULL_RECOVERY_2026.sql.
