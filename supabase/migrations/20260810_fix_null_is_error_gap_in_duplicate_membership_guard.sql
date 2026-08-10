-- Correção da correção anterior (20260809b): o filtro usava "is_error = false", mas várias
-- linhas antigas (geradas pelo bug original em AdminLists.tsx, que não enviava isError e o
-- valor chegava como NULL em vez de false) tinham is_error = NULL. Em SQL, "NULL = false" não
-- é verdadeiro, então essas linhas escaparam da limpeza anterior E do índice único (a Auditoria
-- de Qualidade continuou mostrando gente com duas matrículas abertas no mesmo PG). A regra
-- certa é "is_error IS NOT TRUE" (cobre false E null como "sem erro"), que é exatamente como o
-- detector da Auditoria (useHealerCalculations.ts) já testa isso em JS: `if (m.isError) return;`

-- 1. Remove os índices com o filtro incompleto.
DROP INDEX IF EXISTS public.uq_pro_group_members_open_staff_per_group;
DROP INDEX IF EXISTS public.uq_pro_group_provider_members_open_provider_per_group;

-- 2. Fecha (soft-close) as duplicatas que escaparam da limpeza anterior por causa do NULL,
--    mantendo a mais antiga por pessoa+PG.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY group_id, staff_id
           ORDER BY joined_at ASC NULLS LAST, created_at ASC NULLS LAST
         ) AS rn
  FROM public.pro_group_members
  WHERE left_at IS NULL AND is_error IS NOT TRUE
)
UPDATE public.pro_group_members m
SET is_error = true, left_at = now(), updated_at = now()
FROM ranked r
WHERE m.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY group_id, provider_id
           ORDER BY joined_at ASC NULLS LAST, created_at ASC NULLS LAST
         ) AS rn
  FROM public.pro_group_provider_members
  WHERE left_at IS NULL AND is_error IS NOT TRUE
)
UPDATE public.pro_group_provider_members m
SET is_error = true, left_at = now(), updated_at = now()
FROM ranked r
WHERE m.id = r.id AND r.rn > 1;

-- 3. Recria os índices com o filtro correto, cobrindo NULL e false igualmente como "sem erro".
CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_group_members_open_staff_per_group
  ON public.pro_group_members (group_id, staff_id)
  WHERE left_at IS NULL AND is_error IS NOT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_group_provider_members_open_provider_per_group
  ON public.pro_group_provider_members (group_id, provider_id)
  WHERE left_at IS NULL AND is_error IS NOT TRUE;
