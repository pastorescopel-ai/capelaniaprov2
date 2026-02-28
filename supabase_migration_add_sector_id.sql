-- Adiciona a coluna sector_id na tabela visit_requests
ALTER TABLE visit_requests ADD COLUMN IF NOT EXISTS sector_id BIGINT REFERENCES pro_sectors(id);

-- Opcional: Adiciona um índice para performance
CREATE INDEX IF NOT EXISTS idx_visit_requests_sector_id ON visit_requests(sector_id);
