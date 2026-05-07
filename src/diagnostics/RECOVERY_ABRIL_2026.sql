
-- ============================================================================
-- SCRIPT DE RECUPERAÇÃO - CRISE DE ABRIL/2026
-- Objetivo: Restaurar vínculos e corrigir integridade após importação falha
-- ============================================================================

BEGIN;

-- 1. REATIVAR COLABORADORES QUE FORAM DESATIVADOS INDEVIDAMENTE
-- (Aqueles que estavam ativos em Março mas o Sync de Abril não encontrou por erro de ID/Setor)
UPDATE public.pro_staff
SET active = true, left_at = NULL, updated_at = NOW()
WHERE left_at >= '2026-03-30' AND left_at <= '2026-04-05'
AND active = false;

-- 2. RESTAURAR MATRÍCULAS EM PGs QUE FORAM FECHADAS PELO SYNC
-- Se o colaborador voltou a ficar ativo (ou nunca deveria ter saído), removemos a data de saída do PG
UPDATE public.pro_group_members
SET left_at = NULL, updated_at = NOW()
FROM public.pro_staff s
WHERE public.pro_group_members.staff_id = s.id
AND s.active = true
AND public.pro_group_members.left_at >= '2026-03-30' 
AND public.pro_group_members.left_at <= '2026-04-05';

-- 3. UNIFICAÇÃO DE SETORES COM FUNÇÕES NATIVAS (REVERSÃO DE ERRO 42883)
WITH setor_correto AS (
    SELECT id, name, unit FROM public.pro_sectors WHERE active = true
)
UPDATE public.pro_staff s
SET sector_id = sc.id
FROM setor_correto sc
WHERE (s.sector_id::text = sc.id::text) 
   OR (
       -- Fallback: Compara nomes limpando espaços e ignorando maiúsculas/minúsculas
       lower(trim(s.sector_id::text)) = lower(trim(sc.name))
   )
OR EXISTS (
    SELECT 1 FROM public.pro_sectors old 
    WHERE old.id = s.sector_id 
    AND lower(trim(old.name)) = lower(trim(sc.name))
    AND old.id <> sc.id
);

COMMIT;
