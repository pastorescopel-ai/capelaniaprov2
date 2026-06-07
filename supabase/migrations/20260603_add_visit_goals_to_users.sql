-- Adiciona colunas para metas de visitas na tabela public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_visit_goal INTEGER DEFAULT 2;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subunit_monthly_visit_goal INTEGER DEFAULT 8;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS visit_goal_period VARCHAR(20) DEFAULT 'daily';
