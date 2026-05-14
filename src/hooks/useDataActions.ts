
import { useCallback } from 'react';
import { DataRepository } from '../services/dataRepository';
import { supabase } from '../services/supabaseClient';
import { toCamel } from '../utils/transformers';

export const useDataActions = (setters: Record<string, any>, setIsSyncing: (val: boolean) => void, setIsConnected: (val: boolean) => void, applySystemOverrides: (config: any) => void) => {
  
  const loadFromCloud = useCallback(async (showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      const data = await DataRepository.syncAll();
      if (data) {
        console.log('📦 Dados carregados do Cloud:', {
          smallGroups: data.smallGroups?.length || 0,
          bibleStudies: data.bibleStudies?.length || 0,
          bibleClasses: data.bibleClasses?.length || 0,
          staffVisits: data.staffVisits?.length || 0
        });
        Object.entries(data).forEach(([key, val]) => {
          if (setters[key]) {
            setters[key](val);
          }
        });
        if (data.config) {
          applySystemOverrides(data.config);
        }
        setIsConnected(true);
      }
    } catch (e) {
      setIsConnected(false);
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [setters, setIsSyncing, setIsConnected, applySystemOverrides]);

  const refreshData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await DataRepository.syncAll();
      if (data) {
        setters.bibleStudies(data.bibleStudies);
        setters.bibleClasses(data.bibleClasses);
        setters.smallGroups(data.smallGroups);
        setters.staffVisits(data.staffVisits);
        setters.visitRequests(data.visitRequests);
        setters.proGroups(data.proGroups);
        setters.proStaff(data.proStaff);
        setters.proSectors(data.proSectors);
        setters.proGroupMembers(data.proGroupMembers);
        setters.proGroupLocations(data.proGroupLocations);
        setters.proMonthlyStats(data.proMonthlyStats);
        setters.proHistoryRecords(data.proHistoryRecords);
        setters.config(data.config);
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
