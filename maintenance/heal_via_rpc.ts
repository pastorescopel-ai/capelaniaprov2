import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findSectorsToHeal() {
  console.log('Finding session sectors to heal...');
  
  // Pegar todos os setores únicos usados nas sessões
  const { data: sgSess } = await supabase.from('small_group_sessions').select('sector, unit').not('sector', 'is', null);
  const { data: bsSess } = await supabase.from('bible_study_sessions').select('sector, unit').not('sector', 'is', null);
  
  const uniqueSectors = new Map();
  
  [...(sgSess || []), ...(bsSess || [])].forEach(s => {
    uniqueSectors.set(`${s.sector}|${s.unit}`, { name: s.sector, unit: s.unit });
  });

  console.log(`Found ${uniqueSectors.size} unique sector names in sessions.`);

  // Pegar setores oficiais para bater o ID
  const { data: proSectors } = await supabase.from('pro_sectors').select('id, name, unit');
  
  const sectorsByName = new Map();
  proSectors?.forEach(s => sectorsByName.set(`${s.name}|${s.unit}`, s.id));

  let healedCount = 0;
  for (const [key, info] of uniqueSectors.entries()) {
    const targetId = sectorsByName.get(key);
    if (targetId) {
      console.log(`Healing sector "${info.name}" (${info.unit}) -> ID ${targetId}`);
      const { data, error } = await supabase.rpc('heal_sector_global', {
        bad_name: info.name,
        target_sector_id: targetId
      });
      if (error) console.error(`Error healing ${info.name}:`, error.message);
      else {
        console.log(`Result: ${data}`);
        healedCount++;
      }
    }
  }
  
  console.log(`Healed ${healedCount} sectors successfully via RPC.`);
}

findSectorsToHeal();
