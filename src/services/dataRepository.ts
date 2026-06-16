import { supabase } from './supabaseClient';
import { TABLE_SCHEMAS, toCamel, cleanAndConvertToSnake, isValidUUID, COLLECTION_TO_TABLE } from '../utils/transformers';

const CACHE_KEY = 'capelania_pro_config_id';
const DATA_CACHE_KEY = 'capelania_pro_config_data';

const MEMORY_CACHE: Record<string, any> = {};

function safeSetLocalStorage(key: string, value: any, tableName: string) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (e: any) {
    // Registra temporariamente no cache de memória local para a sessão atual
    MEMORY_CACHE[key] = value;
    
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // Mensagem explicativa e amigável uma única vez
      if (typeof window !== 'undefined' && !(window as any).__quotaExceededLogged) {
        (window as any).__quotaExceededLogged = true;
        console.info(
          `[Capelania OS] ℹ️ Cota de armazenamento local offline do navegador excedida (~5MB atingidos). ` +
          `Os dados excedentes de tabelas históricas de auditoria foram direcionados ao cache de memória temporária com sucesso.`
        );
      }
      
      // Limpa dados antigos ou não-críticos do localStorage para tentar abrir espaço para configurações críticas
      const heavyTables = ['pro_history_records', 'pro_monthly_stats', 'staff_visits', 'bible_class_attendees'];
      if (heavyTables.includes(tableName)) {
        try {
          localStorage.removeItem(`capelania_offline_${tableName}`);
        } catch (err: any) {
          if (console.debug) {
            console.debug("Item já removido do localStorage:", err.message);
          }
        }
      }
    } else {
      console.warn(`[DataRepository] Falha ao salvar cache para ${tableName}:`, e);
    }
  }
}

function safeGetLocalStorage(key: string, tableName: string): any {
  if (MEMORY_CACHE[key] !== undefined) {
    return MEMORY_CACHE[key];
  }
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn(`[DataRepository] Erro ao carregar cache do localStorage para ${tableName}:`, e);
  }
  return null;
}

const GLOBAL_ID_CACHE: Record<string, string> = {
  app_config: typeof window !== 'undefined' ? (() => {
    try {
      return localStorage.getItem(CACHE_KEY) || '';
    } catch (_) {
      return '';
    }
  })() : ''
};

export const DataRepository = {
  async fetchFullTable(tableName: string, maxRows = 100000) {
    if (!supabase) {
      const cached = safeGetLocalStorage(`capelania_offline_${tableName}`, tableName);
      if (cached) return { data: cached, error: null };
      return { data: null, error: null };
    }
    
    try {
      // Primeira busca para ver se precisamos paginar
      const { data: firstBatch, error: firstError } = await supabase
        .from(tableName)
        .select('*')
        .range(0, 999);
        
      if (firstError) {
        const errMsg = firstError.message || String(firstError);
        const isNetworkErr = 
          errMsg.includes('fetch') || 
          errMsg.includes('Failed to fetch') || 
          errMsg.includes('NetworkError') || 
          !navigator.onLine;

        // Se houver falha de fetch (ex: sem internet), tenta carregar do cache local
        if (isNetworkErr) {
          const cached = safeGetLocalStorage(`capelania_offline_${tableName}`, tableName);
          if (cached) {
            console.log(`[DataRepository] 📶 Rede offline. Carregado do cache de contingência para: ${tableName}`);
            return { data: cached, error: null };
          }
          console.warn(`[DataRepository] Rede offline ao buscar primeira página de ${tableName} (sem cache):`, errMsg);
        } else {
          console.error(`[DataRepository] Erro ao buscar primeira página de ${tableName}:`, firstError);
        }
        return { data: null, error: firstError };
      }
      
      if (!firstBatch || firstBatch.length < 1000) {
        const result = firstBatch || [];
        safeSetLocalStorage(`capelania_offline_${tableName}`, result, tableName);
        return { data: result, error: null };
      }
      
      // Se atingiu 1000, precisamos buscar mais
      let allData = [...firstBatch];
      let from = 1000;
      const step = 1000;
      let hasMore = true;
      
      while (hasMore && allData.length < maxRows) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, from + step - 1);
            
          if (error) {
            const errMsg = error.message || String(error);
            const isNetworkErr = 
              errMsg.includes('fetch') || 
              errMsg.includes('Failed to fetch') || 
              errMsg.includes('NetworkError') || 
              !navigator.onLine;

            if (isNetworkErr) {
              console.warn(`[DataRepository] Rede offline durante paginação de ${tableName} no range ${from}-${from + step - 1}:`, errMsg);
            } else {
              console.error(`[DataRepository] Erro ao paginar ${tableName} no range ${from}-${from + step - 1}:`, error);
            }
            hasMore = false;
            break;
          }
          if (data) {
            allData = [...allData, ...data];
            if (data.length < step) hasMore = false;
            else from += step;
          } else {
            hasMore = false;
          }
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          const isNetworkErr = 
            errMsg.includes('fetch') || 
            errMsg.includes('Failed to fetch') || 
            errMsg.includes('NetworkError') || 
            !navigator.onLine;

          if (isNetworkErr) {
            console.warn(`[DataRepository] Rede offline (exceção) na paginação de ${tableName}:`, errMsg);
          } else {
            console.error(`[DataRepository] Exceção na paginação de ${tableName}:`, err);
          }
          hasMore = false;
          break;
        }
      }
      
      safeSetLocalStorage(`capelania_offline_${tableName}`, allData, tableName);
      
      if (tableName === 'visit_requests') {
         console.log(`[DEBUG DataRepository - VISIT_REQUESTS] Fetch concluído, total recebido: ${allData.length}`);
      }
      return { data: allData, error: null };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isNetworkErr = 
        errMsg.includes('fetch') || 
        errMsg.includes('Failed to fetch') || 
        errMsg.includes('NetworkError') || 
        !navigator.onLine;

      if (isNetworkErr) {
        console.warn(`[DataRepository] Rede offline ao ler ${tableName} (exceção fatal), buscando cache de contingência:`, errMsg);
      } else {
        console.warn(`[DataRepository] Exceção fatal ao ler ${tableName}, buscando cache contingência:`, err);
      }
      const cached = safeGetLocalStorage(`capelania_offline_${tableName}`, tableName);
      if (cached) {
        return { data: cached, error: null };
      }
      return { data: null, error: err };
    }
  },

  async syncAll() {
    if (!supabase) return null;
    try {
      const MAX_ROWS = 49999;

      // Executa as queries em paralelo, mas trata erros individualmente e previne rejeição do Promise.all
      const results = await Promise.all([
        DataRepository.fetchFullTable('users', MAX_ROWS),
        DataRepository.fetchFullTable('bible_study_sessions', MAX_ROWS),
        DataRepository.fetchFullTable('bible_classes', MAX_ROWS),
        DataRepository.fetchFullTable('small_group_sessions', MAX_ROWS),
        DataRepository.fetchFullTable('staff_visits', MAX_ROWS),
        DataRepository.fetchFullTable('visit_requests', MAX_ROWS),
        (async () => {
          try {
            return await supabase.from('app_config').select('*').limit(1);
          } catch (err: any) {
            return { data: null, error: err };
          }
        })(),
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
        DataRepository.fetchFullTable('pro_monthly_stats', 99999), 
        DataRepository.fetchFullTable('pro_history_records', 199999), 
        DataRepository.fetchFullTable('ambassadors', MAX_ROWS),
        DataRepository.fetchFullTable('edit_authorizations', MAX_ROWS)
      ]);

      const [u, bs, bc, sg, sv, vr, c, ps, pst, pp, pr, pg, pgl, pgm, pgpm, bca, asch, dar, pms, phr, amb, ea ] = results;

      // Log de erros para debug (invisível ao usuário)
      results.forEach((res, idx) => {
        if (res.error) {
          const errMsg = res.error.message || String(res.error);
          const isNetworkErr = 
            errMsg.includes('fetch') || 
            errMsg.includes('Failed to fetch') || 
            errMsg.includes('NetworkError') || 
            !navigator.onLine;

          if (isNetworkErr) {
            console.warn(`Query transiente/offline ${idx} em andamento:`, errMsg);
          } else {
            console.error(`Query ${idx} falhou:`, errMsg);
          }
        }
      });

      if (c.data?.[0]?.id) {
        const configId = c.data[0].id;
        GLOBAL_ID_CACHE['app_config'] = configId;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(CACHE_KEY, configId);
            localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(toCamel(c.data[0])));
          } catch (e: any) {
            MEMORY_CACHE[CACHE_KEY] = configId;
            MEMORY_CACHE[DATA_CACHE_KEY] = toCamel(c.data[0]);
          }
        }
      }

      const classes = bc.data ? toCamel(bc.data) : null;
      const attendees = bca.data ? toCamel(bca.data) : null;
      
      if (classes && attendees) {
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
      }

      return {
        users: u.data ? toCamel(u.data) : null,
        bibleStudies: bs.data ? toCamel(bs.data) : null,
        bibleClasses: classes, 
        smallGroups: sg.data ? toCamel(sg.data) : null,
        staffVisits: sv.data ? toCamel(sv.data) : null,
        visitRequests: vr.data ? toCamel(vr.data) : null,
        config: c.data && c.data.length > 0 ? toCamel(c.data[0]) : null,
        proSectors: ps.data ? toCamel(ps.data) : null,
        proStaff: pst.data ? toCamel(pst.data) : null,
        proPatients: pp.data ? toCamel(pp.data) : null,
        proProviders: pr.data ? toCamel(pr.data) : null,
        proGroups: pg.data ? toCamel(pg.data) : null,
        proGroupLocations: pgl.data ? toCamel(pgl.data) : null,
        proGroupMembers: pgm.data ? toCamel(pgm.data) : null,
        proGroupProviderMembers: pgpm.data ? toCamel(pgpm.data) : null,
        activitySchedules: asch.data ? toCamel(asch.data) : null,
        dailyActivityReports: dar.data ? toCamel(dar.data) : null,
        bibleClassAttendees: attendees,
        proMonthlyStats: pms.data ? toCamel(pms.data) : null,
        proHistoryRecords: phr.data ? toCamel(phr.data) : null,
        ambassadors: amb.data ? toCamel(amb.data) : null,
        editAuthorizations: ea.data ? toCamel(ea.data) : null
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

    // Garantir que temos IDs para todos os itens antes de converter para snake_case
    // Isso é vital para coleções que dependem do ID para salvar dados em tabelas relacionadas (ex: bibleClasses)
    items.forEach(i => {
      if ((i.id === undefined || i.id === null || i.id === '') && tableName !== 'visit_requests' && !tableName.startsWith('pro_')) {
        i.id = crypto.randomUUID();
      }
    });

    const payloads = items.map(i => cleanAndConvertToSnake(i, TABLE_SCHEMAS[tableName], tableName));
    console.log(`[DEBUG DataRepository] Payloads preparados para ${tableName}:`, payloads);
    if (tableName === 'visit_requests') {
       console.log(`[DEBUG DataRepository - VISIT_REQUESTS] IDs enviados:`, payloads.map(p => p.id));
    }

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
               if (typeof window !== 'undefined') localStorage.setItem(CACHE_KEY, data[0].id);
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
            try {
                localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(allUpsertedData[0]));
            } catch (e: any) {
                MEMORY_CACHE[DATA_CACHE_KEY] = allUpsertedData[0];
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
