import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function analyzeHistory() {
  console.log('--- BUSCANDO REGISTROS EM PRO_HISTORY_RECORDS ---');
  const { data: hist, error: err1 } = await supabase
    .from('pro_history_records')
    .select('id, month, staff_name, sector_name, sector_id')
    .limit(5);
  
  if (err1) console.error(err1);
  else console.log('Amostra Histórico:', hist);

  console.log('\n--- BUSCANDO REGISTROS EM PRO_MONTHLY_STATS ---');
  const { data: stats, error: err2 } = await supabase
    .from('pro_monthly_stats')
    .select('id, month, type, snapshot_data')
    .limit(3);

  if (err2) console.error(err2);
  else console.log('Amostra Stats:', stats);
}

analyzeHistory();
