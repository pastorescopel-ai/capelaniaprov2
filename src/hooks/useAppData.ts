
import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config, VisitRequest, ProStaff, ProSector, ProGroup, ProGroupLocation, ProGroupMember, ProGroupProviderMember, ProPatient, ProProvider, ActivitySchedule, DailyActivityReport, ProMonthlyStats, EditAuthorization, ProHistoryRecord } from '../types';
import { INITIAL_CONFIG } from '../constants';
import { useRealtimeSync } from './useRealtimeSync';
import { useDataActions } from './useDataActions';
import { useMasterSync } from './useMasterSync';

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
  
  const [config, setConfig] = useState<Config>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('capelania_pro_config_data');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', parsed.primaryColor);
          }
          return parsed;
        } catch (e) {
          console.warn("Erro ao carregar cache de config:", e);
        }
      }
    }
    return INITIAL_CONFIG;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const applySystemOverrides = useCallback((baseConfig: Config) => {
    if (baseConfig.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', baseConfig.primaryColor);
    }
    return baseConfig;
  }, []);

  const setters = useMemo(() => ({
    users: setUsers,
    bibleStudies: setBibleStudies,
    bibleClasses: setBibleClasses,
    smallGroups: setSmallGroups,
    staffVisits: setStaffVisits,
    visitRequests: setVisitRequests,
    proStaff: setProStaff,
    proPatients: setProPatients,
    proProviders: setProProviders,
    proSectors: setProSectors,
    proGroups: setProGroups,
    proGroupLocations: setProGroupLocations,
    proGroupMembers: setProGroupMembers,
    proGroupProviderMembers: setProGroupProviderMembers,
    proMonthlyStats: setProMonthlyStats,
    proHistoryRecords: setProHistoryRecords,
    ambassadors: setAmbassadors,
    activitySchedules: setActivitySchedules,
    dailyActivityReports: setDailyActivityReports,
    bibleClassAttendees: setBibleClassAttendees,
    editAuthorizations: setEditAuthorizations,
    config: setConfig
  }), []);

  // 1. Realtime Synchronization
  useRealtimeSync(setters);

  // 2. Data Actions (Load, Save, Delete, Refresh)
  const { loadFromCloud, refreshData, saveRecord, deleteRecord, deleteRecordsByFilter } = useDataActions(
    setters, 
    setIsSyncing, 
    setIsConnected, 
    applySystemOverrides
  );

  // 3. Master Contact Sync
  const { syncMasterContact } = useMasterSync(
    proStaff, 
    proSectors, 
    proPatients, 
    proProviders, 
    visitRequests, 
    saveRecord
  );

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

  // Sincronização automática de estudantes nas classes bíblicas
  useEffect(() => {
    setBibleClasses(prevClasses => {
      let hasChanges = false;
      const nextClasses = prevClasses.map(cls => {
        const students = bibleClassAttendees
          .filter(a => a.classId === cls.id)
          .map(a => a.studentName);
        
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
    loadFromCloud, saveToCloud, saveRecord, deleteRecord, deleteRecordsByFilter, refreshData, applySystemOverrides, syncMasterContact
  };
};
