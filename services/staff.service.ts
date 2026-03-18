import { supabase } from './supabaseClient';
import { cleanAndConvertToSnake } from '../utils/transformers';

export const StaffService = {
  async fetchVisits() {
    const { data, error } = await supabase
      .from('staff_visits')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async saveVisit(visit: any) {
    const snakeVisit = cleanAndConvertToSnake('staff_visits', visit);
    const { data, error } = await supabase
      .from('staff_visits')
      .upsert(snakeVisit)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data };
  },

  async deleteVisit(id: string) {
    const { error } = await supabase
      .from('staff_visits')
      .delete()
      .eq('id', id);
    
    return !error;
  }
};
