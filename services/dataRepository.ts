import { supabase } from './supabaseClient';
import { TABLE_SCHEMAS, toCamel, cleanAndConvertToSnake, isValidUUID, COLLECTION_TO_TABLE } from '../utils/transformers';

const GLOBAL_ID_CACHE: Record<string, string> = {};

export const DataRepository = {
  async fetchFullTable(tableName: string, maxRows = 100000) {
    if (!supabase) return { data: [], error: null };
    
    // Primeira busca para ver se precisamos paginar
    const { data: firstBatch, error: firstError } = await supabase
      .from(tableName)
      .select('*')
      .range(0, 999);
      
    if (firstError) return { data: [], error: firstError };
    if (!firstBatch || firstBatch.length < 1000) return { data: firstBatch || [], error: null };
    
    // Se atingiu 1000, precisamos buscar mais
    let allData = [...firstBatch];
    let from = 1000;
    const step = 1000;
    let hasMore = true;
    
    while (hasMore && allData.length < maxRows) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, from + step - 1);
        
      if (error) {
        console.error(`Erro ao paginar ${tableName}:`, error);
        return { data: allData, error };
      }
      if (data) {
        allData = [...allData, ...data];
        if (data.length < step) hasMore = false;
        else from += step;
      } else {
        hasMore = false;
      }
    }
    return { data: allData, error: null };
  },

  async syncAll() {
    if (!supabase) return null;
    try {
      const MAX_ROWS = 49999;

      // Executa as queries em paralelo, mas trata erros individualmente para não quebrar o app todo
      const results = await Promise.all([
        DataRepository.fetchFullTable('users', MAX_ROWS),
        DataRepository.fetchFullTable('bible_study_sessions', MAX_ROWS),
        DataRepository.fetchFullTable('bible_classes', MAX_ROWS),
        DataRepository.fetchFullTable('small_groups', MAX_ROWS),
        DataRepository.fetchFullTable('staff_visits', MAX_ROWS),
        DataRepository.fetchFullTable('visit_requests', MAX_ROWS),
        supabase.from('app_config').select('*').limit(1),
        DataRepository.fetchFullTable('pro_sectors', MAX_ROWS),
        DataRepository.fetchFullTable('pro_staff', MAX_ROWS),
        DataRepository.fetchFullTable('pro_patients', MAX_ROWS),
        DataRepository.fetchFullTable('pro_providers', MAX_ROWS),
        DataRepository.fetchFullTable('pro_groups', MAX_ROWS),
        DataRepository.fetchFullTable('pro_group_locations', MAX_ROWS),
        DataRepository.fetchFullTable('pro_group_members', MAX_ROWS),
        DataRepository.fetchFullTable('pro_group_provider_members', MAX_ROWS),
        DataRepository.fetchFullTable('bible_class_attendees', MAX_ROWS),
        DataRepository.fetchFullTable('activity_schedules', MAX_ROWS),
        DataRepository.fetchFullTable('daily_activity_reports', MAX_ROWS),
        DataRepository.fetchFullTable('pro_monthly_stats', 99999), // Limite maior para histórico
        DataRepository.fetchFullTable('pro_history_records', 199999), // Limite muito maior para histórico detalhado
        DataRepository.fetchFullTable('ambassadors', MAX_ROWS),
        DataRepository.fetchFullTable('edit_authorizations', MAX_ROWS)
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

    const processBatch = async (batch: any[], isUpsert: boolean) => {
      if (batch.length === 0) return true;
      
      const CHUNK_SIZE = 100;
      for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
        const chunk = batch.slice(i, i + CHUNK_SIZE);
        console.log(`[DEBUG Supabase] Enviando chunk para ${tableName} (${isUpsert ? 'UPSERT' : 'INSERT'}):`, chunk);
        
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

        const query = isUpsert ? supabase.from(tableName).upsert(chunk) : supabase.from(tableName).insert(chunk);
        const { data, error } = await query.select();
        
        if (error) {
          const errorDetails = {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            tableName,
            payloadSent: chunk
          };
          console.error(`ERRO CRÍTICO no Supabase (${tableName}):`, errorDetails);
          
          // Tentar extrair mais informações se for erro de tipo ou constraint
          if (error.code === '23502') { // NOT NULL violation
             console.error(`DICA: Coluna obrigatória ausente em ${tableName}. Verifique o payload.`);
          }
          
          return false;
        }
        if (data) {
          allUpsertedData.push(...toCamel(data));
        }
      }
      return true;
    };

    const successWithId = await processBatch(withId, true);
    if (!successWithId) return { success: false };

    const successWithoutId = await processBatch(withoutId, false);
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

  async deleteRecordsByFilter(collection: string, filters: Record<string, any>) {
    if (!supabase) return false;
    const tableName = COLLECTION_TO_TABLE[collection];
    if (!tableName) return false;

    let query = supabase.from(tableName).delete();
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { error } = await query;
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
