import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkColumnTypes() {
  const tables = ['pro_monthly_stats', 'pro_sectors', 'pro_history_records'];
  for (const table of tables) {
    console.log(`--- COLUMN TYPES FOR ${table} ---`);
    // Usando uma query que deve funcionar em Supabase se houver permissão de leitura em information_schema
    // Se não, vamos inferir pelos resultados de uma query mock
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
       console.error(`Error selecting from ${table}:`, error.message);
    } else {
       console.log(`Sample row for ${table}:`, data[0]);
    }
  }
}

checkColumnTypes();
