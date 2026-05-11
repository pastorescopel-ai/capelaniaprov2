import { supabase } from './supabaseClient';
import { cleanAndConvertToSnake, TABLE_SCHEMAS } from '../utils/transformers';
import { StaffVisit } from '../types/models';

export const StaffService = {
  async fetchVisits() {
    const { data, error } = await supabase
      .from('staff_visits')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) return { success: false, error };
    return { success: true, data: data as StaffVisit[] };
  },

  async saveVisit(visit: StaffVisit) {
    const snakeVisit = cleanAndConvertToSnake(visit, TABLE_SCHEMAS.staff_visits, 'staff_visits');
    const { data, error } = await supabase
      .from('staff_visits')
      .upsert(snakeVisit)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data: data as StaffVisit };
  },

  async deleteVisit(id: string) {
    const { error } = await supabase
      .from('staff_visits')
      .delete()
      .eq('id', id);
    
    if (error) return { success: false, error };
    return { success: true };
  }
};
