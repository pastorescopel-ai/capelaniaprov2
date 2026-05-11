import { supabase } from './supabaseClient';
import { cleanAndConvertToSnake, TABLE_SCHEMAS } from '../utils/transformers';
import { User, Config } from '../types/models';

export const CoreService = {
  async fetchUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');
    
    if (error) return { success: false, error };
    return { success: true, data: data as User[] };
  },

  async fetchAppConfig() {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .single();
    
    if (error && error.code !== 'PGRST116') return { success: false, error };
    return { success: true, data: data as Config };
  },

  async saveUser(user: User) {
    const snakeUser = cleanAndConvertToSnake(user, TABLE_SCHEMAS.users, 'users');
    const { data, error } = await supabase
      .from('users')
      .upsert(snakeUser)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data: data as User };
  },

  async saveAppConfig(config: Config) {
    const snakeConfig = cleanAndConvertToSnake(config, TABLE_SCHEMAS.app_config, 'app_config');
    const { data, error } = await supabase
      .from('app_config')
      .upsert(snakeConfig)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data: data as Config };
  }
};
