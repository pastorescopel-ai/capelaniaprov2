
import { useState, useEffect, useCallback } from 'react';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, MasterLists, Config, UserRole, VisitRequest, ProStaff, ProSector, ProGroup, Unit } from '../types';
import { DataRepository } from '../services/dataRepository';
import { INITIAL_CONFIG } from '../constants';
import { supabase } from '../services/supabaseClient';

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
  
  const [proStaff, setProStaff] = useState<ProStaff[]>([]);
  const [proSectors, setProSectors] = useState<ProSector[]>([]);
  const [proGroups, setProGroups] = useState<ProGroup[]>([]);
  
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
        setProSectors(data.proSectors || []);
        setProGroups(data.proGroups || []);
        if (data.masterLists) setMasterLists(data.masterLists);
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
    const channel = supabase.channel('realtime-db').on('postgres_changes', { event: '*', schema: 'public' }, () => loadFromCloud(false)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadFromCloud]);

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
      if (overrides?.config) await saveRecord('config', overrides.config);
      if (overrides?.masterLists) await saveRecord('masterLists', overrides.masterLists);
      if (overrides?.users) await saveRecord('users', overrides.users);
      if (overrides?.proSectors) await saveRecord('proSectors', overrides.proSectors);
      if (overrides?.proStaff) await saveRecord('proStaff', overrides.proStaff);
      if (overrides?.proGroups) await saveRecord('proGroups', overrides.proGroups);
      return true;
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [saveRecord]);

  const nuclearReset = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Supabase não conectado." };
    setIsSyncing(true);
    try {
      // 1. Pegar dados da MasterList ANTES de apagar qualquer coisa
      const { data: mlRecords } = await supabase.from('master_lists').select('*').limit(1);
      const mlData = mlRecords && mlRecords.length > 0 ? mlRecords[0] : null;
      
      if (!mlData) {
          throw new Error("As Listas de Texto (Excel) estão vazias no servidor. Adicione os setores na aba Excel antes de executar o reset.");
      }

      // 2. Limpeza das tabelas relacionais
      console.log("Integridade verificada. Iniciando PURGE...");
      await supabase.from('pro_staff').delete().neq('id', '_PURGE_');
      await supabase.from('pro_groups').delete().neq('id', '_PURGE_');
      await supabase.from('pro_sectors').delete().neq('id', '_PURGE_');

      const newSectors: ProSector[] = [];
      const processList = (list: string[], unit: Unit) => {
        if (!Array.isArray(list)) return;
        list.forEach(item => {
          if (!item || !item.trim()) return;
          const parts = item.split(/[_-]/);
          const rawId = parts[0].trim().toUpperCase().replace('HAB', '').replace('HABA', '').replace('A', '');
          const cleanId = rawId.replace(/\D/g, ''); 
          const name = parts.slice(1).join(' ').trim();
          
          if (cleanId && name) {
            newSectors.push({ id: cleanId, name, unit });
          }
        });
      };

      processList(mlData.sectors_hab || [], Unit.HAB);
      processList(mlData.sectors_haba || [], Unit.HABA);

      // 3. Inserir Setores Limpos
      if (newSectors.length > 0) {
        await DataRepository.upsertRecord('proSectors', newSectors);
      }

      await loadFromCloud(true);
      return { success: true, message: `Reset concluído! ${newSectors.length} setores reconstruídos.` };
    } catch (e: any) {
      console.error("Erro no Reset Nuclear:", e);
      return { success: false, message: e.message };
    } finally {
      setIsSyncing(false);
    }
  };

  const unifyNumericIdsAndCleanPrefixes = async (): Promise<{ success: boolean; message: string }> => {
     return await nuclearReset();
  };

  const migrateLegacyStructure = async (): Promise<{ success: boolean; message: string; details?: string }> => {
    setIsSyncing(true);
    try {
      const current = await DataRepository.syncAll();
      if (!current || !current.masterLists) throw new Error("Listas não encontradas.");

      const { sectorsHAB, sectorsHABA } = current.masterLists;
      const newSectorsMap = new Map<string, ProSector>();

      const parseLegacy = (list: string[], unit: Unit) => {
        list.forEach(item => {
          if (!item || !item.trim()) return;
          const clean = item.trim();
          let rawId = '', name = '';
          
          if (clean.includes('_')) {
            const p = clean.split('_');
            rawId = p[0];
            name = p.slice(1).filter(x => x !== 'HAB' && x !== 'HABA').join(' ');
          } else if (clean.includes(' - ')) {
            const p = clean.split(' - ');
            rawId = p[0];
            name = p.slice(1).join(' ');
          } else if (/^\d+\s/.test(clean)) {
            const idx = clean.indexOf(' ');
            rawId = clean.substring(0, idx);
            name = clean.substring(idx + 1);
          }

          if (rawId && name) {
            const cleanId = rawId.trim().toUpperCase().replace('HAB', '').replace('HABA', '').replace('-', '');
            newSectorsMap.set(cleanId, { id: cleanId, name: name.trim(), unit });
          }
        });
      };

      if (Array.isArray(sectorsHAB)) parseLegacy(sectorsHAB, Unit.HAB);
      if (Array.isArray(sectorsHABA)) parseLegacy(sectorsHABA, Unit.HABA);

      const sectorsToUpsert: ProSector[] = Array.from(newSectorsMap.values());
      if (sectorsToUpsert.length === 0) return { success: false, message: "Nenhum setor novo para migrar." };

      await DataRepository.upsertRecord('proSectors', sectorsToUpsert);
      
      await loadFromCloud(true);
      return { 
        success: true, 
        message: "Migração concluída!", 
        details: `${sectorsToUpsert.length} setores normalizados.` 
      };
    } catch (e: any) {
      return { success: false, message: e.message };
    } finally {
      setIsSyncing(false);
    }
  };

  const importFromDNA = async (dnaData: any) => {
      setIsSyncing(true);
      try {
          const db = dnaData.database || dnaData;
          if(db.proSectors) await DataRepository.upsertRecord('proSectors', db.proSectors);
          if(db.proStaff) await DataRepository.upsertRecord('proStaff', db.proStaff);
          if(db.proGroups) await DataRepository.upsertRecord('proGroups', db.proGroups);
          if(db.users) await DataRepository.upsertRecord('users', db.users);
          await loadFromCloud(true);
          return { success: true, message: "Restauração completa!" };
      } catch(e:any) {
          return { success: false, message: e.message };
      } finally {
          setIsSyncing(false);
      }
  };

  useEffect(() => {
    if (!isInitialized) { loadFromCloud(true); setIsInitialized(true); }
  }, [loadFromCloud, isInitialized]);

  return {
    users, bibleStudies, bibleClasses, smallGroups, staffVisits, visitRequests, masterLists,
    proStaff, proSectors, proGroups, config, isSyncing, isConnected, 
    loadFromCloud, saveToCloud, saveRecord, deleteRecord, applySystemOverrides, 
    importFromDNA, migrateLegacyStructure, unifyNumericIdsAndCleanPrefixes, nuclearReset
  };
};
