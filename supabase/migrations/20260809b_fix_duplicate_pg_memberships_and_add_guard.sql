-- Corrige o bug de matrícula duplicada de colaborador no mesmo PG (raiz: AdminLists.tsx
-- reconhecia matrícula existente só olhando o mês sendo importado, então uma matrícula
-- ainda aberta de um ciclo anterior nunca fechado passava despercebida e uma segunda
-- linha era criada a cada nova planilha importada). O código já foi corrigido; aqui
-- resolvemos as duplicatas que já existem e travamos o banco pra nunca mais acontecer.

-- 1. Fecha (soft-close) as matrículas duplicadas, mantendo a mais antiga por pessoa+PG
--    (mesmo critério do botão "Resolver Tudo" da Auditoria de Qualidade).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY group_id, staff_id
           ORDER BY joined_at ASC NULLS LAST, created_at ASC NULLS LAST
         ) AS rn
  FROM public.pro_group_members
  WHERE left_at IS NULL AND is_error = false
)
UPDATE public.pro_group_members m
SET is_error = true, left_at = now(), updated_at = now()
FROM ranked r
WHERE m.id = r.id AND r.rn > 1;

-- 2. Trava de segurança: nunca mais permite duas matrículas abertas (left_at nulo, sem
--    erro) pra mesma pessoa no mesmo PG, nem para colaboradores nem para prestadores.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_group_members_open_staff_per_group
  ON public.pro_group_members (group_id, staff_id)
  WHERE left_at IS NULL AND is_error = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_group_provider_members_open_provider_per_group
  ON public.pro_group_provider_members (group_id, provider_id)
  WHERE left_at IS NULL AND is_error = false;
