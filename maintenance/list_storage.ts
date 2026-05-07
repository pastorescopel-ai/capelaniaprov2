import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) console.error('Storage error:', error);
  else {
    console.log('Buckets:', data.map(b => b.name));
    for (const b of data) {
      const { data: files } = await supabase.storage.from(b.name).list();
      console.log(`Files in ${b.name}:`, files?.map(f => f.name));
    }
  }
}

listBuckets();
