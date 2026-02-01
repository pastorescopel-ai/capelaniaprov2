import { supabase } from './supabaseClient';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, MasterLists, Config, VisitRequest } from '../types';

const TABLE_SCHEMAS: Record<string, string[]> = {
  users: ['id', 'name', 'email', 'password', 'role', 'profile_pic', 'updated_at'],
  bible_studies: ['id', 'user_id', 'date', 'unit', 'sector', 'name', 'whatsapp', 'status', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'],
  bible_classes: ['id', 'user_id', 'date', 'unit', 'sector', 'students', 'status', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'],
  small_groups: ['id', 'user_id', 'date', 'unit', 'sector', 'group_name', 'leader', 'shift', 'participants_count', 'observations', 'created_at', 'updated_at'],
  staff_visits: ['id', 'user_id', 'date', 'unit', 'sector', 'reason', 'staff_name', 'requires_return', 'return_date', 'return_completed', 'observations', 'created_at', 'updated_at'],
  visit_requests: ['id', 'pg_name', 'leader_name', 'leader_phone', 'unit', 'date', 'status', 'request_notes', 'preferred_chaplain_id', 'assigned_chaplain_id', 'chaplain_response', 'is_read', 'created_at', 'updated_at'],
  app_config: ['id', 'mural_text', 'header_line1', 'header_line2', 'header_line3', 'font_size1', 'font_size2', 'font_size3', 'report_logo_width', 'report_logo_x', 'report_logo_y', 'header_line1_x', 'header_line1_y', 'header_line2_x', 'header_line2_y', 'header_line3_x', 'header_line3_y', 'header_padding_top', 'header_text_align', 'primary_color', 'app_logo_url', 'report_logo_url', 'last_modified_by', 'last_modified_at', 'updated_at'],
  master_lists: ['id', 'sectors_hab', 'sectors_haba', 'staff_hab', 'staff_haba', 'groups_hab', 'groups_haba', 'updated_at']
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
      if (NUMERIC_FIELDS.includes(snakeKey)) {
        if (val === "" || val === null || val === undefined) continue;
        val = parseInt(val);
        if (isNaN(val)) continue;
      }
      
      // Validação Flexível para Bridge de Visit Requests
      if (tableName !== 'visit_requests') {
        if ((snakeKey === 'user_id' || snakeKey === 'record_id') && val && !isValidUUID(val)) {
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
      const [u, bs, bc, sg, sv, vr, c, ml] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('bible_studies').select('*'),
        supabase.from('bible_classes').select('*'),
        supabase.from('small_groups').select('*'),
        supabase.from('staff_visits').select('*'),
        supabase.from('visit_requests').select('*'),
        supabase.from('app_config').select('*').limit(1),
        supabase.from('master_lists').select('*').limit(1)
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
        masterLists: ml.data && ml.data.length > 0 ? toCamel(ml.data[0]) : { sectorsHAB: [], sectorsHABA: [], staffHAB: [], staffHABA: [], groupsHAB: [], groupsHABA: [] }
      };
    } catch (error) {
      console.error("Erro ao sincronizar com Supabase:", error);
      return null;
    }
  },

  async upsertRecord(collection: string, item: any) {
    if (!supabase) return false;
    const items = Array.isArray(item) ? item : [item];
    const tableMap: Record<string, string> = {
      bibleStudies: 'bible_studies', bibleClasses: 'bible_classes',
      smallGroups: 'small_groups', staffVisits: 'staff_visits',
      users: 'users', config: 'app_config', masterLists: 'master_lists',
      visitRequests: 'visit_requests'
    };
    
    const tableName = tableMap[collection];
    if (!tableName) return false;

    const payloads = items.map(i => cleanAndConvertToSnake(i, TABLE_SCHEMAS[tableName], tableName));
    
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

    const { error } = await supabase.from(tableName).upsert(payloads);
    if (error) {
      console.error(`Erro crítico de persistência em ${tableName}:`, error);
      return false;
    }
    return true;
  },

  async deleteRecord(collection: string, id: string) {
    if (!supabase || !isValidUUID(id)) return false;
    const tableMap: Record<string, string> = {
      bibleStudies: 'bible_studies', bibleClasses: 'bible_classes', smallGroups: 'small_groups', 
      staffVisits: 'staff_visits', users: 'users',
      visitRequests: 'visit_requests'
    };
    const tableName = tableMap[collection];
    if (!tableName) return false;

    const { error } = await supabase.from(tableName).delete().eq('id', id);
    return !error;
  }
};