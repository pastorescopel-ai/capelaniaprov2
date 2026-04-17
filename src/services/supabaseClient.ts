import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants';

// Verifica se as credenciais existem e não são strings vazias
const hasCredentials = SUPABASE_URL && SUPABASE_URL.trim() !== '' && SUPABASE_KEY && SUPABASE_KEY.trim() !== '';

if (!hasCredentials) {
  console.warn("⚠️ Supabase Credentials missing. App running in Safe Mode (UI Only).");
}

// Se não houver credenciais, exporta null em vez de tentar criar um cliente inválido (o que causaria crash)
export const supabase = hasCredentials 
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Evita travamentos de LockManager em iframes e ambientes com DNS instável
        // Implementa um "no-op lock" para evitar o timeout de 10s sem quebrar a biblioteca
        //@ts-expect-error - lock pode não estar nos tipos, mas é necessário para override de segurança
        lock: async (name, acquireTimeout, fn) => { return await fn(); }
      },
      global: {
        headers: { 'x-application-name': 'capelania-pro' },
      }
    }) 
  : null;

/**
 * Testa a conexão real com o servidor do Supabase.
 * Útil para distinguir entre "sem internet" e "sem credenciais".
 */
export const checkSupabaseConnection = async (): Promise<boolean> => {
  if (!supabase) return false;
  try {
    // Timeout maior para dar tempo de resposta em redes lentas (ex: Hospital)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const { error } = await supabase.from('users').select('count', { count: 'exact', head: true }).abortSignal(controller.signal);
    
    clearTimeout(timeoutId);

    if (error) {
      const msg = error.message || "";
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_NAME_NOT_RESOLVED')) return false;
      return true; // Se for erro de permissão, o servidor respondeu
    }
    return true;
  } catch (e) {
    return false;
  }
};