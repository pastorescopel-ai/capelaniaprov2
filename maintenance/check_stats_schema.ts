import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMonthlyStatsSchema() {
  console.log('--- CHECKING pro_monthly_stats SCHEMA ---');
  const { data, error } = await supabase.from('pro_monthly_stats').select('*').limit(0);
  if (error) console.error(error);
  else console.log('Successfully connected to pro_monthly_stats');
  
  // Tentar pegar os nomes e tipos das colunas via prompt
}

checkMonthlyStatsSchema();
