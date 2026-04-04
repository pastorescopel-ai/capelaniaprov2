-- Fase 5: Limpeza e Clareza Semântica
-- Este script realiza a limpeza de tabelas obsoletas e melhora a nomenclatura
-- de tabelas para refletir melhor seu propósito no sistema.

-- 1. Soft Delete da tabela obsoleta 'bible_studies'
-- Renomeamos para zz_deleted_ para manter como backup caso algum script legado precise,
-- mas tiramos do caminho principal.
ALTER TABLE IF EXISTS bible_studies RENAME TO zz_deleted_bible_studies;

-- 2. Renomear 'small_groups' para 'small_group_sessions'
-- Isso deixa claro que a tabela armazena o histórico de reuniões (sessões),
-- diferenciando-a da tabela 'pro_groups' que é o cadastro mestre dos grupos.
ALTER TABLE IF EXISTS small_groups RENAME TO small_group_sessions;
