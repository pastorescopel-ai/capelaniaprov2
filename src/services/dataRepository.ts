import { supabase } from './supabaseClient';
import { TABLE_SCHEMAS, toCamel, cleanAndConvertToSnake, isValidUUID, COLLECTION_TO_TABLE } from '../utils/transformers';

const CONFIG_CACHE_KEY = 'capelania_pro_config_id';
const CONFIG_DATA_CACHE_KEY = 'capelania_pro_config_data';
export const SYNC_DATA_CACHE_KEY = 'app_data_cache';
export const SYNC_LAST_SYNC_KEY = 'last_sync_timestamp';

const GLOBAL_ID_CACHE: Record<string, string> = {
  app_config: typeof window !== 'undefined' ? localStorage.getItem(CONFIG_CACHE_KEY) || '' : ''
};

const handleSupabaseError = (error: any, context: string) => {
  console.error(`[DataRepository] Erro em ${context}:`, error);
  return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
};

export const DataRepository = {
  async fetchFullTable(tableName: string, maxRows = 100000, since?: string) {
    if (!supabase) return { data: [], error: null };
    
    let query = supabase.from(tableName).select('*');
    if (since) query = query.gte('updated_at', since);
    
    // Primeira busca para ver se precisamos paginar
    const { data: firstBatch, error: firstError } = await query.range(0, 999);
      
    if (firstError) return handleSupabaseError(firstError, `fetchFullTable(${tableName}) - first batch`);
    if (!firstBatch || firstBatch.length < 1000) return { data: firstBatch || [], error: null };
    
    // Se atingiu 1000, precisamos buscar mais
    let allData = [...firstBatch];
    let from = 1000;
    const step = 1000;
    let hasMore = true;
    
    while (hasMore && allData.length < maxRows) {
      let paginationQuery = supabase.from(tableName).select('*');
      if (since) paginationQuery = paginationQuery.gte('updated_at', since);
      
      const { data, error } = await paginationQuery.range(from, from + step - 1);
        
      if (error) {
        return handleSupabaseError(error, `fetchFullTable(${tableName}) - pagination at ${from}`);
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

  async syncAll(forceRefresh = false) {
    if (!supabase) return null;
    
    const lastSync = localStorage.getItem(SYNC_LAST_SYNC_KEY);
    
    // Se sincronizou há menos de 1 minuto, retorna cache (evita spam de requests)
    if (!forceRefresh && lastSync && Date.now() - parseInt(lastSync) < 60000) {
        const cached = localStorage.getItem(SYNC_DATA_CACHE_KEY);
        if (cached) return JSON.parse(cached);
    }

    try {
      const MAX_ROWS = 49999;
      const lastSyncISO = (!forceRefresh && lastSync) ? new Date(parseInt(lastSync)).toISOString() : undefined;

      // Mapeamento de coleções para tabelas
      const syncMap = [
        { key: 'users', table: 'users' },
        { key: 'bibleStudies', table: 'bible_study_sessions' },
        { key: 'bibleClasses', table: 'bible_classes' },
        { key: 'smallGroups', table: 'small_group_sessions' },
        { key: 'staffVisits', table: 'staff_visits' },
        { key: 'visitRequests', table: 'visit_requests' },
        { key: 'proSectors', table: 'pro_sectors' },
        { key: 'proStaff', table: 'pro_staff' },
        { key: 'proPatients', table: 'pro_patients' },
        { key: 'proProviders', table: 'pro_providers' },
        { key: 'proGroups', table: 'pro_groups' },
        { key: 'proGroupLocations', table: 'pro_group_locations' },
        { key: 'proGroupMembers', table: 'pro_group_members' },
        { key: 'proGroupProviderMembers', table: 'pro_group_provider_members' },
        { key: 'bibleClassAttendees', table: 'bible_class_attendees' },
        { key: 'activitySchedules', table: 'activity_schedules' },
        { key: 'dailyActivityReports', table: 'daily_activity_reports' },
        { key: 'proMonthlyStats', table: 'pro_monthly_stats', max: 99999 },
        { key: 'proHistoryRecords', table: 'pro_history_records', max: 199999 },
        { key: 'ambassadors', table: 'ambassadors' },
        { key: 'editAuthorizations', table: 'edit_authorizations' }
      ];

      // Executa as queries em paralelo
      const promises = syncMap.map(item => 
        DataRepository.fetchFullTable(item.table, item.max || MAX_ROWS, lastSyncISO)
      );
      
      // Adiciona app_config separadamente (sempre fetch full ou single)
      promises.push(supabase.from('app_config').select('*').limit(1));

      const results = await Promise.all(promises);
      const configRes = results[results.length - 1];
      const tableResults = results.slice(0, results.length - 1);

      // Carregar cache anterior para o Delta Sync
      const previousCache = lastSync ? JSON.parse(localStorage.getItem(SYNC_DATA_CACHE_KEY) || '{}') : {};
      const newResult: any = { ...previousCache };

      // Processar resultados das tabelas
      tableResults.forEach((res, idx) => {
        const { key } = syncMap[idx];
        if (res && 'data' in res && res.data) {
          const newData = toCamel(res.data);
          
          if (lastSyncISO && previousCache[key]) {
            // Delta Sync: Mesclar novos dados com o cache
            const merged = [...previousCache[key]];
            newData.forEach((newItem: any) => {
              const index = merged.findIndex((i: any) => i.id === newItem.id);
              if (index !== -1) {
                merged[index] = newItem;
              } else {
                merged.push(newItem);
              }
            });
            newResult[key] = merged;
          } else {
            newResult[key] = newData;
          }
        } else if (!newResult[key]) {
          newResult[key] = [];
        }
      });

      // Processar Config
      if (configRes && 'data' in configRes && configRes.data?.[0]?.id) {
        const configData = toCamel(configRes.data[0]);
        newResult.config = configData;
        const configId = configData.id;
        GLOBAL_ID_CACHE['app_config'] = configId;
        if (typeof window !== 'undefined') {
          localStorage.setItem(CONFIG_CACHE_KEY, configId);
          localStorage.setItem(CONFIG_DATA_CACHE_KEY, JSON.stringify(configData));
        }
      }

      // Lógica de Alunos em Classes Bíblicas (Denormalização em memória)
      const classes = newResult.bibleClasses || [];
      const attendees = newResult.bibleClassAttendees || [];
      
      classes.forEach((cls: any) => {
          cls.students = attendees
            .filter((a: any) => a.classId === cls.id)
            .map((a: any) => {
                const id = a.staffId || a.participantId;
                if (id && !String(a.studentName).includes(`(${id})`)) {
                    return `${a.studentName} (${id})`;
                }
                return a.studentName;
            });
      });

      newResult.bibleClasses = classes;
      
      localStorage.setItem(SYNC_DATA_CACHE_KEY, JSON.stringify(newResult));
      localStorage.setItem(SYNC_LAST_SYNC_KEY, Date.now().toString());
      
      return newResult;
    } catch (error) {
      return null;
    }
  },

  async upsertRecord(collection: string, item: any): Promise<{ success: boolean; data?: any[] }> {
    if (!supabase) return { success: false };
    const items = Array.isArray(item) ? item : [item];
    if (items.length === 0) return { success: true, data: [] };

    const tableName = COLLECTION_TO_TABLE[collection];
    if (!tableName) return { success: false };
    
    console.log(`[DataRepository] Upserting to ${tableName}:`, items);

    // Garantir que temos IDs para todos os itens antes de converter para snake_case
    // Isso é vital para coleções que dependem do ID para salvar dados em tabelas relacionadas (ex: bibleClasses)
    items.forEach(i => {
      if ((i.id === undefined || i.id === null || i.id === '') && tableName !== 'visit_requests' && !tableName.startsWith('pro_')) {
        i.id = crypto.randomUUID();
      }
    });

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
        
        // Se for app_config, garantir o ID
        if (tableName === 'app_config' && chunk.length > 0) {
           if (GLOBAL_ID_CACHE[tableName]) {
             chunk[0].id = GLOBAL_ID_CACHE[tableName];
           } else {
             const { data } = await supabase.from(tableName).select('id').limit(1);
             if (data && data.length > 0) {
               chunk[0].id = data[0].id;
               GLOBAL_ID_CACHE[tableName] = data[0].id;
               if (typeof window !== 'undefined') localStorage.setItem(CONFIG_CACHE_KEY, data[0].id);
             }
           }
        }

        const query = isUpsert ? supabase.from(tableName).upsert(chunk) : supabase.from(tableName).insert(chunk);
        const { data, error } = await query.select();
        
        if (error) {
          console.error(`[DataRepository] Erro detalhado do Supabase em ${tableName}:`, {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            payload: chunk
          });
          return false;
        }
        if (data) {
          allUpsertedData.push(...toCamel(data));
        }
      }
      localStorage.removeItem(SYNC_LAST_SYNC_KEY);
      localStorage.removeItem('app_data_cache');
      localStorage.removeItem('last_sync_timestamp');
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
                // 1. Buscar participantes atuais no banco para fazer o "diff"
                const { data: currentAttendees, error: fetchError } = await supabase
                    .from('bible_class_attendees')
                    .select('id, student_name')
                    .eq('class_id', cls.id);
                
                if (fetchError) {
                    console.error("Erro ao buscar participantes atuais:", fetchError);
                    continue;
                }

                const currentNames = (currentAttendees || []).map(a => a.student_name);
                const newNames = originalItem.students;

                // 2. Identificar o que adicionar e o que remover
                const namesToAdd = newNames.filter(name => !currentNames.includes(name));
                const idsToRemove = (currentAttendees || [])
                    .filter(a => !newNames.includes(a.student_name))
                    .map(a => a.id);

                // 3. Remover os que saíram
                if (idsToRemove.length > 0) {
                    const { error: delError } = await supabase
                        .from('bible_class_attendees')
                        .delete()
                        .in('id', idsToRemove);
                    if (delError) console.error("Erro ao remover participantes:", delError);
                }

                // 4. Adicionar os novos
                if (namesToAdd.length > 0) {
                    const attendeesPayload = namesToAdd.map((name: string) => {
                        const match = name.match(/\(([^)]+)\)$/);
                        const extractedId = match ? match[1].trim() : null;
                        
                        const pType = originalItem.participantType || cls.participantType || 'Colaborador';
                        const isStaff = pType === 'Colaborador';
                        const staffId = isStaff ? extractedId : null;
                        const participantId = !isStaff ? extractedId : null;

                        let cycleMonth = null;
                        if (cls.date) {
                            const d = new Date(cls.date + (cls.date.includes('T') ? '' : 'T12:00:00'));
                            if (!isNaN(d.getTime())) {
                                cycleMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
                            }
                        }

                        return {
                            class_id: cls.id,
                            student_name: name,
                            staff_id: staffId,
                            participant_id: participantId,
                            date: cls.date,
                            cycle_month: cycleMonth,
                            unit: cls.unit
                        };
                    });

                    const cleanPayload = attendeesPayload.map(p => cleanAndConvertToSnake(p, TABLE_SCHEMAS['bible_class_attendees'], 'bible_class_attendees'));
                    const { error: insError } = await supabase.from('bible_class_attendees').insert(cleanPayload);
                    if (insError) console.error("Erro ao inserir novos participantes:", insError);
                }
            }
        }
    }

    if (collection === 'config' && allUpsertedData.length > 0) {
        if (typeof window !== 'undefined') {
            localStorage.setItem(CONFIG_DATA_CACHE_KEY, JSON.stringify(allUpsertedData[0]));
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
    
    console.log(`[DataRepository] Tentando deletar: collection=${collection}, tableName=${tableName}, id=${id}`);
    
    // IDs numéricos (nas tabelas PRO) podem ser passados como string, o Postgres faz o cast na query
    if (!tableName.startsWith('pro_') && !tableName.startsWith('visit_requests') && !isValidUUID(id)) {
        console.warn(`[DataRepository] ID inválido para deleção: ${id}`);
        return false;
    }
    
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
        console.error(`[DataRepository] Erro no Supabase ao deletar:`, error);
    } else {
        localStorage.removeItem('app_data_cache');
        localStorage.removeItem('last_sync_timestamp');
    }
    return !error;
  },

  async deleteRecordsByFilter(collection: string, filters: Record<string, any>) {
    if (!supabase) return false;
    const tableName = COLLECTION_TO_TABLE[collection];
    if (!tableName) return false;

    let query = supabase.from(tableName).delete();
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'object' && value !== null) {
        if (value.gt) query = query.gt(key, value.gt);
        else if (value.lt) query = query.lt(key, value.lt);
        else if (value.neq) query = query.neq(key, value.neq);
        else query = query.eq(key, value);
      } else {
        query = query.eq(key, value);
      }
    }

    const { error } = await query;
    if (error) console.error(`Erro ao deletar registros filtrados em ${tableName}:`, error);
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
