import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
  console.log('--- INSPECTING PRO_STAFF ---');
  const { data: staff } = await supabase.from('pro_staff').select('*').limit(1);
  if (staff && staff[0]) console.log('Staff columns:', Object.keys(staff[0]));

  console.log('\n--- INSPECTING PRO_SECTORS ---');
  const { data: sectors } = await supabase.from('pro_sectors').select('*').limit(1);
  if (sectors && sectors[0]) console.log('Sector columns:', Object.keys(sectors[0]));

  console.log('\n--- INSPECTING PRO_GROUPS ---');
  const { data: groups } = await supabase.from('pro_groups').select('*').limit(1);
  if (groups && groups[0]) console.log('Group columns:', Object.keys(groups[0]));
}

inspectSchema();
