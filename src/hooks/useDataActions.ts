
import { useCallback } from 'react';
import { DataRepository } from '../services/dataRepository';
import { supabase } from '../services/supabaseClient';
import { toCamel } from '../utils/transformers';

export const useDataActions = (setters: Record<string, any>, setIsSyncing: (val: boolean) => void, setIsConnected: (val: boolean) => void, applySystemOverrides: (config: any) => void) => {
  
  const loadFromCloud = useCallback(async (showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      // 1. Fase Rápida/Crítica
      const startCore = performance.now();
      const coreData = await DataRepository.syncCore();
      console.log(`[Perf] syncCore demorou ${(performance.now() - startCore).toFixed(2)}ms`);
      if (coreData) {
        Object.entries(coreData).forEach(([key, val]) => {
          if (val !== null && setters[key]) {
            setters[key](val);
          }
        });
        if (coreData.config) {
          applySystemOverrides(coreData.config);
        }
        setIsConnected(true);
      }
      
      // 2. Fase Pesada/Background (não bloqueia o retorno)
      const startBg = performance.now();
      DataRepository.syncBackground().then(bgData => {
         console.log(`[Perf] syncBackground demorou ${(performance.now() - startBg).toFixed(2)}ms`);

         if (bgData) {
            Object.entries(bgData).forEach(([key, val]) => {
              if (val !== null && setters[key]) {
                setters[key](val);
              }
            });
         }
      }).catch(err => {
         console.error('Erro na fase background:', err);
      });
      
    } catch (e) {
      setIsConnected(false);
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [setters, setIsSyncing, setIsConnected, applySystemOverrides]);

  const refreshData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const startSyncAll = performance.now();
      const data = await DataRepository.syncAll();
      console.log(`[Perf] syncAll (refreshData) demorou ${(performance.now() - startSyncAll).toFixed(2)}ms`);
      if (data) {
        if (data.bibleStudies !== null) setters.bibleStudies(data.bibleStudies);
        if (data.bibleClasses !== null) setters.bibleClasses(data.bibleClasses);
        if (data.smallGroups !== null) setters.smallGroups(data.smallGroups);
        if (data.staffVisits !== null) setters.staffVisits(data.staffVisits);
        if (data.visitRequests !== null) setters.visitRequests(data.visitRequests);
        if (data.proGroups !== null) setters.proGroups(data.proGroups);
        if (data.proStaff !== null) setters.proStaff(data.proStaff);
        if (data.proSectors !== null) setters.proSectors(data.proSectors);
        if (data.proGroupMembers !== null) setters.proGroupMembers(data.proGroupMembers);
        if (data.proGroupLocations !== null) setters.proGroupLocations(data.proGroupLocations);
        if (data.proMonthlyStats !== null) setters.proMonthlyStats(data.proMonthlyStats);
        if (data.proHistoryRecords !== null) setters.proHistoryRecords(data.proHistoryRecords);
        if (data.config !== null) setters.config(data.config);
      }
      return { success: true };
    } catch (err) {
      console.error("Erro ao recarregar dados:", err);
      return { success: false, error: err };
    } finally {
      setIsSyncing(false);
    }
  }, [setters, setIsSyncing]);

  const saveRecord = useCallback(async (collection: string, item: any) => {
    const result = await DataRepository.upsertRecord(collection, item);

    if (result.success && result.data) {
      const updatedItems = result.data;
      const setter = setters[collection];
      
      if (!setter) return false;

      if (collection === 'config' && updatedItems[0]) {
        setter(updatedItems[0]);
        return true;
      }

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

      return true;
    }
    return false;
  }, [setters]);

  const deleteRecord = useCallback(async (collection: string, id: string) => {
    const success = await DataRepository.deleteRecord(collection, id);
    if (success) {
      const setter = setters[collection];
      if (setter) {
        setter((prev: any[]) => prev.filter(i => i.id !== id));
      }
    }
    return success;
  }, [setters]);

  const deleteRecordsByFilter = useCallback(async (collection: string, filters: Record<string, any>) => {
    const success = await DataRepository.deleteRecordsByFilter(collection, filters);
    if (success) {
      const setter = setters[collection];
      if (setter) {
        setter((prev: any[]) => prev.filter(i => {
          return !Object.entries(filters).every(([key, value]) => {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
                                .replace(/Haba/g, 'HABA').replace(/Hab/g, 'HAB');
            return i[camelKey] === value;
          });
        }));
      }
    }
    return success;
  }, [setters]);

  return { loadFromCloud, refreshData, saveRecord, deleteRecord, deleteRecordsByFilter };
};
