import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findBackups() {
  console.log('--- BUSCANDO TABELAS DE BACKUP OU ALTERNATIVAS ---');
  
  // Tentando nomes comuns de backup
  const possibleBackups = [
    'pro_history_records_old', 
    'pro_history_records_backup', 
    'pro_monthly_stats_old', 
    'pro_monthly_stats_backup',
    'pro_staff_backup',
    'pro_sectors_backup'
  ];

  for (const table of possibleBackups) {
    const { data, count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (!error) {
      const realCount = count ?? 0;
      console.log(`✅ Tabela ENCONTRADA: ${table} - Contagem: ${realCount}`);
      // Se tiver registros, vamos ver uma amostra
      if (realCount > 0) {
        const { data: sample } = await supabase.from(table).select('*').limit(1);
        console.log(`Amostra de ${table}:`, sample);
      }
    }
  }
}

findBackups();
