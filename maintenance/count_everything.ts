import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function countEverything() {
  const tables = [
    'app_config', 'pro_staff', 'pro_sectors', 'pro_groups', 'pro_group_members', 
    'pro_history_records', 'pro_monthly_stats', 'bible_classes', 'audit_log'
  ];

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) console.log(`Table ${table}: ERROR - ${error.message}`);
    else console.log(`Table ${table}: ${count} records`);
  }
}

countEverything();
