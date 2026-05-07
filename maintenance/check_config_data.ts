import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkConfig() {
  const { data, error } = await supabase.from('app_config').select('*');
  if (error) console.error(error);
  else console.log('Config Data:', JSON.stringify(data, null, 2));
}

checkConfig();
