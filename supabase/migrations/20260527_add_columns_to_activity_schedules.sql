-- Add missing columns to activity_schedules table to support morning/afternoon planning and visitation attributes
ALTER TABLE public.activity_schedules ADD COLUMN IF NOT EXISTS period TEXT DEFAULT 'tarde';
ALTER TABLE public.activity_schedules ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.activity_schedules ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE public.activity_schedules ADD COLUMN IF NOT EXISTS responsible_whatsapp TEXT;
