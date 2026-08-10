-- Trava definitiva para os 2 problemas reais achados no Diagnóstico do Sistema:
--
-- 1. "34 registros com data de entrada posterior à data de saída" (28 casos reais, já
--    corrigidos). Impede qualquer INSERT/UPDATE futuro de gravar joined_at > left_at,
--    exceto o valor "sentinela" (left_at = 1ms após a época Unix) que o app usa de propósito
--    pra marcar "matrícula anulada por erro".
--
-- Antes de aplicar, os dados existentes foram corrigidos:
--   UPDATE pro_group_members SET left_at = updated_at, updated_at = now()
--     WHERE is_error = true AND left_at IS NULL;                              -- 46 linhas
--   UPDATE pro_group_members SET joined_at = left_at, updated_at = now()
--     WHERE left_at IS NOT NULL AND joined_at IS NOT NULL AND joined_at > left_at
--       AND left_at <> '1970-01-01 00:00:00.001+00';                          -- 28 linhas
ALTER TABLE public.pro_group_members
  ADD CONSTRAINT chk_joined_before_left
  CHECK (
    left_at IS NULL
    OR joined_at IS NULL
    OR left_at >= joined_at
    OR left_at < '2000-01-01'::timestamptz
  );

-- 2. "39 colaboradores com matrículas em múltiplos PGs" (causado em parte por 46 linhas com
--    is_error=true e left_at nunca preenchido, já corrigidas acima). Impede que uma matrícula
--    seja marcada como erro sem também ser fechada. Confirmado que todo lugar do código que
--    grava isError:true também grava leftAt no mesmo objeto, então nenhum fluxo legítimo é
--    afetado por essa trava.
ALTER TABLE public.pro_group_members
  ADD CONSTRAINT chk_error_requires_left_at
  CHECK (is_error IS NOT TRUE OR left_at IS NOT NULL);
