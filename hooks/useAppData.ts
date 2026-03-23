
import { useState, useEffect, useCallback } from 'react';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config, VisitRequest, ProStaff, ProSector, ProGroup, ProGroupLocation, ProGroupMember, ProGroupProviderMember, ProPatient, ProProvider, ParticipantType, Unit, ActivitySchedule, DailyActivityReport, ProMonthlyStats, EditAuthorization, ProHistoryRecord } from '../types';
import { DataRepository } from '../services/dataRepository';
import { INITIAL_CONFIG } from '../constants';
import { supabase } from '../services/supabaseClient';
import { normalizeString } from '../utils/formatters';
import { toCamel } from '../utils/transformers';

export const useAppData = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [bibleStudies, setBibleStudies] = useState<BibleStudy[]>([]);
  const [bibleClasses, setBibleClasses] = useState<BibleClass[]>([]);
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([]);
  const [staffVisits, setStaffVisits] = useState<StaffVisit[]>([]);
  const [visitRequests, setVisitRequests] = useState<VisitRequest[]>([]);
  
  const [proStaff, setProStaff] = useState<ProStaff[]>([]);
  const [proPatients, setProPatients] = useState<ProPatient[]>([]);
  const [proProviders, setProProviders] = useState<ProProvider[]>([]);
  const [proSectors, setProSectors] = useState<ProSector[]>([]);
  const [proGroups, setProGroups] = useState<ProGroup[]>([]);
  const [proGroupLocations, setProGroupLocations] = useState<ProGroupLocation[]>([]);
  const [proGroupMembers, setProGroupMembers] = useState<ProGroupMember[]>([]);
  const [proGroupProviderMembers, setProGroupProviderMembers] = useState<ProGroupProviderMember[]>([]);
  const [proMonthlyStats, setProMonthlyStats] = useState<ProMonthlyStats[]>([]);
  const [proHistoryRecords, setProHistoryRecords] = useState<ProHistoryRecord[]>([]);
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [activitySchedules, setActivitySchedules] = useState<ActivitySchedule[]>([]);
  const [dailyActivityReports, setDailyActivityReports] = useState<DailyActivityReport[]>([]);
  const [bibleClassAttendees, setBibleClassAttendees] = useState<any[]>([]);
  const [editAuthorizations, setEditAuthorizations] = useState<EditAuthorization[]>([]);
  
  const [config, setConfig] = useState<Config>(INITIAL_CONFIG);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const applySystemOverrides = useCallback((baseConfig: Config) => {
    if (baseConfig.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', baseConfig.primaryColor);
    }
    return baseConfig;
  }, []);

  const loadFromCloud = useCallback(async (showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      const data = await DataRepository.syncAll();
      if (data) {
        setUsers(data.users || []);
        setBibleStudies(data.bibleStudies || []);
        setBibleClasses(data.bibleClasses || []);
        setSmallGroups(data.smallGroups || []);
        setStaffVisits(data.staffVisits || []);
        setVisitRequests(data.visitRequests || []);
        setProStaff(data.proStaff || []);
        setProPatients(data.proPatients || []);
        setProProviders(data.proProviders || []);
        setProSectors(data.proSectors || []);
        setProGroups(data.proGroups || []);
        setProGroupLocations(data.proGroupLocations || []);
        setProGroupMembers(data.proGroupMembers || []);
        setProGroupProviderMembers(data.proGroupProviderMembers || []);
        setProMonthlyStats(data.proMonthlyStats || []);
        setProHistoryRecords(data.proHistoryRecords || []);
        setAmbassadors(data.ambassadors || []);
        setActivitySchedules(data.activitySchedules || []);
        setDailyActivityReports(data.dailyActivityReports || []);
        setBibleClassAttendees(data.bibleClassAttendees || []);
        setEditAuthorizations(data.editAuthorizations || []);
        if (data.config) {
          setConfig(data.config);
          applySystemOverrides(data.config);
        }
        setIsConnected(true);
      }
    } catch (e) {
      setIsConnected(false);
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [applySystemOverrides]);

  useEffect(() => {
    if (!supabase) return;

    const handleRealtimeChange = (payload: any) => {
      const { eventType, table, new: newRecord, old: oldRecord } = payload;
      
      const tableToCollection: Record<string, string> = {
        'bible_study_sessions': 'bibleStudies',
        'bible_classes': 'bibleClasses',
        'small_groups': 'smallGroups',
        'staff_visits': 'staffVisits',
        'visit_requests': 'visitRequests',
        'pro_sectors': 'proSectors',
        'pro_staff': 'proStaff',
        'pro_patients': 'proPatients',
        'pro_providers': 'proProviders',
        'pro_groups': 'proGroups',
        'pro_group_locations': 'proGroupLocations',
        'pro_group_members': 'proGroupMembers',
        'pro_group_provider_members': 'proGroupProviderMembers',
        'pro_monthly_stats': 'proMonthlyStats',
        'pro_history_records': 'proHistoryRecords',
        'ambassadors': 'ambassadors',
        'activity_schedules': 'activitySchedules',
        'daily_activity_reports': 'dailyActivityReports',
        'bible_class_attendees': 'bibleClassAttendees',
        'edit_authorizations': 'editAuthorizations',
        'users': 'users',
        'app_config': 'config'
      };

      const collection = tableToCollection[table];
      if (!collection) return;

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const camelRecord = toCamel(newRecord);
        
        const updateState = (setter: any) => {
          setter((prev: any[]) => {
            const index = prev.findIndex(i => i.id === camelRecord.id);
            if (index !== -1) {
              const newState = [...prev];
              newState[index] = { ...newState[index], ...camelRecord };
              return newState;
            }
            return [...prev, camelRecord];
          });
        };

        if (collection === 'bibleStudies') updateState(setBibleStudies);
        else if (collection === 'bibleClasses') {
          // Note: bibleClasses might need a full reload if students are updated 
          // because they are in a separate table not covered by this listener directly
          // but for now let's do incremental
          updateState(setBibleClasses);
        }
        else if (collection === 'smallGroups') updateState(setSmallGroups);
        else if (collection === 'staffVisits') updateState(setStaffVisits);
        else if (collection === 'visitRequests') updateState(setVisitRequests);
        else if (collection === 'proStaff') updateState(setProStaff);
        else if (collection === 'proPatients') updateState(setProPatients);
        else if (collection === 'proProviders') updateState(setProProviders);
        else if (collection === 'proSectors') updateState(setProSectors);
        else if (collection === 'proGroups') updateState(setProGroups);
        else if (collection === 'proGroupLocations') updateState(setProGroupLocations);
        else if (collection === 'proGroupMembers') updateState(setProGroupMembers);
        else if (collection === 'proGroupProviderMembers') updateState(setProGroupProviderMembers);
        else if (collection === 'proMonthlyStats') updateState(setProMonthlyStats);
        else if (collection === 'proHistoryRecords') updateState(setProHistoryRecords);
        else if (collection === 'ambassadors') updateState(setAmbassadors);
        else if (collection === 'activitySchedules') updateState(setActivitySchedules);
        else if (collection === 'dailyActivityReports') updateState(setDailyActivityReports);
        else if (collection === 'bibleClassAttendees') updateState(setBibleClassAttendees);
        else if (collection === 'editAuthorizations') updateState(setEditAuthorizations);
        else if (collection === 'users') updateState(setUsers);
        else if (collection === 'config') setConfig(camelRecord);
      } else if (eventType === 'DELETE') {
        const id = oldRecord.id;
        const removeState = (setter: any) => {
          setter((prev: any[]) => prev.filter(i => i.id !== id));
        };

        if (collection === 'bibleStudies') removeState(setBibleStudies);
        else if (collection === 'bibleClasses') removeState(setBibleClasses);
        else if (collection === 'smallGroups') removeState(setSmallGroups);
        else if (collection === 'staffVisits') removeState(setStaffVisits);
        else if (collection === 'visitRequests') removeState(setVisitRequests);
        else if (collection === 'proStaff') removeState(setProStaff);
        else if (collection === 'proPatients') removeState(setProPatients);
        else if (collection === 'proProviders') removeState(setProProviders);
        else if (collection === 'proSectors') removeState(setProSectors);
        else if (collection === 'proGroups') removeState(setProGroups);
        else if (collection === 'proGroupLocations') removeState(setProGroupLocations);
        else if (collection === 'proGroupMembers') removeState(setProGroupMembers);
        else if (collection === 'proGroupProviderMembers') removeState(setProGroupProviderMembers);
        else if (collection === 'activitySchedules') removeState(setActivitySchedules);
        else if (collection === 'dailyActivityReports') removeState(setDailyActivityReports);
        else if (collection === 'bibleClassAttendees') removeState(setBibleClassAttendees);
        else if (collection === 'editAuthorizations') removeState(setEditAuthorizations);
        else if (collection === 'users') removeState(setUsers);
      }
    };

    const channel = supabase
      .channel('realtime-db')
      .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeChange)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const saveRecord = useCallback(async (collection: string, item: any) => {
    const result = await DataRepository.upsertRecord(collection, item);

    if (result.success && result.data) {
      // Atualização Incremental do Estado Local
      const updatedItems = result.data;
      
      const updateState = (setter: any) => {
        setter((prev: any[]) => {
          const newState = [...prev];
          updatedItems.forEach(newItem => {
            const index = newState.findIndex(i => i.id === newItem.id);
            if (index !== -1) {
              newState[index] = { ...newState[index], ...newItem };
            } else {
              newState.push(newItem);
            }
          });
          return newState;
        });
      };

      if (collection === 'bibleStudies') updateState(setBibleStudies);
      else if (collection === 'bibleClasses') updateState(setBibleClasses);
      else if (collection === 'smallGroups') updateState(setSmallGroups);
      else if (collection === 'staffVisits') updateState(setStaffVisits);
      else if (collection === 'visitRequests') updateState(setVisitRequests);
      else if (collection === 'proStaff') updateState(setProStaff);
      else if (collection === 'proPatients') updateState(setProPatients);
      else if (collection === 'proProviders') updateState(setProProviders);
      else if (collection === 'proSectors') updateState(setProSectors);
      else if (collection === 'proGroups') updateState(setProGroups);
      else if (collection === 'proGroupLocations') updateState(setProGroupLocations);
      else if (collection === 'proGroupMembers') updateState(setProGroupMembers);
      else if (collection === 'proGroupProviderMembers') updateState(setProGroupProviderMembers);
      else if (collection === 'proMonthlyStats') updateState(setProMonthlyStats);
      else if (collection === 'proHistoryRecords') updateState(setProHistoryRecords);
      else if (collection === 'ambassadors') updateState(setAmbassadors);
      else if (collection === 'activitySchedules') updateState(setActivitySchedules);
      else if (collection === 'dailyActivityReports') updateState(setDailyActivityReports);
      else if (collection === 'bibleClassAttendees') updateState(setBibleClassAttendees);
      else if (collection === 'editAuthorizations') updateState(setEditAuthorizations);
      else if (collection === 'users') updateState(setUsers);
      else if (collection === 'config' && updatedItems[0]) setConfig(updatedItems[0]);

      return true;
    }
    return false;
  }, []);

  /**
   * ULTIMATE_ENTITY_SYNC_ENGINE (V4.1 - Enhanced Sector Healing)
   * Motor de persistência centralizada para contatos e vínculos.
   * Garante que o banco mestre RH reflita correções de telefone E SETOR feitas em formulários.
   */
  const syncMasterContact = async (name: string, phone: string, unit: Unit, type: ParticipantType, extra?: string) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!name) return; // Nome é obrigatório para localizar

    const normName = normalizeString(name);

    if (type === ParticipantType.STAFF) {
        // Localiza pelo nome normalizado e unidade
        const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
        if (staff) {
            const updates: any = {};
            let hasUpdates = false;

            // 1. Cura do Telefone
            if (cleanPhone && cleanPhone.length >= 8 && cleanPhone !== (staff.whatsapp || '')) {
                updates.whatsapp = cleanPhone;
                hasUpdates = true;
            }

            // 2. Cura do Vínculo de Setor (O "Imã")
            // Se um setor foi informado (extra) e é diferente do atual, move o colaborador.
            if (extra) {
                const targetSector = proSectors.find(s => s.name === extra && s.unit === unit);
                if (targetSector && staff.sectorId !== targetSector.id) {
                    updates.sectorId = targetSector.id;
                    updates.updatedAt = Date.now();
                    hasUpdates = true;
                }
            }

            if (hasUpdates) {
                // Atualização silenciosa do RH oficial
                await saveRecord('proStaff', { ...staff, ...updates });
                
                // 3. Cura de Escalas Futuras (VisitRequests)
                // Se o telefone foi atualizado, atualiza também as escalas pendentes desse líder
                if (updates.whatsapp) {
                    const pendingRequests = visitRequests.filter(req => 
                        req.unit === unit && 
                        req.status === 'assigned' && 
                        normalizeString(req.leaderName) === normName &&
                        req.leaderPhone !== updates.whatsapp
                    );
                    
                    for (const req of pendingRequests) {
                        await saveRecord('visitRequests', { ...req, leaderPhone: updates.whatsapp });
                    }
                }
            }
        }
    } else if (type === ParticipantType.PATIENT) {
        const patient = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!patient || (cleanPhone && cleanPhone !== (patient.whatsapp || ''))) {
            const payload: ProPatient = patient 
                ? { ...patient, whatsapp: cleanPhone || patient.whatsapp, updatedAt: Date.now() }
                : { id: crypto.randomUUID(), name, unit, whatsapp: cleanPhone, updatedAt: Date.now() };
            await saveRecord('proPatients', payload);
        }
    } else if (type === ParticipantType.PROVIDER) {
        const provider = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!provider || (cleanPhone && cleanPhone !== (provider.whatsapp || '')) || (extra && extra !== provider.sector)) {
            const payload: ProProvider = provider
                ? { ...provider, whatsapp: cleanPhone || provider.whatsapp, sector: extra || provider.sector, updatedAt: Date.now() }
                : { id: crypto.randomUUID(), name, unit, whatsapp: cleanPhone, sector: extra, updatedAt: Date.now() };
            await saveRecord('proProviders', payload);
        }
    }
  };

  const deleteRecord = async (collection: string, id: string) => {
    const success = await DataRepository.deleteRecord(collection, id);
    if (success) {
      // Remoção Incremental do Estado Local
      const removeState = (setter: any) => {
        setter((prev: any[]) => prev.filter(i => i.id !== id));
      };

      if (collection === 'bibleStudies') removeState(setBibleStudies);
      else if (collection === 'bibleClasses') removeState(setBibleClasses);
      else if (collection === 'smallGroups') removeState(setSmallGroups);
      else if (collection === 'staffVisits') removeState(setStaffVisits);
      else if (collection === 'visitRequests') removeState(setVisitRequests);
      else if (collection === 'proStaff') removeState(setProStaff);
      else if (collection === 'proPatients') removeState(setProPatients);
      else if (collection === 'proProviders') removeState(setProProviders);
      else if (collection === 'proSectors') removeState(setProSectors);
      else if (collection === 'proGroups') removeState(setProGroups);
      else if (collection === 'proGroupLocations') removeState(setProGroupLocations);
      else if (collection === 'proGroupMembers') removeState(setProGroupMembers);
      else if (collection === 'proGroupProviderMembers') removeState(setProGroupProviderMembers);
      else if (collection === 'proMonthlyStats') removeState(setProMonthlyStats);
      else if (collection === 'proHistoryRecords') removeState(setProHistoryRecords);
      else if (collection === 'ambassadors') removeState(setAmbassadors);
      else if (collection === 'users') removeState(setUsers);
      else if (collection === 'activitySchedules') removeState(setActivitySchedules);
      else if (collection === 'dailyActivityReports') removeState(setDailyActivityReports);
      else if (collection === 'bibleClassAttendees') removeState(setBibleClassAttendees);
      else if (collection === 'editAuthorizations') removeState(setEditAuthorizations);
    }
    return success;
  };

  const saveToCloud = useCallback(async (overrides?: any, showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      if (overrides?.config) await saveRecord('config', overrides.config);
      if (overrides?.users) await saveRecord('users', overrides.users);
      if (overrides?.proSectors) await saveRecord('proSectors', overrides.proSectors);
      if (overrides?.proStaff) await saveRecord('proStaff', overrides.proStaff);
      if (overrides?.proPatients) await saveRecord('proPatients', overrides.proPatients);
      if (overrides?.proProviders) await saveRecord('proProviders', overrides.proProviders);
      if (overrides?.proGroups) await saveRecord('proGroups', overrides.proGroups);
      if (overrides?.proGroupLocations) await saveRecord('proGroupLocations', overrides.proGroupLocations);
      if (overrides?.proGroupMembers) await saveRecord('proGroupMembers', overrides.proGroupMembers);
      if (overrides?.proGroupProviderMembers) await saveRecord('proGroupProviderMembers', overrides.proGroupProviderMembers);
      if (overrides?.proMonthlyStats) await saveRecord('proMonthlyStats', overrides.proMonthlyStats);
      if (overrides?.proHistoryRecords) await saveRecord('proHistoryRecords', overrides.proHistoryRecords);
      if (overrides?.ambassadors) await saveRecord('ambassadors', overrides.ambassadors);
      return true;
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [saveRecord]);

  useEffect(() => {
    if (!isInitialized) {
      const init = async () => {
        await loadFromCloud(true);
        setIsInitialized(true);
      };
      init();
    }
  }, [loadFromCloud, isInitialized]);

  // Sincronização automática de estudantes nas classes bíblicas quando os participantes mudam
  useEffect(() => {
    setBibleClasses(prevClasses => {
      let hasChanges = false;
      const nextClasses = prevClasses.map(cls => {
        const students = bibleClassAttendees
          .filter(a => a.classId === cls.id)
          .map(a => a.studentName);
        
        // Compara se a lista de estudantes mudou
        const currentStudents = cls.students || [];
        if (students.length !== currentStudents.length || !students.every(s => currentStudents.includes(s))) {
          hasChanges = true;
          return { ...cls, students };
        }
        return cls;
      });
      return hasChanges ? nextClasses : prevClasses;
    });
  }, [bibleClassAttendees]);

  return {
    users, setUsers, bibleStudies, setBibleStudies, bibleClasses, setBibleClasses, smallGroups, setSmallGroups, staffVisits, setStaffVisits, visitRequests, setVisitRequests,
    proStaff, setProStaff, proPatients, setProPatients, proProviders, setProProviders, proSectors, setProSectors, proGroups, setProGroups, proGroupLocations, setProGroupLocations, proGroupMembers, setProGroupMembers, proGroupProviderMembers, setProGroupProviderMembers, proMonthlyStats, setProMonthlyStats, proHistoryRecords, setProHistoryRecords, ambassadors, setAmbassadors,
    activitySchedules, setActivitySchedules, dailyActivityReports, setDailyActivityReports, bibleClassAttendees, setBibleClassAttendees,
    editAuthorizations, setEditAuthorizations,
    config, setConfig, isSyncing, isConnected, isInitialized,
    loadFromCloud, saveToCloud, saveRecord, deleteRecord, applySystemOverrides, syncMasterContact
  };
};
