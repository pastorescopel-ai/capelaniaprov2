
import { useCallback } from 'react';
import { DataRepository } from '../services/dataRepository';
import { supabase } from '../services/supabaseClient';
import { toCamel } from '../utils/transformers';

export const useDataActions = (setters: Record<string, any>, setIsSyncing: (val: boolean) => void, setIsConnected: (val: boolean) => void, applySystemOverrides: (config: any) => void, setIsBackgroundSynced?: (val: boolean) => void) => {

  const loadFromCloud = useCallback(async (showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      // 1. Fase Rápida/Crítica
      const coreData = await DataRepository.syncCore();
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
      DataRepository.syncBackground().then(bgData => {

         if (bgData) {
            Object.entries(bgData).forEach(([key, val]) => {
              if (val !== null && setters[key]) {
                setters[key](val);
              }
            });
         }
         setIsBackgroundSynced?.(true);
      }).catch(err => {
         console.error('Erro na fase background:', err);
         // Mesmo em erro, marca como "tentado" pra não travar telas que esperam essa fase
         // (ex: Auditoria de Qualidade) num loading infinito.
         setIsBackgroundSynced?.(true);
      });

    } catch (e) {
      setIsConnected(false);
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [setters, setIsSyncing, setIsConnected, applySystemOverrides, setIsBackgroundSynced]);

  const refreshData = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 1. Fase Rápida/Crítica — aplica imediatamente (ex: Escala de Visitas PG)
      const core = await DataRepository.syncCore();
      if (core) {
        if (core.users !== null) setters.users(core.users);
        if (core.visitRequests !== null) setters.visitRequests(core.visitRequests);
        if (core.proSectors !== null) setters.proSectors(core.proSectors);
        if (core.proGroups !== null) setters.proGroups(core.proGroups);
        if (core.proGroupLocations !== null) setters.proGroupLocations(core.proGroupLocations);
        if (core.smallGroups !== null) setters.smallGroups(core.smallGroups);
        if (core.config !== null) setters.config(core.config);
      }

      // 2. Fase Pesada/Background — não bloqueia a atualização da fase rápida
      DataRepository.syncBackground().then(bg => {
        if (!bg) return;
        if (bg.bibleStudies !== null) setters.bibleStudies(bg.bibleStudies);
        if (bg.bibleClasses !== null) setters.bibleClasses(bg.bibleClasses);
        if (bg.staffVisits !== null) setters.staffVisits(bg.staffVisits);
        if (bg.proStaff !== null) setters.proStaff(bg.proStaff);
        if (bg.proGroupMembers !== null) setters.proGroupMembers(bg.proGroupMembers);
        if (bg.proMonthlyStats !== null) setters.proMonthlyStats(bg.proMonthlyStats);
        if (bg.proHistoryRecords !== null) setters.proHistoryRecords(bg.proHistoryRecords);
      }).catch(err => {
        console.error('Erro na fase background do refresh:', err);
      });

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
