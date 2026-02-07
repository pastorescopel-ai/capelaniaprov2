
import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { DataRepository } from '../services/dataRepository';
import { Unit, ProSector } from '../types';

export const useDataMaintenance = (
  reloadCallback: (showLoader: boolean) => Promise<void>
) => {
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false);

  const nuclearReset = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Supabase não conectado." };
    setIsMaintenanceRunning(true);
    try {
      const { data: mlRecords } = await supabase.from('master_lists').select('*').limit(1);
      const mlData = mlRecords && mlRecords.length > 0 ? mlRecords[0] : null;
      
      if (!mlData) {
          throw new Error("As Listas de Texto (Excel) estão vazias no servidor.");
      }

      await supabase.from('pro_staff').delete().neq('id', '_PURGE_');
      await supabase.from('pro_groups').delete().neq('id', '_PURGE_');
      await supabase.from('pro_sectors').delete().neq('id', '_PURGE_');
      await supabase.from('pro_group_locations').delete().neq('id', '_PURGE_');

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

      if (newSectors.length > 0) {
        await DataRepository.upsertRecord('proSectors', newSectors);
      }

      await reloadCallback(true);
      return { success: true, message: `Reset concluído! ${newSectors.length} setores reconstruídos.` };
    } catch (e: any) {
      return { success: false, message: e.message };
    } finally {
      setIsMaintenanceRunning(false);
    }
  };

  const unifyNumericIdsAndCleanPrefixes = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Offline mode." };
    setIsMaintenanceRunning(true);
    try {
      const { data, error } = await supabase.rpc('unify_ids_total');
      
      if (error) {
          console.error("RPC Error:", error);
          throw new Error("Erro na função de limpeza do banco: " + error.message);
      }

      await reloadCallback(true);
      return { success: true, message: data || "Limpeza realizada." };

    } catch (e: any) {
      return { success: false, message: e.message };
    } finally {
      setIsMaintenanceRunning(false);
    }
  };

  const mergePGs = async (sourceId: string, targetId: string): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Offline mode." };
    try {
      const { data, error } = await supabase.rpc('merge_pro_group', { 
        old_id: sourceId, 
        new_id: targetId 
      });

      if (error) throw new Error(error.message);

      await reloadCallback(false);
      return { success: true, message: data || "Fusão concluída." };
    } catch (e: any) {
      return { success: false, message: e.message || "Erro desconhecido na fusão." };
    }
  };

  const migrateLegacyStructure = async (): Promise<{ success: boolean; message: string; details?: string }> => {
    setIsMaintenanceRunning(true);
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
            const p = clean.split('_'); rawId = p[0]; name = p.slice(1).filter(x => x !== 'HAB' && x !== 'HABA').join(' ');
          } else if (clean.includes(' - ')) {
            const p = clean.split(' - '); rawId = p[0]; name = p.slice(1).join(' ');
          } else if (/^\d+\s/.test(clean)) {
            const idx = clean.indexOf(' '); rawId = clean.substring(0, idx); name = clean.substring(idx + 1);
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
      await reloadCallback(true);
      return { success: true, message: "Migração concluída!", details: `${sectorsToUpsert.length} setores normalizados.` };
    } catch (e: any) {
      return { success: false, message: e.message };
    } finally {
      setIsMaintenanceRunning(false);
    }
  };

  const importFromDNA = async (dnaData: any) => {
      setIsMaintenanceRunning(true);
      try {
          const db = dnaData.database || dnaData;
          if(db.proSectors) await DataRepository.upsertRecord('proSectors', db.proSectors);
          if(db.proStaff) await DataRepository.upsertRecord('proStaff', db.proStaff);
          if(db.proGroups) await DataRepository.upsertRecord('proGroups', db.proGroups);
          if(db.proGroupLocations) await DataRepository.upsertRecord('proGroupLocations', db.proGroupLocations);
          if(db.users) await DataRepository.upsertRecord('users', db.users);
          await reloadCallback(true);
          return { success: true, message: "Restauração completa!" };
      } catch(e:any) {
          return { success: false, message: e.message };
      } finally {
          setIsMaintenanceRunning(false);
      }
  };

  return {
    nuclearReset,
    unifyNumericIdsAndCleanPrefixes,
    mergePGs,
    migrateLegacyStructure,
    importFromDNA,
    isMaintenanceRunning
  };
};
