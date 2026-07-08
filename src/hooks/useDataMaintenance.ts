
import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { DataRepository } from '../services/dataRepository';
import { Unit, ProSector } from '../types';
import { normalizeString } from '../utils/formatters';

export const useDataMaintenance = (
  reloadCallback: (showLoader: boolean) => Promise<void>
) => {
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false);

  const cleanId = (id: any) => {
    const str = String(id || '');
    if (str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return str;
    return str.replace(/\D/g, '');
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
      // Garante que os IDs sejam tratados como números para o BIGINT do Postgres
      const numericSourceId = cleanId(sourceId);
      const numericTargetId = cleanId(targetId);

      const { data, error } = await supabase.rpc('merge_pro_group', { 
        old_id: numericSourceId, 
        new_id: numericTargetId 
      });

      if (error) throw new Error(error.message);

      await reloadCallback(false);
      return { success: true, message: data || "Fusão concluída." };
    } catch (e: any) {
      return { success: false, message: e.message || "Erro desconhecido na fusão." };
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

  // --- FUNÇÕES DE MIGRAÇÃO (PONTE & CURA) ---

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

  const unifyStudentIdentity = async (orphanName: string, targetStaffId: string): Promise<string> => {
    if (!supabase) return "Erro Conexão";
    // Garante que o ID seja numérico para o BIGINT do SQL
    const numericId = cleanId(targetStaffId); 
    // ATUALIZADO: Chama a função V5 que faz deduplicação
    const { data, error } = await supabase.rpc('unify_and_deduplicate_identity', { 
        orphan_name: orphanName, 
        target_staff_id: numericId 
    });
    if (error) throw new Error(error.message);
    await reloadCallback(false);
    return data;
  };

  const createAndLinkIdentity = async (orphanName: string, newType: 'Paciente' | 'Prestador'): Promise<string> => {
    if (!supabase) return "Erro Conexão";
    const { data, error } = await supabase.rpc('create_and_link_identity', { 
        target_name: orphanName, 
        entity_type: newType,
        target_unit: 'HAB' // Padrão, pode ser melhorado se tiver contexto
    });
    if (error) throw new Error(error.message);
    await reloadCallback(false);
    return data;
  };

  const unifyIdentityV6 = async (orphanName: string, targetId: string, targetType: string): Promise<string> => {
    if (!supabase) return "Erro Conexão";
    const numericId = cleanId(targetId);
    const { data, error } = await supabase.rpc('unify_identity_v6', { 
        orphan_name: orphanName, 
        target_id: numericId,
        target_type: targetType
    });
    if (error) throw new Error(error.message);
    await reloadCallback(false);
    return data;
  };

  const mergeIdentitiesV6 = async (sourceId: string, sourceType: string, targetId: string, targetType: string): Promise<string> => {
    if (!supabase) return "Erro Conexão";
    const { data, error } = await supabase.rpc('merge_identities_v6', { 
        source_id: cleanId(sourceId), 
        source_type: sourceType,
        target_id: cleanId(targetId),
        target_type: targetType
    });
    if (error) throw new Error(error.message);
    await reloadCallback(false);
    return data;
  };

  const healSectorConnection = async (badValue: string, targetSectorId: string, isIdBased: boolean = false, targetName?: string): Promise<string> => {
    if (!supabase) return "Erro Conexão";
    const numericTargetId = cleanId(targetSectorId);
    
    if (isIdBased) {
        const oldId = parseInt(cleanId(badValue));
        const newId = parseInt(numericTargetId);
        
        // Tabelas que usam sector_id como referência
        const tables = [
            'bible_study_sessions', 
            'bible_classes', 
            'small_group_sessions', 
            'staff_visits', 
            'visit_requests',
            'pro_staff',
            'pro_groups',
            'pro_group_locations',
            'pro_history_records',
            'ambassadors',
            'activity_schedules'
        ];
        
        let totalUpdated = 0;
        for (const table of tables) {
            const updates: any = { sector_id: newId };
            if (targetName && ['bible_study_sessions', 'bible_classes', 'small_group_sessions', 'staff_visits'].includes(table)) {
                updates.sector = targetName;
            }
            const { data, error } = await supabase
                .from(table)
                .update(updates)
                .eq('sector_id', oldId)
                .select();
            if (!error && data) totalUpdated += data.length;
        }
        
        await reloadCallback(false);
        return `Cura por ID concluída! ${totalUpdated} registros vinculados ao novo ID ${newId}.`;
    } else {
        // Reforço manual do nome e ID para garantir persistência imediata
        const tablesWithName = ['bible_study_sessions', 'bible_classes', 'small_group_sessions', 'staff_visits'];
        for (const table of tablesWithName) {
            await supabase.from(table).update({ 
                sector: targetName || badValue,
                sector_id: numericTargetId 
            }).ilike('sector', badValue);
        }

        const { data, error } = await supabase.rpc('heal_sector_global', {
            bad_name: badValue,
            target_sector_id: numericTargetId
        });
        if (error) throw new Error(error.message);
        await reloadCallback(false);
        return data;
    }
  };

  const linkStudySessionIdentity = async (orphanName: string, targetStaffId: string, targetSectorId: string | null, participantType: string): Promise<string> => {
    if (!supabase) return "Erro Conexão";
    
    const numericStaffId = cleanId(targetStaffId);
    const numericSectorId = targetSectorId ? cleanId(targetSectorId) : null;

    const updates: any = { 
        staff_id: numericStaffId ? numericStaffId : null,
        participant_type: participantType
    };
    
    if (numericSectorId) {
        updates.sector_id = parseInt(numericSectorId);
    }

    const { data, error } = await supabase
        .from('bible_study_sessions')
        .update(updates)
        .ilike('name', `%${orphanName.trim()}%`)
        .select();

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
        throw new Error(`Nenhum registro encontrado contendo o nome "${orphanName}" (mesmo ignorando maiúsculas/minúsculas e espaços extras).`);
    }
    
    await reloadCallback(false);
    return `Estudos de ${orphanName} vinculados com sucesso!`;
  };

  const bulkHealAttendees = async (): Promise<string> => {
    if (!supabase) return "Erro Conexão";
    setIsMaintenanceRunning(true);
    try {
        const { data, error } = await supabase.rpc('bulk_heal_attendees');
        if (error) throw new Error(error.message);
        await reloadCallback(false);
        return data;
    } catch (e: any) {
        throw new Error(e.message);
    } finally {
        setIsMaintenanceRunning(false);
    }
  };

  const syncMemberships = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Offline mode." };
    setIsMaintenanceRunning(true);
    try {
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

      // 1. Buscar membros do mês anterior e atual
      const { data: members, error: membersErr } = await supabase
        .from('pro_group_members')
        .select('*')
        .in('cycle_month', [currentMonth, prevMonth]);

      if (membersErr) throw membersErr;

      const currentMembers = new Map<string, any>();
      const prevMembers = new Map<string, any>();

      (members || []).forEach(m => {
        if (m.cycle_month === currentMonth) currentMembers.set(m.staff_id, m);
        else if (m.cycle_month === prevMonth && (!m.left_at || m.left_at > 1)) prevMembers.set(m.staff_id, m);
      });

      // 2. Identificar quem está no prev mas não no current
      const toSync: any[] = [];
      prevMembers.forEach((m, staffId) => {
        if (!currentMembers.has(staffId)) {
          toSync.push({
            group_id: m.group_id,
            staff_id: staffId,
            joined_at: new Date().getTime(),
            cycle_month: currentMonth,
            left_at: null,
            is_error: false
          });
        }
      });

      if (toSync.length > 0) {
        const { error: insertErr } = await supabase
          .from('pro_group_members')
          .insert(toSync);
        if (insertErr) throw insertErr;
      }

      await reloadCallback(true);
      return { success: true, message: `Sincronização concluída: ${toSync.length} membros rematriculados.` };
    } catch (e: any) {
      console.error(e);
      return { success: false, message: e.message };
    } finally {
      setIsMaintenanceRunning(false);
    }
  };

  return {
    unifyNumericIdsAndCleanPrefixes,
    mergePGs,
    importFromDNA,
    executeSectorMigration,
    executePGMigration,
    unifyStudentIdentity,
    unifyIdentityV6,
    createAndLinkIdentity,
    healSectorConnection,
    linkStudySessionIdentity,
    bulkHealAttendees,
    syncMemberships,
    isMaintenanceRunning
  };
};
