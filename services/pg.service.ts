import { supabase } from './supabaseClient';
import { cleanAndConvertToSnake } from '../utils/transformers';

export const PGService = {
  async fetchSmallGroups() {
    const { data, error } = await supabase
      .from('small_groups')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async saveSmallGroup(pg: any) {
    const snakePG = cleanAndConvertToSnake('small_groups', pg);
    const { data, error } = await supabase
      .from('small_groups')
      .upsert(snakePG)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data };
  },

  async deleteSmallGroup(id: string) {
    const { error } = await supabase
      .from('small_groups')
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
