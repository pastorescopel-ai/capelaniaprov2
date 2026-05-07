import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listAllTables() {
  const { data, error } = await supabase.rpc('get_tables_info');
  
  if (error) {
    // If RPC doesn't exist, try a direct query via a common table to see if it works
    console.log('RPC get_tables_info not found. Trying information_schema query...');
    const { data: tables, error: err2 } = await supabase
        .from('pro_staff')
        .select('id')
        .limit(1);
    
    if (err2) console.error('Cannot even reach pro_staff:', err2);
    else console.log('Successfully reached pro_staff. Use SQL editor to check tables if needed.');
  } else {
    console.log('Tables:', data);
  }
}

listAllTables();
