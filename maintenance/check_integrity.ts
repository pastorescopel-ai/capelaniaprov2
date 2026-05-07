import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkIntegrity() {
  const { data: sectors } = await supabase.from('pro_sectors').select('id');
  const validSectorIds = new Set(sectors?.map(s => String(s.id)) || []);
  console.log(`Total Valid Sectors: ${validSectorIds.size}`);

  console.log('\n--- CHECKING PRO_STAFF SECTOR_ID VALIDITY ---');
  const { data: staff } = await supabase.from('pro_staff').select('id, name, sector_id');
  const invalidStaff = staff?.filter(s => s.sector_id && !validSectorIds.has(String(s.sector_id))) || [];
  console.log(`Total Staff: ${staff?.length}`);
  console.log(`Staff with INVALID sector_id: ${invalidStaff.length}`);
  if (invalidStaff.length > 0) {
    console.log('Sample invalid staff:', invalidStaff.slice(0, 3));
  }

  console.log('\n--- CHECKING PRO_GROUPS SECTOR_ID VALIDITY ---');
  const { data: groups } = await supabase.from('pro_groups').select('id, name, sector_id');
  const invalidGroups = groups?.filter(g => g.sector_id && !validSectorIds.has(String(g.sector_id))) || [];
  const nullGroups = groups?.filter(g => !g.sector_id) || [];
  console.log(`Total Groups: ${groups?.length}`);
  console.log(`Groups with NULL sector_id: ${nullGroups.length}`);
  console.log(`Groups with INVALID sector_id: ${invalidGroups.length}`);
}

checkIntegrity();
