
import { supabase } from './supabaseClient';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, MasterLists, Config, VisitRequest, ProStaff, ProSector, ProGroup } from '../types';

const TABLE_SCHEMAS: Record<string, string[]> = {
  users: ['id', 'name', 'email', 'password', 'role', 'profile_pic', 'updated_at'],
  bible_studies: ['id', 'user_id', 'date', 'unit', 'sector', 'name', 'whatsapp', 'status', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'],
  bible_classes: ['id', 'user_id', 'date', 'unit', 'sector', 'students', 'status', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'],
  small_groups: ['id', 'user_id', 'date', 'unit', 'sector', 'group_name', 'leader', 'shift', 'participants_count', 'observations', 'created_at', 'updated_at'],
  staff_visits: ['id', 'user_id', 'date', 'unit', 'sector', 'reason', 'staff_name', 'requires_return', 'return_date', 'return_completed', 'observations', 'created_at', 'updated_at'],
  visit_requests: ['id', 'pg_name', 'leader_name', 'leader_phone', 'unit', 'date', 'status', 'request_notes', 'preferred_chaplain_id', 'assigned_chaplain_id', 'chaplain_response', 'is_read', 'created_at', 'updated_at'],
  app_config: ['id', 'mural_text', 'header_line1', 'header_line2', 'header_line3', 'font_size1', 'font_size2', 'font_size3', 'report_logo_width', 'report_logo_x', 'report_logo_y', 'header_line1_x', 'header_line1_y', 'header_line2_x', 'header_line2_y', 'header_line3_x', 'header_line3_y', 'header_padding_top', 'header_text_align', 'primary_color', 'app_logo_url', 'report_logo_url', 'last_modified_by', 'last_modified_at', 'updated_at'],
  master_lists: ['id', 'sectors_hab', 'sectors_haba', 'staff_hab', 'staff_haba', 'groups_hab', 'groups_haba', 'updated_at'],
  pro_sectors: ['id', 'name', 'unit'],
  pro_staff: ['id', 'name', 'sector_id', 'unit'],
  pro_groups: ['id', 'name', 'current_leader', 'sector_id', 'unit']
};

const NUMERIC_FIELDS = ['font_size1', 'font_size2', 'font_size3', 'report_logo_width', 'report_logo_x', 'report_logo_y', 'header_line1_x', 'header_line1_y', 'header_line2_x', 'header_line2_y', 'header_line3_x', 'header_line3_y', 'header_padding_top', 'participants_count', 'last_modified_at', 'updated_at', 'created_at'];

const GLOBAL_ID_CACHE: Record<string, string> = {};

const isValidUUID = (uuid: string) => {
  const s = "" + uuid;
  return s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
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
    if (!keyCache[key]) {
      let camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (camelKey.endsWith('Haba')) camelKey = camelKey.replace('Haba', 'HABA');
      else if (camelKey.endsWith('Hab')) camelKey = camelKey.replace('Hab', 'HAB');
      keyCache[key] = camelKey;
    }
    let val = obj[key];
    if (['sectors_hab', 'sectors_haba', 'staff_hab', 'staff_haba', 'groups_hab', 'groups_haba', 'students'].includes(key)) {
      if (!Array.isArray(val)) val = [];
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
      
      // Conversão Numérica
      if (NUMERIC_FIELDS.includes(snakeKey)) {
        if (val === "" || val === null || val === undefined) continue;
        val = parseInt(val);
        if (isNaN(val)) continue;
      }
      
      // TRATAMENTO DE CHAVES ESTRANGEIRAS (FK): Nunca enviar "" se for ID relacional
      const isFK = snakeKey === 'user_id' || snakeKey === 'sector_id' || snakeKey === 'record_id';
      if (isFK && val === "") {
        val = null;
      }

      // Validação de UUID para tabelas não-PRO
      if (tableName !== 'visit_requests' && !tableName.startsWith('pro_')) {
        if (isFK && val && !isValidUUID(val)) {
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
      // Define limite de segurança aumentado (10k registros) para evitar paginação complexa em bases médias
      const MAX_ROWS = 9999;

      const [u, bs, bc, sg, sv, vr, c, ml, ps, pst, pg] = await Promise.all([
        supabase.from('users').select('*').range(0, MAX_ROWS),
        supabase.from('bible_studies').select('*').range(0, MAX_ROWS),
        supabase.from('bible_classes').select('*').range(0, MAX_ROWS),
        supabase.from('small_groups').select('*').range(0, MAX_ROWS),
        supabase.from('staff_visits').select('*').range(0, MAX_ROWS),
        supabase.from('visit_requests').select('*').range(0, MAX_ROWS),
        supabase.from('app_config').select('*').limit(1),
        supabase.from('master_lists').select('*').limit(1),
        supabase.from('pro_sectors').select('*').range(0, MAX_ROWS),
        supabase.from('pro_staff').select('*').range(0, MAX_ROWS),
        supabase.from('pro_groups').select('*').range(0, MAX_ROWS)
      ]);

      if (c.data?.[0]?.id) GLOBAL_ID_CACHE['app_config'] = c.data[0].id;
      if (ml.data?.[0]?.id) GLOBAL_ID_CACHE['master_lists'] = ml.data[0].id;

      return {
        users: toCamel(u.data || []),
        bibleStudies: toCamel(bs.data || []),
        bibleClasses: toCamel(bc.data || []),
        smallGroups: toCamel(sg.data || []),
        staffVisits: toCamel(sv.data || []),
        visitRequests: toCamel(vr.data || []),
        config: c.data && c.data.length > 0 ? toCamel(c.data[0]) : null,
        masterLists: ml.data && ml.data.length > 0 ? toCamel(ml.data[0]) : { sectorsHAB: [], sectorsHABA: [], staffHAB: [], staffHABA: [], groupsHAB: [], groupsHABA: [] },
        proSectors: toCamel(ps.data || []),
        proStaff: toCamel(pst.data || []),
        proGroups: toCamel(pg.data || [])
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
      users: 'users', config: 'app_config', masterLists: 'master_lists',
      visitRequests: 'visit_requests',
      proSectors: 'pro_sectors', proStaff: 'pro_staff', proGroups: 'pro_groups'
    };
    
    const tableName = tableMap[collection];
    if (!tableName) return false;

    // Preparar payloads limpos
    const payloads = items.map(i => cleanAndConvertToSnake(i, TABLE_SCHEMAS[tableName], tableName));

    // Tratamento de Singleton (Config/Lists)
    if (tableName === 'app_config' || tableName === 'master_lists') {
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

    // PROCESSAMENTO EM LOTES (CHUNKING) para evitar erros de Payload Size
    const CHUNK_SIZE = 100;
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
      const chunk = payloads.slice(i, i + CHUNK_SIZE);
      
      const { data, error } = await supabase.from(tableName).upsert(chunk).select();
      
      if (error) {
        console.error(`[DataRepo] ERRO CRÍTICO no Supabase (${tableName}):`, {
          code: error.code,
          message: error.message,
          hint: error.hint,
          details: error.details
        });
        console.error(`[DataRepo] Lote que falhou:`, chunk);
        return false;
      }
      
      console.log(`[DataRepo] Lote salvo em ${tableName}. (${i + chunk.length}/${payloads.length})`);
    }

    return true;
  },

  async deleteRecord(collection: string, id: string) {
    if (!supabase) return false;
    const tableMap: Record<string, string> = {
      bibleStudies: 'bible_studies', bibleClasses: 'bible_classes', smallGroups: 'small_groups', 
      staffVisits: 'staff_visits', users: 'users',
      visitRequests: 'visit_requests',
      proSectors: 'pro_sectors', proStaff: 'pro_staff', proGroups: 'pro_groups'
    };
    const tableName = tableMap[collection];
    if (!tableName) return false;

    if (!tableName.startsWith('pro_') && !isValidUUID(id)) return false;

    const { error } = await supabase.from(tableName).delete().eq('id', id);
    return !error;
  }
};
