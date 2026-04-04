-- Adicionar coluna 'location' para armazenar o local de atividades com pacientes e prestadores
ALTER TABLE public.bible_study_sessions ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.bible_classes ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.staff_visits ADD COLUMN IF NOT EXISTS location TEXT;

-- Função para converter colunas de data (bigint) para timestamptz com backup
DO $$
DECLARE
    col_record RECORD;
    v_table_name TEXT;
    v_column_name TEXT;
    backup_col_name TEXT;
    tables_to_process TEXT[] := ARRAY[
        'bible_study_sessions',
        'bible_classes',
        'bible_class_attendees',
        'small_group_sessions',
        'staff_visits',
        'visit_requests',
        'app_config',
        'pro_sectors',
        'pro_staff',
        'pro_groups',
        'pro_group_members',
        'pro_group_provider_members',
        'pro_monthly_stats',
        'pro_history_records',
        'ambassadors',
        'pro_providers',
        'pro_patients',
        'activity_schedules',
        'edit_authorizations'
    ];
    cols_to_process TEXT[] := ARRAY['created_at', 'updated_at'];
BEGIN
    FOREACH v_table_name IN ARRAY tables_to_process LOOP
        FOREACH v_column_name IN ARRAY cols_to_process LOOP
            
            -- Verifica se a coluna existe e é do tipo bigint
            SELECT data_type INTO col_record
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = v_table_name
              AND column_name = v_column_name;

            IF FOUND AND col_record.data_type = 'bigint' THEN
                backup_col_name := v_column_name || '_legacy_backup';
                
                -- 1. Cria a coluna de backup
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I bigint;', v_table_name, backup_col_name);
                
                -- 2. Copia os dados para o backup
                EXECUTE format('UPDATE public.%I SET %I = %I;', v_table_name, backup_col_name, v_column_name);
                
                -- 3. Remove o valor padrão (DEFAULT) antigo, se existir
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT;', v_table_name, v_column_name);
                
                -- 4. Altera o tipo da coluna original para timestamptz, convertendo os milissegundos
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz USING to_timestamp(%I / 1000.0);', v_table_name, v_column_name, v_column_name);
                
                -- 5. Define o novo valor padrão (DEFAULT now())
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT now();', v_table_name, v_column_name);
                
                RAISE NOTICE 'Tabela %: Coluna % convertida com sucesso. Backup em %', v_table_name, v_column_name, backup_col_name;
            ELSE
                RAISE NOTICE 'Tabela %: Coluna % ignorada (não encontrada ou não é bigint).', v_table_name, v_column_name;
            END IF;

        END LOOP;
    END LOOP;
END $$;
