import { supabase } from './supabaseClient';
import { cleanAndConvertToSnake, TABLE_SCHEMAS } from '../utils/transformers';

export const PGService = {
  async fetchSmallGroups() {
    const { data, error } = await supabase
      .from('small_group_sessions')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async saveSmallGroup(pg: any) {
    const snakePG = cleanAndConvertToSnake(pg, TABLE_SCHEMAS.small_group_sessions, 'small_group_sessions');
    const { data, error } = await supabase
      .from('small_group_sessions')
      .upsert(snakePG)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data };
  },

  async deleteSmallGroup(id: string) {
    const { error } = await supabase
      .from('small_group_sessions')
      .delete()
      .eq('id', id);
    
    return !error;
  },

  async getPGManagementData() {
    const [leaders, hosts, sectors] = await Promise.all([
      supabase.from('pg_leaders').select('*'),
      supabase.from('pg_hosts').select('*'),
      supabase.from('pro_sectors').select('*')
    ]);

    return {
      leaders: leaders.data || [],
      hosts: hosts.data || [],
      sectors: sectors.data || []
    };
  }
};
