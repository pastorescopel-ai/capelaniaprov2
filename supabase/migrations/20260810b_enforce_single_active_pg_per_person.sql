-- Regra de negócio confirmada pelo usuário: uma pessoa (colaborador ou prestador) só pode ter
-- UMA matrícula de PG aberta por vez. Quando ela muda de PG, o PG mais novo (mais recente) deve
-- prevalecer e o antigo deve ser fechado. Até aqui a trava só impedia duas matrículas na MESMA
-- PG; havia 3 colaboradores com matrícula aberta em PGs DIFERENTES simultaneamente (transferência
-- cujo PG antigo nunca foi fechado): Cristiane Costa da Cruz (SUPERAÇÃO -> BARUQUE), Geibson
-- Moreira Mafra Farias (FIDELIDADE -> ALEGRIA), Monica Cristina Peixoto Ferreira
-- (ANJOS_DA_NOITE -> DEUS_É_CONOSCO).

-- 1. Fecha a matrícula mais antiga de cada pessoa com mais de um PG ativo, mantendo só a mais
--    recente (por joined_at, com created_at como desempate).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY staff_id
           ORDER BY joined_at DESC NULLS LAST, created_at DESC NULLS LAST
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
           PARTITION BY provider_id
           ORDER BY joined_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.pro_group_provider_members
  WHERE left_at IS NULL AND is_error IS NOT TRUE
)
UPDATE public.pro_group_provider_members m
SET is_error = true, left_at = now(), updated_at = now()
FROM ranked r
WHERE m.id = r.id AND r.rn > 1;

-- 2. Substitui a trava anterior (só impedia duplicata na MESMA PG) por uma mais forte: no
--    máximo UMA matrícula aberta por pessoa, em qualquer PG.
DROP INDEX IF EXISTS public.uq_pro_group_members_open_staff_per_group;
DROP INDEX IF EXISTS public.uq_pro_group_provider_members_open_provider_per_group;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_group_members_one_open_pg_per_staff
  ON public.pro_group_members (staff_id)
  WHERE left_at IS NULL AND is_error IS NOT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_group_provider_members_one_open_pg_per_provider
  ON public.pro_group_provider_members (provider_id)
  WHERE left_at IS NULL AND is_error IS NOT TRUE;
