
-- #################################################################
-- # CORREÇÃO DE SCHEMA: UUID -> BIGINT (Pacientes & Prestadores)
-- # Execute este script no SQL Editor do Supabase para corrigir o erro de cast
-- #################################################################

BEGIN;

-- 1. CORREÇÃO TABELA PACIENTES (pro_patients)
DO $$ 
BEGIN 
    -- Se for UUID
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pro_patients' AND column_name = 'id' AND data_type = 'uuid') THEN
        -- Limpa dados para evitar conflito de conversão
        DELETE FROM pro_patients; 
        
        -- CORREÇÃO CRÍTICA: Remove o padrão gen_random_uuid() que trava a conversão
        ALTER TABLE pro_patients ALTER COLUMN id DROP DEFAULT;
        
        -- Agora converte seguramente para BIGINT
        ALTER TABLE pro_patients ALTER COLUMN id TYPE BIGINT USING (extract(epoch from now()) * 1000)::bigint;
        
        -- Opcional: Recriar PK se necessário (geralmente mantido)
        -- ALTER TABLE pro_patients ADD PRIMARY KEY (id); 
    
    -- Se for TEXT (caso de migrações parciais)
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pro_patients' AND column_name = 'id' AND data_type = 'text') THEN
        DELETE FROM pro_patients WHERE id ~ '[^0-9]';
        ALTER TABLE pro_patients ALTER COLUMN id DROP DEFAULT;
        ALTER TABLE pro_patients ALTER COLUMN id TYPE BIGINT USING id::bigint;
    END IF;
END $$;

-- 2. CORREÇÃO TABELA PRESTADORES (pro_providers)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pro_providers' AND column_name = 'id' AND data_type = 'uuid') THEN
        DELETE FROM pro_providers;
        ALTER TABLE pro_providers ALTER COLUMN id DROP DEFAULT;
        ALTER TABLE pro_providers ALTER COLUMN id TYPE BIGINT USING (extract(epoch from now()) * 1000)::bigint;
    
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pro_providers' AND column_name = 'id' AND data_type = 'text') THEN
        DELETE FROM pro_providers WHERE id ~ '[^0-9]';
        ALTER TABLE pro_providers ALTER COLUMN id DROP DEFAULT;
        ALTER TABLE pro_providers ALTER COLUMN id TYPE BIGINT USING id::bigint;
    END IF;
END $$;

COMMIT;
