-- Script para recuperar os números dos setores (IDs antigos)

BEGIN;

-- 1. Adicionar a coluna sector_number na tabela pro_sectors
ALTER TABLE pro_sectors ADD COLUMN IF NOT EXISTS sector_number TEXT;

-- 2. Tentar recuperar o número do setor a partir do nome se ele seguir o padrão "Setor X"
UPDATE pro_sectors
SET sector_number = NULLIF(regexp_replace(name, '\D', '', 'g'), '')
WHERE sector_number IS NULL AND name ILIKE '%Setor%';

-- Nota: Como o ID original foi dropado com CASCADE, ele foi removido de todas as tabelas.
-- A única forma de recuperar é se o número estava no nome do setor ou se houver um backup.
-- Se o nome do setor for "Setor 12", o regex acima extrairá "12".

COMMIT;
