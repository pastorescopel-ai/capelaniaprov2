import { supabase } from './supabaseClient';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, MasterLists, Config, VisitRequest, ProStaff, ProSector, ProGroup, ProGroupLocation, ProGroupMember } from '../types';

const TABLE_SCHEMAS: Record<string, string[]> = {
  users: ['id', 'name', 'email', 'password', 'role', 'profile_pic', 'updated_at'],
  bible_studies: ['id', 'user_id', 'date', 'unit', 'sector', 'name', 'whatsapp', 'status', 'participant_type', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'],
  bible_classes: ['id', 'user_id', 'date', 'unit', 'sector', 'status', 'participant_type', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'], // students removido (migrado para tabela filha)
  bible_class_attendees: ['id', 'class_id', 'student_name', 'staff_id', 'created_at'],
  small_groups: ['id', 'user_id', 'date', 'unit', 'sector', 'group_name', 'leader', 'leader_phone', 'shift', 'participants_count', 'observations', 'created_at', 'updated_at'],
  staff_visits: ['id', 'user_id', 'date', 'unit', 'sector', 'reason', 'staff_name', 'participant_type', 'provider_role', 'requires_return', 'return_date', 'return_completed', 'observations', 'created_at', 'updated_at'],
  visit_requests: ['id', 'pg_name', 'leader_name', 'leader_phone', 'unit', 'date', 'status', 'request_notes', 'preferred_chaplain_id', 'assigned_chaplain_id', 'chaplain_response', 'is_read', 'created_at', 'updated_at'],
  app_config: ['id', 'mural_text', 'header_line1', 'header_line2', 'header_line3', 'font_size1', 'font_size2', 'font_size3', 'report_logo_width', 'report_logo_x', 'report_logo_y', 'header_line1_x', 'header_line1_y', 'header_line2_x', 'header_line2_y', 'header_line3_x', 'header_line3_y', 'header_padding_top', 'header_text_align', 'primary_color', 'app_logo_url', 'report_logo_url', 'last_modified_by', 'last_modified_at', 'updated_at'],
  pro_sectors: ['id', 'name', 'unit', 'active'],
  pro_staff: ['id', 'name', 'sector_id', 'unit', 'whatsapp', 'active'],
  pro_patients: ['id', 'name', 'unit', 'whatsapp', 'last_lesson', 'updated_at'],
  pro_providers: ['id', 'name', 'unit', 'whatsapp', 'sector', 'updated_at'],
  pro_groups: ['id', 'name', 'current_leader', 'leader_phone', 'sector_id', 'unit', 'active'],
  pro_group_locations: ['id', 'group_id', 'sector_id', 'unit', 'created_at'],
  pro_group_members: ['id', 'group_id', 'staff_id', 'joined_at', 'left_at']
};

// Campos que devem ser tratados como números puros
const NUMERIC_FIELDS = ['font_size1', 'font_size2', 'font_size3', 'report_logo_width', 'report_logo_x', 'report_logo_y', 'header_line1_x', 'header_line1_y', 'header_line2_x', 'header_line2_y', 'header_line3_x', 'header_line3_y', 'header_padding_top', 'participants_count', 'last_modified_at', 'updated_at', 'created_at', 'joined_at', 'left_at', 'staff_id', 'sector_id', 'group_id'];

const GLOBAL_ID_CACHE: Record<string, string> = {};

/**
 * Validação rigorosa de UUID v4 (RFC4122)
 * Previne uso de IDs manuais antigos ou malformados
 */
const isValidUUID = (uuid: string) => {
  const s = "" + uuid;
  return s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
};

const keyCache: Record<string, string> = {};

const toCamel = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  
  const newObj: any = {};
  for (const key in obj) {
    if (key === 'password') {
      newObj['password'] = obj[key];
      continue;
    }
    
    // Converte chaves snake_case para camelCase
    if (!keyCache[key]) {
      let camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (camelKey.endsWith('Haba')) camelKey = camelKey.replace('Haba', 'HABA');
      else if (camelKey.endsWith('Hab')) camelKey = camelKey.replace('Hab', 'HAB');
      keyCache[key] = camelKey;
    }
    
    let val = obj[key];
    
    // BLINDAGEM DE INTEGRIDADE FRONT-END (V4.3):
    // Conversão Bidirecional Inteligente:
    // Se receber um ID numérico do banco (BIGINT), converte para string para o React.
    if ((key === 'id' || key.endsWith('_id')) && typeof val === 'number') {
        val = String(val);
    }

    newObj[keyCache[key]] = toCamel(val);
  }
  return newObj;
};

const cleanAndConvertToSnake = (obj: any, allowedFields: string[], tableName: string): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  for (const key in obj) {
    let snakeKey = key.includes('_') ? key : key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (snakeKey.endsWith('_h_a_b_a')) snakeKey = snakeKey.replace('_h_a_b_a', '_haba');
    else if (snakeKey.endsWith('_h_a_b')) snakeKey = snakeKey.replace('_h_a_b', '_hab');
    if (snakeKey.toLowerCase() === 'id') snakeKey = 'id';

    if (allowedFields.includes(snakeKey)) {
      let val = obj[key];
      
      // BLINDAGEM DE ESCRITA (V4.3):
      // Tratamento especial para IDs das tabelas PRO (Agora são BIGINT no banco)
      // Se vier uma string como "HAB-1020", limpa para "1020" antes de enviar
      const isProTable = tableName.startsWith('pro_') && tableName !== 'pro_patients' && tableName !== 'pro_providers';
      const isProIdField = (snakeKey === 'id' || snakeKey === 'sector_id' || snakeKey === 'group_id' || snakeKey === 'staff_id');
      
      if (isProTable && isProIdField) {
          if (val !== null && val !== undefined && val !== '') {
             // Remove caracteres não numéricos para salvar como BIGINT limpo
             const numericVal = String(val).replace(/\D/g, '');
             // Se resultou em vazio (ex: ID era "novo"), mantém null ou original para o banco rejeitar/gerar
             if (numericVal) val = numericVal; 
          }
      }

      if (NUMERIC_FIELDS.includes(snakeKey)) {
        if (val === "" || val === null || val === undefined) continue;
        // Não forçamos parseInt em IDs para não perder precisão se forem muito grandes,
        // o Postgres lida com string numérica para bigint.
        if (!snakeKey.endsWith('_id') && snakeKey !== 'id') {
            val = parseInt(val);
            if (isNaN(val)) continue;
        }
      }
      
      const isFK = snakeKey === 'user_id' || snakeKey === 'sector_id' || snakeKey === 'record_id' || snakeKey === 'group_id' || snakeKey === 'staff_id';
      if (isFK && val === "") {
        val = null;
      }

      // Validação Crítica de Segurança: UUIDs
      // Tabelas 'pro_' agora usam BIGINT, então pulamos validação de UUID para elas.
      if (tableName !== 'visit_requests' && !tableName.startsWith('pro_') && snakeKey !== 'staff_id') {
        if (isFK && val && !isValidUUID(val) && tableName !== 'bible_class_attendees') {
          // console.error(`Bloqueio de Segurança: Tentativa de usar ID não-UUID em ${tableName}.${snakeKey} (${val})`);
          newObj[snakeKey] = null;
          continue;
        }
      }
      
      newObj[snakeKey] = val;
    }
  }
  return newObj;
};

export const DataRepository = {
  async syncAll() {
    if (!supabase) return null;
    try {
      const MAX_ROWS = 9999;

      const [u, bs, bc, sg, sv, vr, c, ps, pst, pp, pr, pg, pgl, pgm, bca] = await Promise.all([
        supabase.from('users').select('*').range(0, MAX_ROWS),
        supabase.from('bible_studies').select('*').range(0, MAX_ROWS),
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
        proGroupMembers: toCamel(pgm.data || [])
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
      bibleStudies: 'bible_studies', bibleClasses: 'bible_classes',
      smallGroups: 'small_groups', staffVisits: 'staff_visits',
      users: 'users', config: 'app_config',
      visitRequests: 'visit_requests',
      proSectors: 'pro_sectors', proStaff: 'pro_staff', 
      proPatients: 'pro_patients', proProviders: 'pro_providers',
      proGroups: 'pro_groups', proGroupLocations: 'pro_group_locations',
      proGroupMembers: 'pro_group_members'
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
      const { error } = await supabase.from(tableName).upsert(chunk).select();
      if (error) {
        console.error(`[DataRepo] ERRO CRÍTICO no Supabase (${tableName}):`, error);
        return false;
      }
    }

    if (collection === 'bibleClasses') {
        for (const cls of items) {
            if (cls.id && cls.students && Array.isArray(cls.students)) {
                const { error: delError } = await supabase.from('bible_class_attendees').delete().eq('class_id', cls.id);
                if (delError) console.error("Erro ao limpar participantes antigos:", delError);

                const attendeesPayload = cls.students.map((name: string) => {
                    // Extrai ID numérico do padrão "Nome (123)"
                    const match = name.match(/\((\d+)\)$/);
                    let staffId = match ? match[1] : null;
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
      bibleStudies: 'bible_studies', bibleClasses: 'bible_classes', smallGroups: 'small_groups', 
      staffVisits: 'staff_visits', users: 'users',
      visitRequests: 'visit_requests',
      proSectors: 'pro_sectors', proStaff: 'pro_staff', 
      proPatients: 'pro_patients', proProviders: 'pro_providers',
      proGroups: 'pro_groups', proGroupLocations: 'pro_group_locations',
      proGroupMembers: 'pro_group_members'
    };
    const tableName = tableMap[collection];
    if (!tableName) return false;
    
    // IDs numéricos (nas tabelas PRO) podem ser passados como string, o Postgres faz o cast na query
    if (!tableName.startsWith('pro_') && !tableName.startsWith('visit_requests') && !isValidUUID(id)) return false;
    
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    return !error;
  }
};