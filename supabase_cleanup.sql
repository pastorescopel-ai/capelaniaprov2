
-- #################################################################
-- # LIMPEZA FINAL - CAPELANIA PRO V4
-- # CUIDADO: ESTE SCRIPT APAGA DADOS PERMANENTEMENTE
-- #################################################################

BEGIN;

-- 1. REMOVER TABELAS MORTAS
-- Estas tabelas não existem mais no mapeamento do dataRepository.ts
DROP TABLE IF EXISTS activity_photos;
DROP TABLE IF EXISTS bible_class_students; 
DROP TABLE IF EXISTS backup_legacy_config;
DROP TABLE IF EXISTS backup_legacy_master_lists;

-- Remove tabela residual se o erro de renomeação anterior criou uma cópia
DROP TABLE IF EXISTS "_backup_students_legacy";

-- 2. LIMPAR A TABELA DE CLASSES BÍBLICAS
-- Remove a coluna JSON antiga, pois agora usamos a tabela relacional 'bible_class_attendees'
ALTER TABLE bible_classes DROP COLUMN IF EXISTS students;
ALTER TABLE bible_classes DROP COLUMN IF EXISTS "_backup_students_legacy";
ALTER TABLE bible_classes DROP COLUMN IF EXISTS "_backup_legacy_students_json";

-- 3. OTIMIZAÇÃO FINAL (VACUUM)
-- Recupera o espaço em disco deixado pelas colunas/tabelas apagadas
-- Nota: O comando VACUUM não pode rodar dentro de bloco de transação em alguns clients,
-- se der erro, rode apenas as linhas acima e o VACUUM separadamente.

COMMIT;
