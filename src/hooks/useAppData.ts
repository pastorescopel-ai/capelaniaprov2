
import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config, VisitRequest, ProStaff, ProSector, ProGroup, ProGroupLocation, ProGroupMember, ProGroupProviderMember, ProPatient, ProProvider, ProMonthlyStats, ProHistoryRecord } from '../types';
import { INITIAL_CONFIG } from '../constants';
import { useRealtimeSync } from './useRealtimeSync';
import { useDataActions } from './useDataActions';
import { useMasterSync } from './useMasterSync';
import { supabase } from '../services/supabaseClient';

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
  // loadFromCloud só espera a fase "core" (rápida) antes de marcar isInitialized — a fase
  // "background" (proStaff, proGroupMembers, histórico etc.) roda em segundo plano e não é
  // aguardada. Telas como a Auditoria de Qualidade, que calculam anomalias em cima justamente
  // desses dados de background, precisam saber quando ESSA fase também termina, senão calculam
  // (e mostram por um instante) resultados errados a partir de arrays ainda vazios.
  const [isBackgroundSynced, setIsBackgroundSynced] = useState(false);

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
    config: setConfig
  }), []);

  // 1. Data Actions (Load, Save, Delete, Refresh)
  const { loadFromCloud, refreshData, saveRecord, deleteRecord, deleteRecordsByFilter } = useDataActions(
    setters,
    setIsSyncing,
    setIsConnected,
    applySystemOverrides,
    setIsBackgroundSynced
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

  // Recuperação automática de "Offline" -- se a PRIMEIRA tentativa de carregar falhar (ex: o
  // app instalado abriu antes do Wi-Fi/dados reconectarem, um problema comum logo depois do
  // aparelho "acordar"), isConnected ficava preso em false pro resto da sessão: nada tentava
  // de novo sozinho, nem depois da internet voltar (o polling de foco/visibilidade em
  // useAppData.ts exige sessão autenticada, então nem roda na tela de login, que é
  // exatamente onde o "Offline" aparece). Aqui, sem depender de estar logado: reage ao evento
  // 'online' do navegador, e também tenta de novo sozinho depois de alguns segundos caso esse
  // evento não dispare (alguns WebViews/PWAs instalados não são consistentes nisso).
  useEffect(() => {
    if (!isInitialized || isConnected) return;

    const retry = () => { loadFromCloud(true); };

    window.addEventListener('online', retry);
    // Repete a cada 10s enquanto continuar offline -- só um único fallbackTimer não seria
    // suficiente se a rede ainda estiver instável na primeira nova tentativa também.
    const fallbackInterval = setInterval(retry, 10000);

    return () => {
      window.removeEventListener('online', retry);
      clearInterval(fallbackInterval);
    };
  }, [isInitialized, isConnected, loadFromCloud]);

  // Auto-refresh inteligente ao focar ou reativar a janela (crucial para o iOS/Safari PWA)
  // Além de um polling de segurança a cada 30 segundos
  useEffect(() => {
    let lastRefresh = 0;
    const throttleTime = 5000; // Evita múltiplas chamadas consecutivas em menos de 5s

    const triggerRefresh = async () => {
      const now = Date.now();
      if (now - lastRefresh <= throttleTime) return;

      // Este hook roda fora do AuthProvider (AppProvider engloba o AuthProvider na árvore),
      // então não tem acesso direto a isAuthenticated -- sem esta checagem, o polling de 30s
      // e o "voltar pro foco da aba" disparavam recarga de dados até na tela de login, sem
      // ninguém logado, gerando chamadas ao Supabase à toa (e o log repetido "Reativando/
      // Focando..." que aparecia mesmo parado na tela de login).
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
      }

      lastRefresh = now;
      console.log("🔄 Reativando/Focando app (ou Polling): Atualizando dados do Supabase...");
      refreshData();
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

  // Sincronização automática de estudantes (e do selo de Adventista) nas classes bíblicas
  useEffect(() => {
    setBibleClasses(prevClasses => {
      let hasChanges = false;
      const nextClasses = prevClasses.map(cls => {
        const attendeesOfClass = bibleClassAttendees.filter(a => a.classId === cls.id);
        const students = attendeesOfClass.map(a => a.studentName);
        const adventistStudents = attendeesOfClass.filter(a => a.isAdventist).map(a => a.studentName);

        const currentStudents = cls.students || [];
        const currentAdventists = cls.adventistStudents || [];
        const studentsChanged = students.length !== currentStudents.length || !students.every(s => currentStudents.includes(s));
        const adventistsChanged = adventistStudents.length !== currentAdventists.length || !adventistStudents.every(s => currentAdventists.includes(s));
        if (studentsChanged || adventistsChanged) {
          hasChanges = true;
          return { ...cls, students, adventistStudents };
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
    config, setConfig, isSyncing, isConnected, isInitialized, isBackgroundSynced,
    loadFromCloud, saveToCloud, saveRecord, deleteRecord, deleteRecordsByFilter, refreshData, applySystemOverrides, syncMasterContact
  };
};
