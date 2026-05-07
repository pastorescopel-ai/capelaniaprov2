import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('CRITICAL: Supabase URL or Key missing in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnose() {
  console.log('--- SYSTEM INTEGRITY DIAGNOSTIC ---');
  
  // 1. Check Column Types via Query
  const typeQuery = `
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('pro_monthly_stats', 'pro_sectors', 'pro_staff', 'pro_groups')
    AND column_name IN ('id', 'target_id', 'sector_id');
  `;
  
  console.log('Fetching schema info...');
  // We'll try to use a simple RPC if available, or just infer from a raw query if we have service role
  // Since we don't know if 'get_table_info' exists, we'll try to select and check the shape
  
  const tables = ['pro_monthly_stats', 'pro_sectors', 'pro_staff', 'pro_groups'];
  for (const table of tables) {
     const { data, error } = await supabase.from(table).select('*').limit(1);
     if (error) {
       console.error(`Error reading ${table}:`, error.message);
     } else {
       console.log(`Table ${table} sample:`, data[0] ? Object.keys(data[0]).map(k => `${k}(${typeof data[0][k]})`).join(', ') : 'Empty');
     }
  }

  // 2. Check for orphaned records
  console.log('\nChecking for orphaned Staff (sector_id referential check)...');
  const { data: orphans, error: orphanError } = await supabase
    .from('pro_staff')
    .select('id, name, sector_id')
    .not('sector_id', 'is', null);

  if (orphanError) {
    console.error('Error checking orphans:', orphanError.message);
  } else if (orphans) {
    const { data: sectors } = await supabase.from('pro_sectors').select('id');
    const validSectorIds = new Set(sectors?.map(s => s.id));
    const invalidStaff = orphans.filter(s => !validSectorIds.has(s.sector_id));
    console.log(`Found ${invalidStaff.length} staff members with invalid/orphaned sector_id.`);
    if (invalidStaff.length > 0) {
      console.log('Sample invalid staff:', invalidStaff.slice(0, 3));
    }
  }

  // 3. Stats for March 2026
  console.log('\nChecking Monthly Stats for 2026-03-01...');
  const { data: marchStats, error: statsError } = await supabase
    .from('pro_monthly_stats')
    .select('*')
    .eq('month', '2026-03-01');
  
  if (statsError) {
    console.error('Error fetching March stats:', statsError.message);
  } else {
    console.log(`Found ${marchStats?.length || 0} stats records for March.`);
    const sectorsWithStats = marchStats?.filter(s => s.type === 'sector').length;
    console.log(`Sectors with stats: ${sectorsWithStats}`);
  }
}

diagnose();
