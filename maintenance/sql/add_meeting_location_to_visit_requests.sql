-- Adiciona a coluna meeting_location à tabela visit_requests
-- Esta coluna servirá para armazenar o ponto de encontro específico do PG
-- sem interferir na estrutura organizacional de setores.

ALTER TABLE visit_requests ADD COLUMN IF NOT EXISTS meeting_location TEXT;

-- Comentário: Você deve executar este comando no Editor SQL do seu painel Supabase.
