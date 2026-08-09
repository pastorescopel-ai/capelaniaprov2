
import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config, VisitRequest, ProStaff, ProSector, ProGroup, ProGroupLocation, ProGroupMember, ProGroupProviderMember, ProPatient, ProProvider, ProMonthlyStats, EditAuthorization, ProHistoryRecord } from '../types';
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
    bibleClassAttendees: setBibleClassAttendees,
    editAuthorizations: setEditAuthorizations,
    config: setConfig
  }), []);

  // 1. Data Actions (Load, Save, Delete, Refresh)
  const { loadFromCloud, refreshData, saveRecord, deleteRecord, deleteRecordsByFilter } = useDataActions(
    setters, 
    setIsSyncing, 
    setIsConnected, 
    applySystemOverrides
  );

  // 2. Realtime Synchronization
  useRealtimeSync(setters, refreshData);

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
      let allSucceeded = true;
      if (overrides?.config) allSucceeded = await saveRecord('config', overrides.config) && allSucceeded;
      if (overrides?.users) allSucceeded = await saveRecord('users', overrides.users) && allSucceeded;
      if (overrides?.proSectors) allSucceeded = await saveRecord('proSectors', overrides.proSectors) && allSucceeded;
      if (overrides?.proStaff) allSucceeded = await saveRecord('proStaff', overrides.proStaff) && allSucceeded;
      if (overrides?.proPatients) allSucceeded = await saveRecord('proPatients', overrides.proPatients) && allSucceeded;
      if (overrides?.proProviders) allSucceeded = await saveRecord('proProviders', overrides.proProviders) && allSucceeded;
      if (overrides?.proGroups) allSucceeded = await saveRecord('proGroups', overrides.proGroups) && allSucceeded;
      if (overrides?.proGroupLocations) allSucceeded = await saveRecord('proGroupLocations', overrides.proGroupLocations) && allSucceeded;
      if (overrides?.proGroupMembers) allSucceeded = await saveRecord('proGroupMembers', overrides.proGroupMembers) && allSucceeded;
      if (overrides?.proGroupProviderMembers) allSucceeded = await saveRecord('proGroupProviderMembers', overrides.proGroupProviderMembers) && allSucceeded;
      if (overrides?.proMonthlyStats) allSucceeded = await saveRecord('proMonthlyStats', overrides.proMonthlyStats) && allSucceeded;
      if (overrides?.proHistoryRecords) allSucceeded = await saveRecord('proHistoryRecords', overrides.proHistoryRecords) && allSucceeded;
      if (overrides?.ambassadors) allSucceeded = await saveRecord('ambassadors', overrides.ambassadors) && allSucceeded;
      return allSucceeded;
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

  // Auto-refresh inteligente ao focar ou reativar a janela (crucial para o iOS/Safari PWA)
  // Além de um polling de segurança a cada 30 segundos
  useEffect(() => {
    let lastRefresh = 0;
    const throttleTime = 5000; // Evita múltiplas chamadas consecutivas em menos de 5s

    const triggerRefresh = () => {
      const now = Date.now();
      if (now - lastRefresh > throttleTime) {
        lastRefresh = now;
        console.log("🔄 Reativando/Focando app (ou Polling): Atualizando dados do Supabase...");
        refreshData();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    const handleFocus = () => {
      triggerRefresh();
    };

    // Polling de segurança independente do realtime
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    }, 30000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshData]);

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
    bibleClassAttendees, setBibleClassAttendees,
    editAuthorizations, setEditAuthorizations,
    config, setConfig, isSyncing, isConnected, isInitialized,
    loadFromCloud, saveToCloud, saveRecord, deleteRecord, deleteRecordsByFilter, refreshData, applySystemOverrides, syncMasterContact
  };
};
