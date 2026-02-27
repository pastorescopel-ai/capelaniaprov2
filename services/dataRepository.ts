import { supabase } from './supabaseClient';
import { TABLE_SCHEMAS, toCamel, cleanAndConvertToSnake, isValidUUID } from '../utils/transformers';

const GLOBAL_ID_CACHE: Record<string, string> = {};

export const DataRepository = {
  async syncAll() {
    if (!supabase) return null;
    try {
      const MAX_ROWS = 9999;

      const [u, bs, bc, sg, sv, vr, c, ps, pst, pp, pr, pg, pgl, pgm, pgpm, bca] = await Promise.all([
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
        supabase.from('bible_class_attendees').select('*').range(0, MAX_ROWS)
      ]);

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
        proGroupProviderMembers: toCamel(pgpm.data || [])
      };
    } catch (error) {
      console.error("Erro ao sincronizar com Supabase:", error);
      return null;
    }
  },

  async upsertRecord(collection: string, item: any) {
    if (!supabase) return false;
    const items = Array.isArray(item) ? item : [item];
    if (items.length === 0) return true;

    const tableMap: Record<string, string> = {
      bibleStudies: 'bible_study_sessions', bibleClasses: 'bible_classes',
      smallGroups: 'small_groups', staffVisits: 'staff_visits',
      users: 'users', config: 'app_config',
      visitRequests: 'visit_requests',
      proSectors: 'pro_sectors', proStaff: 'pro_staff', 
      proPatients: 'pro_patients', proProviders: 'pro_providers',
      proGroups: 'pro_groups', proGroupLocations: 'pro_group_locations',
      proGroupMembers: 'pro_group_members', proGroupProviderMembers: 'pro_group_provider_members'
    };
    
    const tableName = tableMap[collection];
    if (!tableName) return false;

    const payloads = items.map(i => cleanAndConvertToSnake(i, TABLE_SCHEMAS[tableName], tableName));

    if (tableName === 'app_config') {
      if (GLOBAL_ID_CACHE[tableName]) {
        payloads[0].id = GLOBAL_ID_CACHE[tableName];
      } else {
        const { data } = await supabase.from(tableName).select('id').limit(1);
        if (data && data.length > 0) {
          payloads[0].id = data[0].id;
          GLOBAL_ID_CACHE[tableName] = data[0].id;
        } else {
          delete payloads[0].id;
        }
      }
    }

    const CHUNK_SIZE = 100;
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
      const chunk = payloads.slice(i, i + CHUNK_SIZE);
      console.log(`[DataRepo] Tentando UPSERT em ${tableName}:`, chunk);
      
      const { data, error } = await supabase.from(tableName).upsert(chunk).select();
      
      if (error) {
        console.error(`[DataRepo] ERRO CRÍTICO no Supabase (${tableName}):`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          payloadSent: chunk
        });
        return false;
      }
      console.log(`[DataRepo] Sucesso no UPSERT em ${tableName}. Resposta:`, data);
    }

    if (collection === 'bibleClasses') {
        for (const cls of items) {
            if (cls.id && cls.students && Array.isArray(cls.students)) {
                const { error: delError } = await supabase.from('bible_class_attendees').delete().eq('class_id', cls.id);
                if (delError) console.error("Erro ao limpar participantes antigos:", delError);

                const attendeesPayload = cls.students.map((name: string) => {
                    // Extrai ID numérico do padrão "Nome (123)"
                    const match = name.match(/\((\d+)\)$/);
                    const staffId = match ? match[1] : null;
                    return {
                        class_id: cls.id,
                        student_name: name,
                        staff_id: staffId // Envia como string numérica ou null, cleanAndConvertToSnake tratará
                    };
                });

                if (attendeesPayload.length > 0) {
                    // Processa payload para garantir que staff_id seja limpo/numérico
                    const cleanPayload = attendeesPayload.map(p => cleanAndConvertToSnake(p, TABLE_SCHEMAS['bible_class_attendees'], 'bible_class_attendees'));
                    const { error: insError } = await supabase.from('bible_class_attendees').insert(cleanPayload);
                    if (insError) console.error("Erro ao inserir novos participantes:", insError);
                }
            }
        }
    }

    return true;
  },

  async deleteRecord(collection: string, id: string) {
    if (!supabase) return false;
    const tableMap: Record<string, string> = {
      bibleStudies: 'bible_study_sessions', bibleClasses: 'bible_classes', smallGroups: 'small_groups', 
      staffVisits: 'staff_visits', users: 'users',
      visitRequests: 'visit_requests',
      proSectors: 'pro_sectors', proStaff: 'pro_staff', 
      proPatients: 'pro_patients', proProviders: 'pro_providers',
      proGroups: 'pro_groups', proGroupLocations: 'pro_group_locations',
      proGroupMembers: 'pro_group_members', proGroupProviderMembers: 'pro_group_provider_members'
    };
    const tableName = tableMap[collection];
    if (!tableName) return false;
    
    // IDs numéricos (nas tabelas PRO) podem ser passados como string, o Postgres faz o cast na query
    if (!tableName.startsWith('pro_') && !tableName.startsWith('visit_requests') && !isValidUUID(id)) return false;
    
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    return !error;
  }
};