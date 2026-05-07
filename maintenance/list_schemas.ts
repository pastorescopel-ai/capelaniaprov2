import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listSchemas() {
  const { data, error } = await supabase.rpc('get_schemas');
  if (error) {
    // If RPC fails, try a direct query to information_schema if allowed (usually not for anon)
    console.error('RPC get_schemas failed:', error);
    
    // Tentar via SQL bruto se possível via rpc
    const { data: qData, error: qError } = await supabase.from('pg_namespace').select('nspname');
    if (qError) console.error('Query pg_namespace failed:', qError);
    else console.log('Schemas:', qData);
  } else {
    console.log('Schemas:', data);
  }
}

listSchemas();
