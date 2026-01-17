
import { useState, useEffect, useCallback } from 'react';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, MasterLists, Config, Unit, UserRole } from '../types';
import { syncService } from '../services/syncService';
import { INITIAL_CONFIG, GOOGLE_SCRIPT_URL } from '../constants';

// Função de Segurança: SHA-256 para senhas
const hashPassword = async (password: string) => {
  if (!password || password === 'admin') return password; 
  const msgUint8 = new TextEncoder().encode("CP_SALT_" + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const SEC_PREFIX = "CP_V2_";
const encodeData = (str: string) => btoa(unescape(encodeURIComponent(SEC_PREFIX + str)));
const decodeData = (str: string) => {
  try {
    const decoded = decodeURIComponent(escape(atob(str)));
    return decoded.startsWith(SEC_PREFIX) ? decoded.replace(SEC_PREFIX, "") : decoded;
  } catch (e) {
    return str;
  }
};

export const useAppData = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [bibleStudies, setBibleStudies] = useState<BibleStudy[]>([]);
  const [bibleClasses, setBibleClasses] = useState<BibleClass[]>([]);
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([]);
  const [staffVisits, setStaffVisits] = useState<StaffVisit[]>([]);
  const [masterLists, setMasterLists] = useState<MasterLists>({
    sectorsHAB: [], sectorsHABA: [], staffHAB: [], staffHABA: [], groupsHAB: [], groupsHABA: []
  });
  
  const applySystemOverrides = (baseConfig: Config): Config => {
    if (!baseConfig) return INITIAL_CONFIG;
    return { ...baseConfig, googleSheetUrl: GOOGLE_SCRIPT_URL };
  };

  const [config, setConfig] = useState<Config>(applySystemOverrides(INITIAL_CONFIG));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(window.navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadFromCloud = useCallback(async (showLoader = false) => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('URL_EXEMPLO')) return;
    if (showLoader) setIsSyncing(true);
    try {
      syncService.setScriptUrl(GOOGLE_SCRIPT_URL);
      const cloudData = await syncService.syncFromCloud();
      if (cloudData) {
        if (Array.isArray(cloudData.users)) {
          const rawUsers = cloudData.users.map((u: User) => ({
            ...u,
            email: decodeData(u.email),
            password: u.password 
          }));

          // UNIFICAÇÃO LÓGICA REFORÇADA: Prioriza IDs reais da planilha sobre 'admin-root'
          const userMap = new Map<string, User>();
          rawUsers.forEach(u => {
            const emailKey = u.email.toLowerCase().trim();
            const existing = userMap.get(emailKey);
            
            // Lógica: Se não houver, adiciona. Se houver e o atual for o real (original) e o existente for temporário (root), substitui.
            if (!existing || (existing.id === 'admin-root' && u.id !== 'admin-root')) {
              userMap.set(emailKey, u);
            }
          });
          
          setUsers(Array.from(userMap.values()));
        }
        if (Array.isArray(cloudData.bibleStudies)) setBibleStudies(cloudData.bibleStudies);
        if (Array.isArray(cloudData.bibleClasses)) setBibleClasses(cloudData.bibleClasses);
        if (Array.isArray(cloudData.smallGroups)) setSmallGroups(cloudData.smallGroups);
        if (Array.isArray(cloudData.staffVisits)) setStaffVisits(cloudData.staffVisits);
        if (cloudData.masterLists) setMasterLists(prev => ({ ...prev, ...cloudData.masterLists }));
        if (cloudData.config) setConfig(applySystemOverrides(cloudData.config));
        setIsConnected(true);
      }
    } catch (e) {
      setIsConnected(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const saveToCloud = useCallback(async (overrides?: any, showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    syncService.setScriptUrl(GOOGLE_SCRIPT_URL);
    
    if (overrides) {
      if (overrides.users) setUsers(overrides.users);
      if (overrides.bibleStudies) setBibleStudies(overrides.bibleStudies);
      if (overrides.bibleClasses) setBibleClasses(overrides.bibleClasses);
      if (overrides.smallGroups) setSmallGroups(overrides.smallGroups);
      if (overrides.staffVisits) setStaffVisits(overrides.staffVisits);
      if (overrides.config) setConfig(applySystemOverrides(overrides.config));
      if (overrides.masterLists) setMasterLists(overrides.masterLists);
    }

    const currentUsers = overrides?.users || users;
    const securedUsers = currentUsers.map((u: User) => ({
      ...u,
      email: encodeData(u.email),
      password: u.password 
    }));

    const payload = {
      users: securedUsers,
      bibleStudies: overrides?.bibleStudies ?? bibleStudies,
      bibleClasses: overrides?.bibleClasses ?? bibleClasses,
      smallGroups: overrides?.smallGroups ?? smallGroups,
      staffVisits: overrides?.staffVisits ?? staffVisits,
      masterLists: overrides?.masterLists ?? masterLists,
      config: overrides?.config ?? config,
    };

    try {
      const success = await syncService.saveToCloud(payload);
      setIsConnected(success);
      return success;
    } catch (err) {
      setIsConnected(false);
      return false;
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [config, users, bibleStudies, bibleClasses, smallGroups, staffVisits, masterLists]);

  useEffect(() => {
    const init = async () => {
      const localUsers = syncService.getLocal<User[]>('users');
      if (localUsers) setUsers(localUsers);
      const localStudies = syncService.getLocal<BibleStudy[]>('bibleStudies');
      if (localStudies) setBibleStudies(localStudies);
      const localClasses = syncService.getLocal<BibleClass[]>('bibleClasses');
      if (localClasses) setBibleClasses(localClasses);
      const localGroups = syncService.getLocal<SmallGroup[]>('smallGroups');
      if (localGroups) setSmallGroups(localGroups);
      const localVisits = syncService.getLocal<StaffVisit[]>('staffVisits');
      if (localVisits) setStaffVisits(localVisits);
      const localLists = syncService.getLocal<MasterLists>('masterLists');
      if (localLists) setMasterLists(localLists);
      const localConfig = syncService.getLocal<Config>('config');
      if (localConfig) setConfig(applySystemOverrides(localConfig));
      
      await loadFromCloud(true);
      setIsInitialized(true);
    };
    init();
  }, [loadFromCloud]);

  useEffect(() => {
    if (!isInitialized) return;
    syncService.setLocal('users', users);
    syncService.setLocal('bibleStudies', bibleStudies);
    syncService.setLocal('bibleClasses', bibleClasses);
    syncService.setLocal('smallGroups', smallGroups);
    syncService.setLocal('staffVisits', staffVisits);
    syncService.setLocal('masterLists', masterLists);
    syncService.setLocal('config', config);
  }, [users, bibleStudies, bibleClasses, smallGroups, staffVisits, masterLists, config, isInitialized]);

  return {
    users, setUsers, bibleStudies, setBibleStudies, bibleClasses, setBibleClasses,
    smallGroups, setSmallGroups, staffVisits, setStaffVisits, masterLists, setMasterLists,
    config, setConfig, isSyncing, isConnected, isInitialized, loadFromCloud, saveToCloud, applySystemOverrides, hashPassword
  };
};
