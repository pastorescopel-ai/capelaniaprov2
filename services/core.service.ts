import { supabase } from './supabaseClient';
import { cleanAndConvertToSnake } from '../utils/transformers';

export const CoreService = {
  async fetchUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  },

  async fetchAppConfig() {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async saveUser(user: any) {
    const snakeUser = cleanAndConvertToSnake('users', user);
    const { data, error } = await supabase
      .from('users')
      .upsert(snakeUser)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async saveAppConfig(config: any) {
    const snakeConfig = cleanAndConvertToSnake('app_config', config);
    const { data, error } = await supabase
      .from('app_config')
      .upsert(snakeConfig)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};
