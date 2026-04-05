import { supabase } from './supabaseClient';
import { cleanAndConvertToSnake, TABLE_SCHEMAS } from '../utils/transformers';
import { SmallGroup } from '../types/models';

export const PGService = {
  async fetchSmallGroups() {
    const { data, error } = await supabase
      .from('small_group_sessions')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) return { success: false, error };
    return { success: true, data: data as SmallGroup[] };
  },

  async saveSmallGroup(pg: SmallGroup) {
    const snakePG = cleanAndConvertToSnake(pg, TABLE_SCHEMAS.small_group_sessions, 'small_group_sessions');
    const { data, error } = await supabase
      .from('small_group_sessions')
      .upsert(snakePG)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data: data as SmallGroup };
  },

  async deleteSmallGroup(id: string) {
    const { error } = await supabase
      .from('small_group_sessions')
      .delete()
      .eq('id', id);
    
    if (error) return { success: false, error };
    return { success: true };
  },

  async getPGManagementData() {
    const [leaders, hosts, sectors] = await Promise.all([
      supabase.from('pg_leaders').select('*'),
      supabase.from('pg_hosts').select('*'),
      supabase.from('pro_sectors').select('*')
    ]);

    if (leaders.error || hosts.error || sectors.error) {
      return { success: false, error: leaders.error || hosts.error || sectors.error };
    }

    return { 
      success: true, 
      data: {
        leaders: leaders.data || [],
        hosts: hosts.data || [],
        sectors: sectors.data || []
      }
    };
  }
};
