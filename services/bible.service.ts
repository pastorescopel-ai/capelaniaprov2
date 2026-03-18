import { supabase } from './supabaseClient';
import { cleanAndConvertToSnake } from '../utils/transformers';

export const BibleService = {
  async fetchStudies() {
    const { data, error } = await supabase
      .from('bible_studies')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async fetchClasses() {
    const { data, error } = await supabase
      .from('bible_classes')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async saveBibleStudy(study: any) {
    const snakeStudy = cleanAndConvertToSnake('bible_studies', study);
    const { data, error } = await supabase
      .from('bible_studies')
      .upsert(snakeStudy)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data };
  },

  async saveBibleClass(bibleClass: any) {
    const snakeClass = cleanAndConvertToSnake('bible_classes', bibleClass);
    const { data, error } = await supabase
      .from('bible_classes')
      .upsert(snakeClass)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data };
  },

  async saveClassAttendees(classId: string, attendees: any[]) {
    const snakeAttendees = attendees.map(a => cleanAndConvertToSnake('bible_class_attendees', { ...a, classId }));
    const { error } = await supabase
      .from('bible_class_attendees')
      .upsert(snakeAttendees);
    
    return !error;
  }
};
