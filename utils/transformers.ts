export const COLLECTION_TO_TABLE: Record<string, string> = {
  bibleStudies: 'bible_study_sessions',
  bibleClasses: 'bible_classes',
  smallGroups: 'small_groups',
  staffVisits: 'staff_visits',
  users: 'users',
  config: 'app_config',
  visitRequests: 'visit_requests',
  proSectors: 'pro_sectors',
  proStaff: 'pro_staff',
  proPatients: 'pro_patients',
  proProviders: 'pro_providers',
  proGroups: 'pro_groups',
  proGroupLocations: 'pro_group_locations',
  proGroupMembers: 'pro_group_members',
  proGroupProviderMembers: 'pro_group_provider_members',
  ambassadors: 'ambassadors',
  activitySchedules: 'activity_schedules',
  dailyActivityReports: 'daily_activity_reports',
  bibleClassAttendees: 'bible_class_attendees',
  proMonthlyStats: 'pro_monthly_stats',
  editAuthorizations: 'edit_authorizations',
  proHistoryRecords: 'pro_history_records'
};

export const TABLE_SCHEMAS: Record<string, string[]> = {
  users: ['id', 'name', 'email', 'password', 'role', 'profile_pic', 'attends_haba', 'haba_days', 'updated_at', 'auth_id'],
  bible_study_sessions: ['id', 'user_id', 'date', 'unit', 'sector', 'sector_id', 'name', 'staff_id', 'whatsapp', 'status', 'participant_type', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'],
  bible_classes: ['id', 'user_id', 'date', 'unit', 'sector', 'status', 'participant_type', 'guide', 'lesson', 'observations', 'created_at', 'updated_at'],
  bible_class_attendees: ['id', 'class_id', 'student_name', 'staff_id', 'created_at'],
  small_groups: ['id', 'user_id', 'date', 'unit', 'sector', 'group_name', 'leader', 'leader_phone', 'shift', 'participants_count', 'observations', 'created_at', 'updated_at'],
  staff_visits: ['id', 'user_id', 'date', 'unit', 'sector', 'reason', 'staff_name', 'staff_id', 'provider_id', 'whatsapp', 'participant_type', 'provider_role', 'requires_return', 'return_date', 'return_completed', 'observations', 'created_at', 'updated_at'],
  visit_requests: ['id', 'pg_name', 'leader_name', 'leader_phone', 'unit', 'date', 'status', 'request_notes', 'preferred_chaplain_id', 'assigned_chaplain_id', 'chaplain_response', 'sector_id', 'meeting_location', 'scheduled_time', 'is_read', 'created_at', 'updated_at'],
  app_config: ['id', 'mural_text', 'header_line1', 'header_line2', 'header_line3', 'font_size1', 'font_size2', 'font_size3', 'report_logo_width', 'report_logo_x', 'report_logo_y', 'header_line1_x', 'header_line1_y', 'header_line2_x', 'header_line2_y', 'header_line3_x', 'header_line3_y', 'header_padding_top', 'header_text_align', 'primary_color', 'app_logo_url', 'report_logo_url', 'last_modified_by', 'last_modified_at', 'header_profiles', 'updated_at'],
  pro_sectors: ['id', 'name', 'unit', 'active', 'cycle_month', 'updated_at'],
  pro_staff: ['id', 'name', 'sector_id', 'unit', 'whatsapp', 'active', 'left_at', 'cycle_month', 'updated_at'],
  pro_patients: ['id', 'name', 'unit', 'whatsapp', 'last_lesson', 'updated_at'],
  pro_providers: ['id', 'name', 'unit', 'whatsapp', 'sector', 'updated_at'],
  pro_groups: ['id', 'name', 'current_leader', 'leader_phone', 'sector_id', 'unit', 'active', 'cycle_month', 'updated_at'],
  pro_group_locations: ['id', 'group_id', 'sector_id', 'unit', 'created_at'],
  pro_group_members: ['id', 'group_id', 'staff_id', 'joined_at', 'left_at', 'is_error', 'cycle_month'],
  pro_group_provider_members: ['id', 'group_id', 'provider_id', 'joined_at', 'left_at', 'is_error', 'cycle_month'],
  ambassadors: ['id', 'registration_id', 'name', 'sector_id', 'unit', 'completion_date', 'cycle_month', 'created_at', 'updated_at'],
  activity_schedules: ['id', 'user_id', 'unit', 'month', 'day_of_week', 'activity_type', 'location', 'time', 'created_at'],
  daily_activity_reports: ['id', 'user_id', 'date', 'unit', 'completed_blueprints', 'completed_cults', 'completed_encontro', 'completed_visite_cantando', 'palliative_count', 'surgical_count', 'pediatric_count', 'uti_count', 'observations', 'created_at', 'updated_at'],
  pro_monthly_stats: ['id', 'month', 'type', 'target_id', 'total_staff', 'total_participants', 'percentage', 'goal', 'unit', 'created_at', 'snapshot_data'],
  edit_authorizations: ['id', 'user_id', 'user_name', 'allowed_tabs', 'month_to_unlock', 'expiry_date', 'created_at', 'created_by'],
  pro_history_records: ['id', 'month', 'unit', 'staff_id', 'staff_name', 'registration_id', 'sector_id', 'sector_name', 'group_id', 'group_name', 'status', 'is_enrolled', 'created_at']
};

export const NUMERIC_FIELDS = ['font_size1', 'font_size2', 'font_size3', 'report_logo_width', 'report_logo_x', 'report_logo_y', 'header_line1_x', 'header_line1_y', 'header_line2_x', 'header_line2_y', 'header_line3_x', 'header_line3_y', 'header_padding_top', 'participants_count', 'staff_id', 'provider_id', 'sector_id', 'group_id', 'day_of_week', 'total_staff', 'total_participants', 'percentage', 'goal'];

export const DATE_FIELDS = ['joined_at', 'left_at', 'updated_at', 'created_at', 'completion_date', 'return_date', 'scheduled_time', 'last_modified_at', 'expiry_date', 'month_to_unlock'];

export const isValidUUID = (uuid: string) => {
  const s = "" + uuid;
  // Allow standard UUID or numeric string (for legacy/PRO IDs)
  return s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) || s.match(/^\d+$/);
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
      
      // Business Rule: HABA and HAB must be uppercase
      if (camelKey === 'attendsHaba') {
        camelKey = 'attendsHaba'; // Special case for users table
      } else {
        camelKey = camelKey.replace(/Haba/g, 'HABA').replace(/Hab/g, 'HAB');
      }
      
      keyCache[key] = camelKey;
    }
    
    let val = obj[key];
    
    if (DATE_FIELDS.includes(key) && val && typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
            val = d.getTime();
        }
    }
    
    if ((key === 'id' || key.endsWith('_id')) && typeof val === 'number') {
        val = String(val);
    }

    newObj[keyCache[key]] = toCamel(val);
  }
  return newObj;
};

// Mapeamento exato de colunas que são BIGINT (int8) no banco de dados, baseado no SQL do usuário.
// Qualquer campo de data NÃO listado aqui para sua respectiva tabela será tratado como TIMESTAMPTZ/DATE (ISO String).
export const NUMERIC_DATE_COLUMNS_BY_TABLE: Record<string, string[]> = {
  activity_schedules: ['created_at'],
  app_config: ['last_modified_at', 'updated_at'],
  bible_classes: ['created_at', 'updated_at'],
  bible_study_sessions: ['created_at', 'updated_at'],
  daily_activity_reports: ['created_at', 'updated_at'],
  pro_group_locations: ['created_at'],
  pro_sectors: ['created_at'], // Note: updated_at é timestamptz, por isso não está aqui
  small_groups: ['created_at', 'updated_at'],
  staff_visits: ['created_at', 'updated_at'],
  users: ['updated_at'],
  visit_requests: ['created_at', 'updated_at']
};

export const cleanAndConvertToSnake = (obj: any, allowedFields: string[], tableName: string): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  for (const key in obj) {
    // Convert camelCase to snake_case
    let snakeKey = key.includes('_') ? key : key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    
    // Fix HABA/HAB conversion artifacts
    snakeKey = snakeKey.replace(/_h_a_b_a/g, '_haba').replace(/_h_a_b/g, '_hab');
    
    if (snakeKey.toLowerCase() === 'id') snakeKey = 'id';

    if (allowedFields.includes(snakeKey)) {
      let val = obj[key];
      
      // Se for ID vazio, nulo ou indefinido, removemos para o Supabase gerar um novo (exceto visit_requests)
      if (snakeKey === 'id' && (val === '' || val === null || val === undefined) && tableName !== 'visit_requests') {
        continue;
      }

      // PRO Tables specific logic
      const isProTable = tableName.startsWith('pro_') && tableName !== 'pro_patients' && tableName !== 'pro_providers';
      const isProIdField = (snakeKey === 'id' || snakeKey === 'sector_id' || snakeKey === 'group_id' || snakeKey === 'staff_id' || snakeKey === 'provider_id');
      
      if (isProTable && isProIdField) {
          if (val !== null && val !== undefined && val !== '') {
             const valStr = String(val);
             
             if (isValidUUID(valStr)) {
                // Se for um UUID válido, mantemos como está (não anulamos)
                // A lógica anterior anulava se não fosse o campo 'id', o que quebrava FKs baseadas em UUID
                val = valStr;
             } else {
                const numericVal = valStr.replace(/\D/g, '');
                if (numericVal) val = numericVal;
             }
          }
      }

      if (NUMERIC_FIELDS.includes(snakeKey)) {
        if (val === "" || val === null || val === undefined) continue;
        if (!snakeKey.endsWith('_id') && snakeKey !== 'id') {
            val = parseFloat(val);
            if (isNaN(val)) continue;
        }
      }

      if (DATE_FIELDS.includes(snakeKey) && val) {
          const numericCols = NUMERIC_DATE_COLUMNS_BY_TABLE[tableName] || [];
          const isNumeric = numericCols.includes(snakeKey);
          
          if (isNumeric) {
              // Converte para número (BIGINT)
              if (typeof val === 'string') {
                  const d = new Date(val);
                  if (!isNaN(d.getTime())) {
                      val = d.getTime();
                  }
              }
          } else {
              // Converte para ISO String (TIMESTAMPTZ/DATE)
              if (typeof val === 'number') {
                  val = new Date(val).toISOString();
              } else if (typeof val === 'string' && !isNaN(Number(val))) {
                  val = new Date(Number(val)).toISOString();
              }
          }
      }
      
      const isFK = snakeKey === 'user_id' || snakeKey === 'sector_id' || snakeKey === 'record_id' || snakeKey === 'group_id' || snakeKey === 'staff_id' || snakeKey === 'provider_id';
      if (isFK && val === "") {
        val = null;
      }

      if (tableName !== 'visit_requests' && !tableName.startsWith('pro_') && snakeKey !== 'staff_id' && snakeKey !== 'provider_id' && snakeKey !== 'sector_id') {
        if (isFK && val && !isValidUUID(val) && tableName !== 'bible_class_attendees' && !String(val).match(/^\d+$/)) {
          newObj[snakeKey] = null;
          continue;
        }
      }
      
      newObj[snakeKey] = val;
    }
  }
  return newObj;
};
