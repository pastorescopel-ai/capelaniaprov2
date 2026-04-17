
import { useCallback } from 'react';
import { DataRepository, SYNC_DATA_CACHE_KEY } from '../services/dataRepository';
import { supabase, checkSupabaseConnection } from '../services/supabaseClient';
import { toCamel } from '../utils/transformers';

export const useDataActions = (setters: Record<string, any>, setIsSyncing: (val: boolean) => void, setIsConnected: (val: boolean) => void, applySystemOverrides: (config: any) => void) => {
  
  const loadFromCloud = useCallback(async (showLoader = false, forceRefresh = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      // Verifica conexão real primeiro
      const isOnline = await checkSupabaseConnection();
      setIsConnected(isOnline);

      const data = await DataRepository.syncAll(forceRefresh);
      
      if (data) {
        Object.entries(data).forEach(([key, val]) => {
          if (setters[key]) {
            setters[key](val);
          }
        });
        if (data.config) {
          applySystemOverrides(data.config);
        }
      } else if (!isOnline) {
        // Se estiver offline e sem dados de syncAll, tenta carregar o que estiver no localStorage
        const cached = localStorage.getItem(SYNC_DATA_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          Object.entries(parsed).forEach(([key, val]) => {
            if (setters[key]) setters[key](val);
          });
          if (parsed.config) applySystemOverrides(parsed.config);
        }
      }
    } catch (e) {
      console.error("[useDataActions] Erro ao carregar dados:", e);
      setIsConnected(false);
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [setters, setIsSyncing, setIsConnected, applySystemOverrides]);

  const refreshData = useCallback(async (forceRefresh = true) => {
    setIsSyncing(true);
    try {
      const isOnline = await checkSupabaseConnection();
      setIsConnected(isOnline);

      const data = await DataRepository.syncAll(forceRefresh);
      const finalData = data || (isOnline ? null : JSON.parse(localStorage.getItem(SYNC_DATA_CACHE_KEY) || 'null'));

      if (finalData) {
        const collections = ['bibleStudies', 'bibleClasses', 'smallGroups', 'staffVisits', 'visitRequests', 'proGroups', 'proStaff', 'proSectors', 'proGroupMembers', 'proGroupLocations', 'proMonthlyStats', 'proHistoryRecords', 'config'];
        collections.forEach(key => {
          if (finalData[key] && setters[key]) {
            setters[key](finalData[key]);
          }
        });
      }
      return { success: !!finalData };
    } catch (err) {
      console.warn("[useDataActions] Erro ao atualizar dados:", err);
      return { success: false, error: err };
    } finally {
      setIsSyncing(false);
    }
  }, [setters, setIsSyncing, setIsConnected]);

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
