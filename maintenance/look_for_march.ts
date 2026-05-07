import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function lookForMarchData() {
  console.log('--- BUSCANDO SESSÕES DE MARÇO EM BIBLE_STUDY_SESSIONS ---');
  const { data: studies, count } = await supabase
    .from('bible_study_sessions')
    .select('sector, sector_id, staff_id, staff_name', { count: 'exact' })
    .gte('date', '2026-03-01')
    .lte('date', '2026-03-31');
  
  console.log(`Encontrados em Bible Study: ${count}`);
  if (studies && studies.length > 0) {
    console.log('Amostra de vincúlo (Setor Nome -> Setor ID):', studies[0]);
  }

  console.log('\n--- BUSCANDO SESSÕES DE MARÇO EM SMALL_GROUP_SESSIONS ---');
  const { data: groups, count: gCount } = await supabase
    .from('small_group_sessions')
    .select('sector, sector_id, group_name', { count: 'exact' })
    .gte('date', '2026-03-01')
    .lte('date', '2026-03-31');

  console.log(`Encontrados em Small Group Sessions: ${gCount}`);
  if (groups && groups.length > 0) {
    console.log('Amostra de vínculo de PG:', groups[0]);
  }
}

lookForMarchData();
