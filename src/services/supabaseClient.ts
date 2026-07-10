import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants';

// Verifica se as credenciais existem e não são strings vazias
const hasCredentials = SUPABASE_URL && SUPABASE_URL.trim() !== '' && SUPABASE_KEY && SUPABASE_KEY.trim() !== '';

if (!hasCredentials) {
  console.warn("⚠️ Supabase Credentials missing. App running in Safe Mode (UI Only).");
}

// In-memory fallback for auth token if localStorage fails completely
const memoryStorage: Record<string, string> = {};

const customAuthStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    } catch (e) {
      // Ignore
    }
    return memoryStorage[key] || null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
      delete memoryStorage[key]; // Clear from memory if successful
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('[Supabase Auth] LocalStorage is full. Attempting to clear offline caches to save auth token...');
        try {
          // Find all offline caches and remove them
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith('capelania_offline_')) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach(k => window.localStorage.removeItem(k));
          
          // Try again
          window.localStorage.setItem(key, value);
          delete memoryStorage[key];
        } catch (e2) {
          console.error('[Supabase Auth] LocalStorage is still full. Falling back to in-memory auth storage.');
          memoryStorage[key] = value;
        }
      } else {
        memoryStorage[key] = value;
      }
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      // Ignore
    }
    delete memoryStorage[key];
  }
};

// Se não houver credenciais, exporta null em vez de tentar criar um cliente inválido (o que causaria crash)
export const supabase = hasCredentials 
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: customAuthStorage,
      },
      global: {
        headers: { 'x-application-name': 'capelania-pro' },
      }
    }) 
  : null;