-- Migração para corrigir colunas de data que podem conter timestamps numéricos (ms) como strings.
-- Converte esses valores para o formato DATE ou TIMESTAMPTZ correto.

BEGIN;

-- 1. Função auxiliar para converter string (ISO ou Numeric) para DATE
CREATE OR REPLACE FUNCTION fix_to_date(val TEXT) RETURNS DATE AS $$
BEGIN
    IF val IS NULL OR val = '' THEN
        RETURN NULL;
    END IF;
    
    IF val ~ '^\d+$' THEN
        RETURN (to_timestamp(val::double precision / 1000.0))::date;
    END IF;
    
    RETURN val::date;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Função auxiliar para converter string (ISO ou Numeric) para TIMESTAMPTZ
CREATE OR REPLACE FUNCTION fix_to_timestamptz(val TEXT) RETURNS TIMESTAMPTZ AS $$
BEGIN
    IF val IS NULL OR val = '' THEN
        RETURN NULL;
    END IF;
    
    IF val ~ '^\d+$' THEN
        RETURN to_timestamp(val::double precision / 1000.0);
    END IF;
    
    RETURN val::timestamptz;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Aplicar correções na tabela visit_requests
DO $$
BEGIN
    -- Converte coluna 'date' para DATE
    -- Primeiro cria coluna temporária
    ALTER TABLE visit_requests ADD COLUMN IF NOT EXISTS new_date DATE;
    UPDATE visit_requests SET new_date = fix_to_date(date);
    ALTER TABLE visit_requests DROP COLUMN date;
    ALTER TABLE visit_requests RENAME COLUMN new_date TO date;
    
    -- Garante que created_at e updated_at sejam timestamptz (caso não tenham sido convertidos)
    -- (Já deve ter sido feito na migração anterior, mas reforçamos se necessário)
END $$;

-- 4. Aplicar correções em outras tabelas que podem ter o mesmo problema
DO $$
BEGIN
    -- bible_study_sessions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bible_study_sessions') THEN
        ALTER TABLE bible_study_sessions ADD COLUMN IF NOT EXISTS new_date DATE;
        UPDATE bible_study_sessions SET new_date = fix_to_date(date);
        ALTER TABLE bible_study_sessions DROP COLUMN date;
        ALTER TABLE bible_study_sessions RENAME COLUMN new_date TO date;
    END IF;

    -- staff_visits
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_visits') THEN
        ALTER TABLE staff_visits ADD COLUMN IF NOT EXISTS new_date DATE;
        UPDATE staff_visits SET new_date = fix_to_date(date);
        ALTER TABLE staff_visits DROP COLUMN date;
        ALTER TABLE staff_visits RENAME COLUMN new_date TO date;
    END IF;

    -- small_group_sessions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'small_group_sessions') THEN
        ALTER TABLE small_group_sessions ADD COLUMN IF NOT EXISTS new_date DATE;
        UPDATE small_group_sessions SET new_date = fix_to_date(date);
        ALTER TABLE small_group_sessions DROP COLUMN date;
        ALTER TABLE small_group_sessions RENAME COLUMN new_date TO date;
    END IF;
END $$;

-- Limpeza das funções auxiliares
DROP FUNCTION fix_to_date(TEXT);
DROP FUNCTION fix_to_timestamptz(TEXT);

COMMIT;
