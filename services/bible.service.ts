import { supabase } from './supabaseClient';
import { cleanAndConvertToSnake, TABLE_SCHEMAS } from '../utils/transformers';
import { BibleStudy, BibleClass } from '../types/models';

export const BibleService = {
  async fetchStudies() {
    const { data, error } = await supabase
      .from('bible_study_sessions')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data as BibleStudy[];
  },

  async fetchClasses() {
    const { data, error } = await supabase
      .from('bible_classes')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data as BibleClass[];
  },

  async saveBibleStudy(study: BibleStudy) {
    const snakeStudy = cleanAndConvertToSnake(study, TABLE_SCHEMAS.bible_study_sessions, 'bible_study_sessions');
    const { data, error } = await supabase
      .from('bible_study_sessions')
      .upsert(snakeStudy)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data: data as BibleStudy };
  },

  async saveBibleClass(bibleClass: BibleClass) {
    const snakeClass = cleanAndConvertToSnake(bibleClass, TABLE_SCHEMAS.bible_classes, 'bible_classes');
    const { data, error } = await supabase
      .from('bible_classes')
      .upsert(snakeClass)
      .select()
      .single();
    
    if (error) return { success: false, error };
    return { success: true, data: data as BibleClass };
  },

  async saveClassAttendees(classId: string, attendees: any[]) {
    const snakeAttendees = attendees.map(a => cleanAndConvertToSnake({ ...a, classId }, TABLE_SCHEMAS.bible_class_attendees, 'bible_class_attendees'));
    const { error } = await supabase
      .from('bible_class_attendees')
      .upsert(snakeAttendees);
    
    return !error;
  }
};
