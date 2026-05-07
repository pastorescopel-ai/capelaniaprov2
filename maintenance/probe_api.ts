import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || '';

async function probeApi() {
  console.log('Probing pro_history_records...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pro_history_records?select=count`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact'
    }
  });
  console.log('History Status:', res.status);
  console.log('History Headers:', JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));

  console.log('\nProbing pro_monthly_stats...');
  const resStats = await fetch(`${SUPABASE_URL}/rest/v1/pro_monthly_stats?select=count`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact'
    }
  });
  console.log('Stats Status:', resStats.status);
  console.log('Stats Headers:', JSON.stringify(Object.fromEntries(resStats.headers.entries()), null, 2));
}

probeApi();
