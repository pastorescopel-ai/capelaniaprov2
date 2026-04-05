
import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { toCamel } from '../utils/transformers';

export const useRealtimeSync = (setters: Record<string, any>) => {
  useEffect(() => {
    if (!supabase) return;

    const handleRealtimeChange = (payload: any) => {
      const { eventType, table, new: newRecord, old: oldRecord } = payload;
      
      const tableToCollection: Record<string, string> = {
        'bible_study_sessions': 'bibleStudies',
        'bible_classes': 'bibleClasses',
        'small_group_sessions': 'smallGroups',
        'staff_visits': 'staffVisits',
        'visit_requests': 'visitRequests',
        'pro_sectors': 'proSectors',
        'pro_staff': 'proStaff',
        'pro_patients': 'proPatients',
        'pro_providers': 'proProviders',
        'pro_groups': 'proGroups',
        'pro_group_locations': 'proGroupLocations',
        'pro_group_members': 'proGroupMembers',
        'pro_group_provider_members': 'proGroupProviderMembers',
        'pro_monthly_stats': 'proMonthlyStats',
        'pro_history_records': 'proHistoryRecords',
        'ambassadors': 'ambassadors',
        'activity_schedules': 'activitySchedules',
        'daily_activity_reports': 'dailyActivityReports',
        'bible_class_attendees': 'bibleClassAttendees',
        'edit_authorizations': 'editAuthorizations',
        'users': 'users',
        'app_config': 'config'
      };

      const collection = tableToCollection[table];
      if (!collection) return;

      const setter = setters[collection];
      if (!setter) return;

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const camelRecord = toCamel(newRecord);
        
        if (collection === 'config') {
          setter(camelRecord);
          return;
        }

        setter((prev: any[]) => {
          const index = prev.findIndex(i => i.id === camelRecord.id);
          if (index !== -1) {
            const newState = [...prev];
            newState[index] = { ...newState[index], ...camelRecord };
            return newState;
          }
          return [...prev, camelRecord];
        });
      } else if (eventType === 'DELETE') {
        const id = oldRecord.id;
        setter((prev: any[]) => prev.filter(i => i.id !== id));
      }
    };

    const channel = supabase
      .channel('realtime-db')
      .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeChange)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [setters]);
};
