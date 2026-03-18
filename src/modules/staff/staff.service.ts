import { supabase } from '../../services/supabaseClient';
import { toCamel, cleanAndConvertToSnake, TABLE_SCHEMAS } from '../../utils/transformers';

export const StaffService = {
  async getStaffVisits() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('staff_visits').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching staff visits:', error);
      return [];
    }
    return toCamel(data || []);
  },

  async saveVisit(visit: any) {
    if (!supabase) return { success: false };
    const payload = cleanAndConvertToSnake(visit, TABLE_SCHEMAS['staff_visits'], 'staff_visits');
    const { data, error } = await supabase.from('staff_visits').upsert(payload).select();
    if (error) {
      console.error('Error saving staff visit:', error);
      return { success: false, error };
    }
    return { success: true, data: toCamel(data) };
  },

  async deleteVisit(id: string) {
    if (!supabase) return false;
    const { error } = await supabase.from('staff_visits').delete().eq('id', id);
    return !error;
  }
};
