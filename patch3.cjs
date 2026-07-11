const fs = require('fs');
let code = fs.readFileSync('src/services/dataRepository.ts', 'utf8');

const syncAllStart = code.indexOf('async syncAll()');
const beforeSyncAll = code.substring(0, syncAllStart);
const afterSyncAll = code.substring(syncAllStart);

const newMethods = `
  async syncCore() {
    if (!supabase) return null;
    try {
      const MAX_ROWS = 49999;
      const results = await Promise.all([
        DataRepository.fetchFullTable('users', MAX_ROWS),
        DataRepository.fetchFullTable('visit_requests', MAX_ROWS),
        DataRepository.fetchFullTable('pro_sectors', MAX_ROWS),
        DataRepository.fetchFullTable('pro_groups', MAX_ROWS),
        DataRepository.fetchFullTable('pro_group_locations', MAX_ROWS),
        DataRepository.fetchFullTable('small_group_sessions', MAX_ROWS),
        (async () => {
          try {
            return await supabase.from('app_config').select('*').limit(1);
          } catch (err) {
            return { data: null, error: err };
          }
        })()
      ]);

      const [u, vr, ps, pg, pgl, sg, c] = results;

      if (c.data?.[0]?.id) {
        const configId = c.data[0].id;
        GLOBAL_ID_CACHE['app_config'] = configId;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(CACHE_KEY, configId);
            localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(toCamel(c.data[0])));
          } catch (e) {
            MEMORY_CACHE[CACHE_KEY] = configId;
            MEMORY_CACHE[DATA_CACHE_KEY] = toCamel(c.data[0]);
          }
        }
      }

      return {
        users: u.data ? toCamel(u.data) : null,
        visitRequests: vr.data ? toCamel(vr.data) : null,
        proSectors: ps.data ? toCamel(ps.data) : null,
        proGroups: pg.data ? toCamel(pg.data) : null,
        proGroupLocations: pgl.data ? toCamel(pgl.data) : null,
        smallGroups: sg.data ? toCamel(sg.data) : null,
        config: c.data && c.data.length > 0 ? toCamel(c.data[0]) : null,
      };
    } catch (error) {
      console.error("Erro fatal ao sincronizar core com Supabase:", error);
      return null;
    }
  },

  async syncBackground() {
    if (!supabase) return null;
    try {
      const MAX_ROWS = 49999;
      
      // Calculate 4 months ago for limiting historical data
      const d = new Date();
      d.setMonth(d.getMonth() - 4);
      const limitDate = d.toISOString().split('T')[0];
      const limitMonth = limitDate.substring(0, 7) + '-01';

      const results = await Promise.all([
        DataRepository.fetchFullTable('pro_history_records', 199999, q => q.gte('month', limitMonth)),
        DataRepository.fetchFullTable('pro_group_members', MAX_ROWS, q => q.gte('cycle_month', limitMonth)),
        DataRepository.fetchFullTable('pro_staff', MAX_ROWS),
        DataRepository.fetchFullTable('pro_monthly_stats', 99999), 
        DataRepository.fetchFullTable('staff_visits', MAX_ROWS, q => q.gte('date', limitDate)),
        DataRepository.fetchFullTable('activity_schedules', MAX_ROWS, q => q.gte('month', limitMonth)),
        DataRepository.fetchFullTable('daily_activity_reports', MAX_ROWS, q => q.gte('date', limitDate)),
        DataRepository.fetchFullTable('bible_class_attendees', MAX_ROWS, q => q.gte('date', limitDate)),
        DataRepository.fetchFullTable('bible_study_sessions', MAX_ROWS),
        DataRepository.fetchFullTable('bible_classes', MAX_ROWS),
        DataRepository.fetchFullTable('pro_patients', MAX_ROWS),
        DataRepository.fetchFullTable('pro_providers', MAX_ROWS),
        DataRepository.fetchFullTable('pro_group_provider_members', MAX_ROWS),
        DataRepository.fetchFullTable('ambassadors', MAX_ROWS),
        DataRepository.fetchFullTable('edit_authorizations', MAX_ROWS)
      ]);

      const [phr, pgm, pst, pms, sv, asch, dar, bca, bs, bc, pp, pr, pgpm, amb, ea] = results;

      const classes = bc.data ? toCamel(bc.data) : null;
      const attendees = bca.data ? toCamel(bca.data) : null;
      
      if (classes && attendees) {
        classes.forEach((cls) => {
            cls.students = attendees
              .filter((a) => a.classId === cls.id)
              .map((a) => {
                  const id = a.staffId || a.participantId;
                  if (id && !String(a.studentName).includes(\`(\${id})\`)) {
                      return \`\${a.studentName} (\${id})\`;
                  }
                  return a.studentName;
              });
        });
      }

      return {
        proHistoryRecords: phr.data ? toCamel(phr.data) : null,
        proGroupMembers: pgm.data ? toCamel(pgm.data) : null,
        proStaff: pst.data ? toCamel(pst.data) : null,
        proMonthlyStats: pms.data ? toCamel(pms.data) : null,
        staffVisits: sv.data ? toCamel(sv.data) : null,
        activitySchedules: asch.data ? toCamel(asch.data) : null,
        dailyActivityReports: dar.data ? toCamel(dar.data) : null,
        bibleClassAttendees: attendees,
        bibleStudySessions: bs.data ? toCamel(bs.data) : null,
        bibleClasses: classes,
        proPatients: pp.data ? toCamel(pp.data) : null,
        proProviders: pr.data ? toCamel(pr.data) : null,
        proGroupProviderMembers: pgpm.data ? toCamel(pgpm.data) : null,
        ambassadors: amb.data ? toCamel(amb.data) : null,
        editAuthorizations: ea.data ? toCamel(ea.data) : null,
      };
    } catch (error) {
      console.error("Erro fatal ao sincronizar background com Supabase:", error);
      return null;
    }
  },

`;

fs.writeFileSync('src/services/dataRepository.ts', beforeSyncAll + newMethods + afterSyncAll);
