export const TABLE_SCHEMAS: Record<string, string[]> = {
  users: ['id', 'name', 'email', 'password', 'role', 'profile_pic', 'attends_haba', 'haba_days', 'updated_at'],
  bible_study_sessions: ['id', 'user_id', 'date', 'unit', 'sector', 'sector_id', 'name', 'staff_id', 'whatsapp', 'status', 'participant_type', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'],
  bible_classes: ['id', 'user_id', 'date', 'unit', 'sector', 'status', 'participant_type', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'],
  bible_class_attendees: ['id', 'class_id', 'student_name', 'staff_id', 'created_at'],
  small_groups: ['id', 'user_id', 'date', 'unit', 'sector', 'group_name', 'leader', 'leader_phone', 'shift', 'participants_count', 'observations', 'created_at', 'updated_at'],
  staff_visits: ['id', 'user_id', 'date', 'unit', 'sector', 'reason', 'staff_name', 'participant_type', 'provider_role', 'requires_return', 'return_date', 'return_completed', 'observations', 'created_at', 'updated_at'],
  visit_requests: ['id', 'pg_name', 'leader_name', 'leader_phone', 'unit', 'date', 'status', 'request_notes', 'preferred_chaplain_id', 'assigned_chaplain_id', 'chaplain_response', 'sector_id', 'sector_name', 'is_read', 'created_at', 'updated_at'],
  app_config: ['id', 'mural_text', 'header_line1', 'header_line2', 'header_line3', 'font_size1', 'font_size2', 'font_size3', 'report_logo_width', 'report_logo_x', 'report_logo_y', 'header_line1_x', 'header_line1_y', 'header_line2_x', 'header_line2_y', 'header_line3_x', 'header_line3_y', 'header_padding_top', 'header_text_align', 'primary_color', 'app_logo_url', 'report_logo_url', 'last_modified_by', 'last_modified_at', 'updated_at'],
  pro_sectors: ['id', 'name', 'unit', 'active'],
  pro_staff: ['id', 'name', 'sector_id', 'unit', 'whatsapp', 'active'],
  pro_patients: ['id', 'name', 'unit', 'whatsapp', 'last_lesson', 'updated_at'],
  pro_providers: ['id', 'name', 'unit', 'whatsapp', 'sector', 'updated_at'],
  pro_groups: ['id', 'name', 'current_leader', 'leader_phone', 'sector_id', 'unit', 'active'],
  pro_group_locations: ['id', 'group_id', 'sector_id', 'unit', 'created_at'],
  pro_group_members: ['id', 'group_id', 'staff_id', 'joined_at', 'left_at', 'is_error'],
  pro_group_provider_members: ['id', 'group_id', 'provider_id', 'joined_at', 'left_at', 'is_error'],
  ambassadors: ['id', 'registration_id', 'name', 'sector_id', 'unit', 'completion_date', 'updated_at']
};

export const NUMERIC_FIELDS = ['font_size1', 'font_size2', 'font_size3', 'report_logo_width', 'report_logo_x', 'report_logo_y', 'header_line1_x', 'header_line1_y', 'header_line2_x', 'header_line2_y', 'header_line3_x', 'header_line3_y', 'header_padding_top', 'participants_count', 'last_modified_at', 'updated_at', 'created_at', 'joined_at', 'left_at', 'staff_id', 'provider_id', 'sector_id', 'group_id'];

export const isValidUUID = (uuid: string) => {
  const s = "" + uuid;
  return s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
};

const keyCache: Record<string, string> = {};

export const toCamel = (obj: any): any => {
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
      if (camelKey === 'attendsHaba') {
        // Mantém como attendsHaba
      } else if (camelKey.endsWith('Haba')) {
        camelKey = camelKey.replace('Haba', 'HABA');
      } else if (camelKey.endsWith('Hab')) {
        camelKey = camelKey.replace('Hab', 'HAB');
      }
      keyCache[key] = camelKey;
    }
    
    let val = obj[key];
    
    if ((key === 'id' || key.endsWith('_id')) && typeof val === 'number') {
        val = String(val);
    }

    newObj[keyCache[key]] = toCamel(val);
  }
  return newObj;
};

export const cleanAndConvertToSnake = (obj: any, allowedFields: string[], tableName: string): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  for (const key in obj) {
    let snakeKey = key.includes('_') ? key : key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (snakeKey.endsWith('_h_a_b_a')) snakeKey = snakeKey.replace('_h_a_b_a', '_haba');
    else if (snakeKey.endsWith('_h_a_b')) snakeKey = snakeKey.replace('_h_a_b', '_hab');
    if (snakeKey.toLowerCase() === 'id') snakeKey = 'id';

    if (allowedFields.includes(snakeKey)) {
      let val = obj[key];
      
      const isProTable = tableName.startsWith('pro_') && tableName !== 'pro_patients' && tableName !== 'pro_providers';
      const isProIdField = (snakeKey === 'id' || snakeKey === 'sector_id' || snakeKey === 'group_id' || snakeKey === 'staff_id' || snakeKey === 'provider_id');
      
      if (isProTable && isProIdField) {
          if (val !== null && val !== undefined && val !== '') {
             const valStr = String(val);
             
             if (isValidUUID(valStr)) {
                const isEntityTable = ['pro_staff', 'pro_sectors', 'pro_groups'].includes(tableName);
                if (snakeKey === 'id' && isEntityTable) {
                    continue; 
                } else if (snakeKey !== 'id') {
                    val = null;
                }
             } else {
                const numericVal = valStr.replace(/\D/g, '');
                if (numericVal) val = numericVal;
             }
          }
      }

      if (NUMERIC_FIELDS.includes(snakeKey)) {
        if (val === "" || val === null || val === undefined) continue;
        if (!snakeKey.endsWith('_id') && snakeKey !== 'id') {
            val = parseInt(val);
            if (isNaN(val)) continue;
        }
      }
      
      const isFK = snakeKey === 'user_id' || snakeKey === 'sector_id' || snakeKey === 'record_id' || snakeKey === 'group_id' || snakeKey === 'staff_id' || snakeKey === 'provider_id';
      if (isFK && val === "") {
        val = null;
      }

      if (tableName !== 'visit_requests' && !tableName.startsWith('pro_') && snakeKey !== 'staff_id' && snakeKey !== 'provider_id' && snakeKey !== 'sector_id') {
        if (isFK && val && !isValidUUID(val) && tableName !== 'bible_class_attendees') {
          newObj[snakeKey] = null;
          continue;
        }
      }
      
      newObj[snakeKey] = val;
    }
  }
  return newObj;
};
