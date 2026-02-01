import { useState, useEffect, useCallback } from 'react';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, MasterLists, Config, UserRole, VisitRequest } from '../types';
import { DataRepository } from '../services/dataRepository';
import { SyncService } from '../services/syncService';
import { INITIAL_CONFIG } from '../constants';
import { hashPassword } from '../utils/crypto';

export const useAppData = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [bibleStudies, setBibleStudies] = useState<BibleStudy[]>([]);
  const [bibleClasses, setBibleClasses] = useState<BibleClass[]>([]);
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([]);
  const [staffVisits, setStaffVisits] = useState<StaffVisit[]>([]);
  const [visitRequests, setVisitRequests] = useState<VisitRequest[]>([]);
  const [masterLists, setMasterLists] = useState<MasterLists>({
    sectorsHAB: [], sectorsHABA: [], staffHAB: [], staffHABA: [], groupsHAB: [], groupsHABA: []
  });
  
  const [config, setConfig] = useState<Config>(INITIAL_CONFIG);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLabMode, setIsLabMode] = useState(false);

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
        if (data.masterLists) setMasterLists(data.masterLists);
        if (data.config) {
          setConfig(data.config);
          applySystemOverrides(data.config);
        }
        setIsConnected(true);
        setIsLabMode(false);
      }
    } catch (e) {
      setIsConnected(false);
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [applySystemOverrides]);

  const saveRecord = async (collection: string, item: any) => {
    const success = await DataRepository.upsertRecord(collection, item);
    if (success) await loadFromCloud(false);
    return success;
  };

  const deleteRecord = async (collection: string, id: string) => {
    const success = await DataRepository.deleteRecord(collection, id);
    if (success) await loadFromCloud(false);
    return success;
  };

  const saveToCloud = useCallback(async (overrides?: any, showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      if (overrides?.config) await DataRepository.upsertRecord('config', overrides.config);
      if (overrides?.masterLists) await DataRepository.upsertRecord('masterLists', overrides.masterLists);
      if (overrides?.users) await DataRepository.upsertRecord('users', overrides.users);
      await loadFromCloud(false);
      return true;
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [loadFromCloud]);

  const importFromDNA = async (dnaData: any): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      const db = dnaData.database || dnaData;
      
      // 1. Obter dados atuais do banco para resolver conflitos de e-mail
      const currentData = await DataRepository.syncAll();
      const existingUsers = currentData?.users || [];
      const adminEmail = "pastorescopel@gmail.com";
      
      // Criar mapa de E-mail -> ID real do banco
      const emailToIdMap: Record<string, string> = {};
      existingUsers.forEach(u => {
        emailToIdMap[u.email.toLowerCase()] = u.id;
      });

      // 2. Processar usuários do backup e mapear IDs
      const backupUsers = Array.isArray(db.users) ? db.users : [];
      const usersToUpsert: User[] = [];
      const legacyIdToNewIdMap: Record<string, string> = {};

      for (const bUser of backupUsers) {
        const email = bUser.email?.toLowerCase().trim();
        const oldId = bUser.id || bUser.ID;
        
        let targetId: string;

        // Caso especial: Usuário admin ou e-mail mestre
        if (oldId === 'admin' || email === adminEmail) {
          targetId = emailToIdMap[adminEmail] || crypto.randomUUID();
          legacyIdToNewIdMap['admin'] = targetId;
          legacyIdToNewIdMap[oldId] = targetId;
        } else if (emailToIdMap[email]) {
          // E-mail já existe no banco, usa o ID que já está lá para evitar 409
          targetId = emailToIdMap[email];
          legacyIdToNewIdMap[oldId] = targetId;
        } else {
          // Novo usuário, gera UUID robusto
          targetId = crypto.randomUUID();
          legacyIdToNewIdMap[oldId] = targetId;
        }

        usersToUpsert.push({
          ...bUser,
          id: targetId,
          email: email || `user_${crypto.randomUUID().slice(0,8)}@temp.com`,
          role: (oldId === 'admin' || email === adminEmail) ? UserRole.ADMIN : (bUser.role || UserRole.CHAPLAIN)
        });
      }

      // 3. Upsert de usuários (em massa)
      if (usersToUpsert.length > 0) {
        await DataRepository.upsertRecord('users', usersToUpsert);
      }

      // 4. Mapear e preparar atividades (em massa)
      const processCollection = async (backupKey: string, repoKey: string) => {
        const data = db[backupKey] || db[backupKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)];
        if (!data || !Array.isArray(data)) return;

        const mappedData = data.map(item => {
          const oldUid = item.userId || item.user_id;
          return {
            ...item,
            id: (item.id && item.id.length > 20) ? item.id : crypto.randomUUID(), // Garante UUID se o original for curto/legado
            userId: legacyIdToNewIdMap[oldUid] || legacyIdToNewIdMap['admin'] || usersToUpsert[0]?.id
          };
        });

        if (mappedData.length > 0) {
          await DataRepository.upsertRecord(repoKey, mappedData);
        }
      };

      await processCollection('bibleStudies', 'bibleStudies');
      await processCollection('bibleClasses', 'bibleClasses');
      await processCollection('smallGroups', 'smallGroups');
      await processCollection('staffVisits', 'staffVisits');

      // 5. Configurações e Listas
      if (db.config || db.app_config) await DataRepository.upsertRecord('config', db.config || db.app_config);
      if (db.masterLists || db.master_lists) await DataRepository.upsertRecord('masterLists', db.masterLists || db.master_lists);

      await loadFromCloud(true);
      return { success: true, message: "DNA Restaurado com sucesso e conflitos resolvidos!" };
    } catch (error: any) {
      console.error("Erro Crítico na Migração:", error);
      return { success: false, message: error.message || "Erro desconhecido durante a migração." };
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!isInitialized) {
      loadFromCloud(true);
      setIsInitialized(true);
    }
  }, [loadFromCloud, isInitialized]);

  return {
    users, bibleStudies, bibleClasses, smallGroups, staffVisits, visitRequests, masterLists,
    config, isSyncing, isConnected, isLabMode, loadFromCloud, saveToCloud, saveRecord, deleteRecord,
    hashPassword, applySystemOverrides, importFromDNA
  };
};