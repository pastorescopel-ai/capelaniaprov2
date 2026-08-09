-- Remove o recurso de "Permissões" (delegação de autorização de edição de meses fechados)
-- por pedido do usuário: essa funcionalidade não existe mais no app. Daqui pra frente,
-- somente o ADMIN pode ajustar registros de meses anteriores (já garantido pelo
-- isRecordLocked() no código, que não dependia de nenhuma outra tabela).
DROP TABLE IF EXISTS public.edit_authorizations;
