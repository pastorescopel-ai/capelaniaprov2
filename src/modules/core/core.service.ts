import { supabase } from '../../services/supabaseClient';
import { toCamel, cleanAndConvertToSnake, TABLE_SCHEMAS } from '../../utils/transformers';

export const CoreService = {
  async getUsers() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('users').select('*').order('updated_at', { ascending: false });
    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }
    return toCamel(data || []);
  },

  async getConfig() {
    if (!supabase) return null;
    const { data, error } = await supabase.from('app_config').select('*').limit(1);
    if (error) {
      console.error('Error fetching app config:', error);
      return null;
    }
    return data && data.length > 0 ? toCamel(data[0]) : null;
  },

  async saveUser(user: any) {
    if (!supabase) return { success: false };
    const payload = cleanAndConvertToSnake(user, TABLE_SCHEMAS['users'], 'users');
    const { data, error } = await supabase.from('users').upsert(payload).select();
    if (error) {
      console.error('Error saving user:', error);
      return { success: false, error };
    }
    return { success: true, data: toCamel(data) };
  },

  async saveConfig(config: any) {
    if (!supabase) return { success: false };
    const payload = cleanAndConvertToSnake(config, TABLE_SCHEMAS['app_config'], 'app_config');
    const { data, error } = await supabase.from('app_config').upsert(payload).select();
    if (error) {
      console.error('Error saving app config:', error);
      return { success: false, error };
    }
    return { success: true, data: toCamel(data) };
  }
};
