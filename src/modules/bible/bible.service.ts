import { supabase } from '../../services/supabaseClient';
import { toCamel, cleanAndConvertToSnake, TABLE_SCHEMAS } from '../../utils/transformers';

export const BibleService = {
  async getBibleStudies() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('bible_studies').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching bible studies:', error);
      return [];
    }
    return toCamel(data || []);
  },

  async getBibleClasses() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('bible_classes').select('*').order('created_at', { ascending: false });
    const { data: attendees, error: attError } = await supabase.from('bible_class_attendees').select('*');
    
    if (error || attError) {
      console.error('Error fetching bible classes:', error || attError);
      return [];
    }

    const classes = toCamel(data || []);
    const camelAttendees = toCamel(attendees || []);

    classes.forEach((cls: any) => {
      cls.students = camelAttendees
        .filter((a: any) => a.classId === cls.id)
        .map((a: any) => a.studentName);
    });

    return classes;
  },

  async saveBibleStudy(study: any) {
    if (!supabase) return { success: false };
    const payload = cleanAndConvertToSnake(study, TABLE_SCHEMAS['bible_studies'], 'bible_studies');
    const { data, error } = await supabase.from('bible_studies').upsert(payload).select();
    if (error) {
      console.error('Error saving bible study:', error);
      return { success: false, error };
    }
    return { success: true, data: toCamel(data) };
  },

  async saveBibleClass(cls: any) {
    if (!supabase) return { success: false };
    const payload = cleanAndConvertToSnake(cls, TABLE_SCHEMAS['bible_classes'], 'bible_classes');
    const { data, error } = await supabase.from('bible_classes').upsert(payload).select();
    
    if (error) {
      console.error('Error saving bible class:', error);
      return { success: false, error };
    }

    const savedClass = toCamel(data?.[0]);
    if (savedClass && cls.students && Array.isArray(cls.students)) {
      await supabase.from('bible_class_attendees').delete().eq('class_id', savedClass.id);
      const attendeesPayload = cls.students.map((name: string) => {
        const match = name.match(/\((\d+)\)$/);
        const staffId = match ? match[1] : null;
        return {
          class_id: savedClass.id,
          student_name: name,
          staff_id: staffId
        };
      });

      if (attendeesPayload.length > 0) {
        const cleanPayload = attendeesPayload.map(p => cleanAndConvertToSnake(p, TABLE_SCHEMAS['bible_class_attendees'], 'bible_class_attendees'));
        await supabase.from('bible_class_attendees').insert(cleanPayload);
      }
    }

    return { success: true, data: toCamel(data) };
  }
};
