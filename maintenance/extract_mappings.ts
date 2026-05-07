import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function extractMappings() {
  const groupToSector = new Map();
  const staffToSector = new Map();

  console.log('Fetching Bible Studies...');
  const { data: bStudies } = await supabase.from('bible_study_sessions').select('staff_id, sector, sector_id');
  bStudies?.forEach(s => {
    if (s.staff_id && s.sector) staffToSector.set(String(s.staff_id), s.sector);
  });

  console.log('Fetching Small Group Sessions...');
  const { data: sGroups } = await supabase.from('small_group_sessions').select('group_name, sector, sector_id');
  sGroups?.forEach(g => {
    if (g.group_name && g.sector) groupToSector.set(g.group_name, g.sector);
  });

  console.log('Fetching Staff Visits...');
  const { data: visits } = await supabase.from('staff_visits').select('staff_id, sector');
  visits?.forEach(v => {
    if (v.staff_id && v.sector) staffToSector.set(String(v.staff_id), v.sector);
  });

  console.log('--- EXTRACTED MAPPINGS ---');
  console.log('Unique Staff Mappings found:', staffToSector.size);
  console.log('Unique Group Mappings found:', groupToSector.size);

  // Exibir alguns
  console.log('Sample Staff Mappings:', Array.from(staffToSector.entries()).slice(0, 5));
  console.log('Sample Group Mappings:', Array.from(groupToSector.entries()).slice(0, 5));
}

extractMappings();
