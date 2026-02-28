-- Adiciona a coluna scheduled_time na tabela visit_requests
ALTER TABLE visit_requests ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
