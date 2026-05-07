import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listAdmins() {
  const { data, error } = await supabase.from('users').select('email, role').eq('role', 'admin').limit(5);
  if (error) console.error(error.message);
  else console.log('Admins:', data);
}

listAdmins();
