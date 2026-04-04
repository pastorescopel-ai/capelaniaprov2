-- Fase 4: Renomeação de Colunas de Data (Backup e Oficialização)
-- Este script renomeia as colunas BIGINT antigas para um nome de backup
-- e oficializa as novas colunas TIMESTAMPTZ com os nomes originais.

-- 1. Tabela: bible_study_sessions
ALTER TABLE bible_study_sessions RENAME COLUMN created_at TO created_at_legacy_backup;
ALTER TABLE bible_study_sessions RENAME COLUMN created_at_tz TO created_at;

ALTER TABLE bible_study_sessions RENAME COLUMN updated_at TO updated_at_legacy_backup;
ALTER TABLE bible_study_sessions RENAME COLUMN updated_at_tz TO updated_at;

-- 2. Tabela: bible_classes
ALTER TABLE bible_classes RENAME COLUMN created_at TO created_at_legacy_backup;
ALTER TABLE bible_classes RENAME COLUMN created_at_tz TO created_at;

ALTER TABLE bible_classes RENAME COLUMN updated_at TO updated_at_legacy_backup;
ALTER TABLE bible_classes RENAME COLUMN updated_at_tz TO updated_at;

-- 3. Tabela: activity_schedules
ALTER TABLE activity_schedules RENAME COLUMN created_at TO created_at_legacy_backup;
ALTER TABLE activity_schedules RENAME COLUMN created_at_tz TO created_at;
