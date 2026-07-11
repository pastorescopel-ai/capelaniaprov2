DO $$
DECLARE
    tbl text;
    tables_to_add text[] := ARRAY[
        'bible_study_sessions',
        'bible_classes',
        'small_group_sessions',
        'staff_visits',
        'visit_requests',
        'pro_sectors',
        'pro_staff',
        'pro_patients',
        'pro_providers',
        'pro_groups',
        'pro_group_locations',
        'pro_group_members',
        'pro_group_provider_members',
        'pro_monthly_stats',
        'pro_history_records',
        'ambassadors',
        'activity_schedules',
        'daily_activity_reports',
        'bible_class_attendees',
        'edit_authorizations',
        'users',
        'app_config'
    ];
BEGIN
    FOR tbl IN SELECT unnest(tables_to_add) LOOP
        -- Check if the table exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            -- Check if it is already in the publication
            IF NOT EXISTS (
                SELECT 1
                FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
            END IF;
        END IF;
    END LOOP;
END;
$$;
