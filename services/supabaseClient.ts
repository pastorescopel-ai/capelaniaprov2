import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants';

// Verifica se as credenciais existem e não são strings vazias
const hasCredentials = SUPABASE_URL && SUPABASE_URL.trim() !== '' && SUPABASE_KEY && SUPABASE_KEY.trim() !== '';

if (!hasCredentials) {
  console.warn("⚠️ Supabase Credentials missing. App running in Safe Mode (UI Only).");
}

// Se não houver credenciais, exporta null em vez de tentar criar um cliente inválido (o que causaria crash)
export const supabase = hasCredentials 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;