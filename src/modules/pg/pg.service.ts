import { supabase } from '../../services/supabaseClient';
import { toCamel, cleanAndConvertToSnake, TABLE_SCHEMAS } from '../../utils/transformers';

export const PGService = {
  async getSmallGroups() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('small_groups').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching small groups:', error);
      return [];
    }
    return toCamel(data || []);
  },

  async saveSmallGroup(group: any) {
    if (!supabase) return { success: false };
    const payload = cleanAndConvertToSnake(group, TABLE_SCHEMAS['small_groups'], 'small_groups');
    const { data, error } = await supabase.from('small_groups').upsert(payload).select();
    if (error) {
      console.error('Error saving small group:', error);
      return { success: false, error };
    }
    return { success: true, data: toCamel(data) };
  },

  async deleteSmallGroup(id: string) {
    if (!supabase) return false;
    const { error } = await supabase.from('small_groups').delete().eq('id', id);
    return !error;
  },

  async getPGManagementData() {
    if (!supabase) return null;
    const results = await Promise.all([
      supabase.from('pro_sectors').select('*'),
      supabase.from('pro_staff').select('*'),
      supabase.from('pro_patients').select('*'),
      supabase.from('pro_providers').select('*'),
      supabase.from('pro_groups').select('*'),
      supabase.from('pro_group_locations').select('*'),
      supabase.from('pro_group_members').select('*'),
      supabase.from('pro_group_provider_members').select('*'),
      supabase.from('pro_monthly_stats').select('*')
    ]);

    const [ps, pst, pp, pr, pg, pgl, pgm, pgpm, pms] = results;

    return {
      proSectors: toCamel(ps.data || []),
      proStaff: toCamel(pst.data || []),
      proPatients: toCamel(pp.data || []),
      proProviders: toCamel(pr.data || []),
      proGroups: toCamel(pg.data || []),
      proGroupLocations: toCamel(pgl.data || []),
      proGroupMembers: toCamel(pgm.data || []),
      proGroupProviderMembers: toCamel(pgpm.data || []),
      proMonthlyStats: toCamel(pms.data || [])
    };
  }
};
