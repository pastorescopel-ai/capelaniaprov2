
import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { DataRepository } from '../services/dataRepository';
import { Unit, ProSector } from '../types';

export const useDataMaintenance = (
  reloadCallback: (showLoader: boolean) => Promise<void>
) => {
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false);

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
      // Nota: Esta função de migração dependia da masterLists antiga. 
      // Com o desacoplamento, ela perde utilidade ou precisaria ser reescrita para ler do Excel diretamente no AdminLists.
      // Mantendo vazia ou com mensagem informativa para evitar erro de chamada.
      return { success: true, message: "Função de migração legada desativada." };
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

  // --- NOVAS FUNÇÕES DE MIGRAÇÃO (PONTE) ---

  const executeSectorMigration = async (oldName: string, newName: string): Promise<string> => {
    if (!supabase) return "Erro Conexão";
    const { data, error } = await supabase.rpc('migrate_legacy_sector', { 
        old_name: oldName, 
        new_name: newName 
    });
    if (error) throw new Error(error.message);
    await reloadCallback(false);
    return data;
  };

  const executePGMigration = async (oldName: string, newName: string): Promise<string> => {
    if (!supabase) return "Erro Conexão";
    const { data, error } = await supabase.rpc('migrate_legacy_pg', { 
        old_name: oldName, 
        new_name: newName 
    });
    if (error) throw new Error(error.message);
    await reloadCallback(false);
    return data;
  };

  return {
    unifyNumericIdsAndCleanPrefixes,
    mergePGs,
    migrateLegacyStructure,
    importFromDNA,
    executeSectorMigration,
    executePGMigration,
    isMaintenanceRunning
  };
};
