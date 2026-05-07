import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectTable(tableName: string) {
  console.log(`--- INSPECTING ${tableName} ---`);
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (error) {
    console.error(`Error inspecting ${tableName}:`, error.message);
  } else if (data && data.length > 0) {
    console.log(`Columns in ${tableName}:`, Object.keys(data[0]).join(', '));
  } else {
    // If no data, try to get columns via a dummy insert or just report 0
    console.log(`${tableName} is empty.`);
  }
}

async function main() {
  await inspectTable('pro_staff');
  await inspectTable('pro_sectors');
  await inspectTable('pro_groups');
}

main();
