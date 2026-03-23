import { supabase } from './supabaseClient';
import { TABLE_SCHEMAS, toCamel, cleanAndConvertToSnake, isValidUUID, COLLECTION_TO_TABLE } from '../utils/transformers';

const GLOBAL_ID_CACHE: Record<string, string> = {};

export const DataRepository = {
  async syncAll() {
    if (!supabase) return null;
    try {
      const MAX_ROWS = 9999;

      // Executa as queries em paralelo, mas trata erros individualmente para não quebrar o app todo
      const results = await Promise.all([
        supabase.from('users').select('*').range(0, MAX_ROWS),
        supabase.from('bible_study_sessions').select('*').range(0, MAX_ROWS),
        supabase.from('bible_classes').select('*').range(0, MAX_ROWS),
        supabase.from('small_groups').select('*').range(0, MAX_ROWS),
        supabase.from('staff_visits').select('*').range(0, MAX_ROWS),
        supabase.from('visit_requests').select('*').range(0, MAX_ROWS),
        supabase.from('app_config').select('*').limit(1),
        supabase.from('pro_sectors').select('*').range(0, MAX_ROWS),
        supabase.from('pro_staff').select('*').range(0, MAX_ROWS),
        supabase.from('pro_patients').select('*').range(0, MAX_ROWS),
        supabase.from('pro_providers').select('*').range(0, MAX_ROWS),
        supabase.from('pro_groups').select('*').range(0, MAX_ROWS),
        supabase.from('pro_group_locations').select('*').range(0, MAX_ROWS),
        supabase.from('pro_group_members').select('*').range(0, MAX_ROWS),
        supabase.from('pro_group_provider_members').select('*').range(0, MAX_ROWS),
        supabase.from('bible_class_attendees').select('*').range(0, MAX_ROWS),
        supabase.from('activity_schedules').select('*').range(0, MAX_ROWS),
        supabase.from('daily_activity_reports').select('*').range(0, MAX_ROWS),
        supabase.from('pro_monthly_stats').select('*').range(0, MAX_ROWS),
        supabase.from('pro_history_records').select('*').range(0, MAX_ROWS),
        supabase.from('ambassadors').select('*').range(0, MAX_ROWS),
        supabase.from('edit_authorizations').select('*').range(0, MAX_ROWS)
      ]);

      const [u, bs, bc, sg, sv, vr, c, ps, pst, pp, pr, pg, pgl, pgm, pgpm, bca, asch, dar, pms, phr, amb, ea] = results;

      // Log de erros para debug (invisível ao usuário)
      results.forEach((res, idx) => {
        if (res.error) {
          console.error(`Query ${idx} falhou:`, res.error.message);
        }
      });

      if (c.data?.[0]?.id) GLOBAL_ID_CACHE['app_config'] = c.data[0].id;

      const classes = toCamel(bc.data || []);
      const attendees = toCamel(bca.data || []);
      
      classes.forEach((cls: any) => {
          cls.students = attendees
            .filter((a: any) => a.classId === cls.id)
            .map((a: any) => a.studentName);
      });

      return {
        users: toCamel(u.data || []),
        bibleStudies: toCamel(bs.data || []),
        bibleClasses: classes, 
        smallGroups: toCamel(sg.data || []),
        staffVisits: toCamel(sv.data || []),
        visitRequests: toCamel(vr.data || []),
        config: c.data && c.data.length > 0 ? toCamel(c.data[0]) : null,
        proSectors: toCamel(ps.data || []),
        proStaff: toCamel(pst.data || []),
        proPatients: toCamel(pp.data || []),
        proProviders: toCamel(pr.data || []),
        proGroups: toCamel(pg.data || []),
        proGroupLocations: toCamel(pgl.data || []),
        proGroupMembers: toCamel(pgm.data || []),
        proGroupProviderMembers: toCamel(pgpm.data || []),
        activitySchedules: toCamel(asch.data || []),
        dailyActivityReports: toCamel(dar.data || []),
        bibleClassAttendees: attendees,
        proMonthlyStats: toCamel(pms.data || []),
        proHistoryRecords: toCamel(phr.data || []),
        ambassadors: toCamel(amb.data || []),
        editAuthorizations: toCamel(ea.data || [])
      };
    } catch (error) {
      console.error("Erro fatal ao sincronizar com Supabase:", error);
      return null;
    }
  },

  async upsertRecord(collection: string, item: any): Promise<{ success: boolean; data?: any[] }> {
    if (!supabase) return { success: false };
    const items = Array.isArray(item) ? item : [item];
    if (items.length === 0) return { success: true, data: [] };

    const tableName = COLLECTION_TO_TABLE[collection];
    if (!tableName) return { success: false };

    const payloads = items.map(i => cleanAndConvertToSnake(i, TABLE_SCHEMAS[tableName], tableName));

    // Separar em dois grupos: os que têm ID (Updates/Upserts) e os que não têm (Inserts puros)
    // Isso evita que o Postgrest preencha com 'null' o campo ID em um array misto
    const withId = payloads.filter(p => p.id !== undefined && p.id !== null);
    const withoutId = payloads.filter(p => p.id === undefined || p.id === null);

    const allUpsertedData: any[] = [];

    const processBatch = async (batch: any[]) => {
      if (batch.length === 0) return true;
      
      const CHUNK_SIZE = 100;
      for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
        const chunk = batch.slice(i, i + CHUNK_SIZE);
        
        // Se for app_config, garantir o ID
        if (tableName === 'app_config' && chunk.length > 0) {
           if (GLOBAL_ID_CACHE[tableName]) {
             chunk[0].id = GLOBAL_ID_CACHE[tableName];
           } else {
             const { data } = await supabase.from(tableName).select('id').limit(1);
             if (data && data.length > 0) {
               chunk[0].id = data[0].id;
               GLOBAL_ID_CACHE[tableName] = data[0].id;
             }
           }
        }

        const { data, error } = await supabase.from(tableName).upsert(chunk).select();
        
        if (error) {
          console.error(`ERRO CRÍTICO no Supabase (${tableName}):`, {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            payloadSent: chunk
          });
          return false;
        }
        if (data) {
          allUpsertedData.push(...toCamel(data));
        }
      }
      return true;
    };

    const successWithId = await processBatch(withId);
    if (!successWithId) return { success: false };

    const successWithoutId = await processBatch(withoutId);
    if (!successWithoutId) return { success: false };

    if (collection === 'bibleClasses') {
        // For bibleClasses, we need to ensure the students are attached to the returned objects
        // since they are stored in a separate table.
        for (const cls of allUpsertedData) {
            const originalItem = items.find(i => i.id === cls.id);
            if (originalItem && originalItem.students) {
                cls.students = originalItem.students;
            }
            
            if (cls.id && originalItem && originalItem.students && Array.isArray(originalItem.students)) {
                const { error: delError } = await supabase.from('bible_class_attendees').delete().eq('class_id', cls.id);
                if (delError) console.error("Erro ao limpar participantes antigos:", delError);

                const attendeesPayload = originalItem.students.map((name: string) => {
                    const match = name.match(/\((\d+)\)$/);
                    const staffId = match ? match[1] : null;
                    return {
                        class_id: cls.id,
                        student_name: name,
                        staff_id: staffId
                    };
                });

                if (attendeesPayload.length > 0) {
                    const cleanPayload = attendeesPayload.map(p => cleanAndConvertToSnake(p, TABLE_SCHEMAS['bible_class_attendees'], 'bible_class_attendees'));
                    const { error: insError } = await supabase.from('bible_class_attendees').insert(cleanPayload);
                    if (insError) console.error("Erro ao inserir novos participantes:", insError);
                }
            }
        }
    }

    return { success: true, data: allUpsertedData };
  },

  async getUserByEmail(email: string) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    
    if (error || !data) return null;
    return toCamel(data);
  },

  async deleteRecord(collection: string, id: string) {
    if (!supabase) return false;
    const tableName = COLLECTION_TO_TABLE[collection];
    if (!tableName) return false;
    
    // IDs numéricos (nas tabelas PRO) podem ser passados como string, o Postgres faz o cast na query
    if (!tableName.startsWith('pro_') && !tableName.startsWith('visit_requests') && !isValidUUID(id)) return false;
    
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    return !error;
  },

  async closeMonth(month: string, unit: string, stats: any, membersList: any[]) {
    const record = {
      month,
      unit,
      type: 'pg',
      targetId: 'all',
      totalStaff: stats.totalStaff,
      totalParticipants: stats.totalParticipants,
      percentage: stats.percentage,
      goal: stats.goal,
      snapshotData: JSON.stringify({
        totalColaboradores: stats.totalStaff,
        setorBreakdown: stats.sectorBreakdown,
        performanceMetrics: stats.performanceMetrics,
        membersList: membersList
      })
    };

    return await this.upsertRecord('proMonthlyStats', record);
  }
};
