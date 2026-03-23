import { useState, useEffect } from 'react';
import { Unit, ProGroup } from '../types';
import { usePro } from '../contexts/ProContext';
import { useApp } from '../contexts/AppProvider';
import { useToast } from '../contexts/ToastProvider';
import { usePGMembershipData } from './usePGMembershipData';

interface UsePGMembershipProps {
  unit: Unit;
}

export const usePGMembership = ({ unit }: UsePGMembershipProps) => {
  const { proSectors, proStaff, proProviders, proGroups, proGroupMembers, proGroupProviderMembers, proGroupLocations, proMonthlyStats } = usePro();
  const { config, saveRecord } = useApp();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'staff' | 'providers'>('staff');
  const [selectedSectorName, setSelectedSectorName] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [debouncedStaffSearch, setDebouncedStaffSearch] = useState('');
  const [selectedPGName, setSelectedPGName] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [debouncedProviderSearch, setDebouncedProviderSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedStaffSearch(staffSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [staffSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProviderSearch(providerSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [providerSearch]);

  // --- CICLO DE COMPETÊNCIA ---
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return config.activeCompetenceMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  });

  // Sincronizar selectedMonth com config.activeCompetenceMonth se mudar externamente
  useEffect(() => {
    if (config.activeCompetenceMonth) {
      setSelectedMonth(config.activeCompetenceMonth);
    }
  }, [config.activeCompetenceMonth]);
  
  const isMonthClosed = selectedMonth < (config.activeCompetenceMonth || '');
  const isFutureMonth = selectedMonth > (config.activeCompetenceMonth || '');
  const isOpenMonth = selectedMonth === (config.activeCompetenceMonth || '');

  // --- ESTADOS OTIMISTAS (UI Instantânea) ---
  const [pendingTransfers, setPendingTransfers] = useState<Set<string>>(new Set());
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());

  // Estado para o Modal de Exclusão
  const [removalType, setRemovalType] = useState<'exit' | 'error'>('exit');
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string; staffId: string } | null>(null);

  // Estado para o Modal de Ajuste de Ciclo
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);

  useEffect(() => {
    setPendingTransfers(new Set());
    setPendingRemovals(new Set());
  }, [proGroupMembers]);

  const cleanId = (id: any) => String(id || '').replace(/\D/g, '');

  // --- DADOS (Hook Customizado) ---
  const {
    currentSector,
    currentPG,
    availableProviders,
    coverageGaps,
    emptyPGs,
    availableStaff,
    pgMembers
  } = usePGMembershipData({
    unit,
    proStaff,
    proSectors,
    proGroups,
    proGroupMembers,
    proGroupProviderMembers,
    proGroupLocations,
    proProviders,
    staffSearch: debouncedStaffSearch,
    providerSearch: debouncedProviderSearch,
    selectedSectorName,
    selectedPGName,
    pendingTransfers,
    pendingRemovals,
    selectedMonth,
    isMonthClosed
  });

  const isNewProvider = providerSearch && !proProviders.some(p => String(p.name || "").toLowerCase().trim() === providerSearch.toLowerCase().trim() && p.unit === unit);

  // --- AÇÕES ---

  const getCycleDates = (isoDate: string) => {
    const [year, month] = isoDate.split('-').map(Number);
    // Dia 01 às 12:00:00
    const firstDay = new Date(year, month - 1, 1, 12, 0, 0);
    // Último dia às 12:00:00
    const lastDay = new Date(year, month, 0, 12, 0, 0);
    return {
      firstDayMs: firstDay.getTime(),
      lastDayMs: lastDay.getTime()
    };
  };

  const handleEnroll = async (personId: string, type: 'staff' | 'provider' = 'staff') => {
    if (!currentPG) { showToast("Selecione um PG de destino primeiro.", "warning"); return; }
    
    setPendingTransfers(prev => new Set(prev).add(personId));
    setIsProcessing(true);
    try {
      const collection = type === 'staff' ? 'proGroupMembers' : 'proGroupProviderMembers';
      const idField = type === 'staff' ? 'staffId' : 'providerId';
      const membersList = type === 'staff' ? proGroupMembers : proGroupProviderMembers;

      const { firstDayMs } = getCycleDates(selectedMonth);

      // 1. PRIORIDADE: Destravar registros com erro (isError: true)
      const errorRecord = membersList.find(m => cleanId((m as any)[idField]) === cleanId(personId) && m.isError);
      
      if (errorRecord) {
        const update = { 
          ...errorRecord, 
          groupId: currentPG.id,
          joinedAt: firstDayMs,
          cycleMonth: selectedMonth,
          leftAt: null, 
          isError: false 
        };
        const success = await saveRecord(collection, [update]);
        if (success) {
          showToast("Registro destravado e matriculado!", "success");
          if (type === 'provider') setProviderSearch('');
          return;
        }
      }

      // 2. MOVIMENTAÇÃO: Verificar se já existe matrícula ativa
      const activeMembership = membersList.find(m => cleanId((m as any)[idField]) === cleanId(personId) && !m.leftAt);

      if (activeMembership) {
        if (activeMembership.cycleMonth === selectedMonth) {
          // MESMO MÊS: Apenas atualiza o PG (Ajuste Direto)
          const update = { ...activeMembership, groupId: currentPG.id, joinedAt: firstDayMs };
          const success = await saveRecord(collection, [update]);
          if (success) showToast("Matrícula atualizada!", "success");
        } else {
          // MÊS DIFERENTE: Encerra o antigo (Histórico) e cria novo
          const { lastDayMs: oldLastDay } = getCycleDates(activeMembership.cycleMonth);
          
          const closeOld = { ...activeMembership, leftAt: oldLastDay };
          const createNew: any = {
            groupId: currentPG.id,
            [idField]: personId,
            joinedAt: firstDayMs,
            cycleMonth: selectedMonth,
            leftAt: null,
            isError: false
          };
          
          const success = await saveRecord(collection, [closeOld, createNew]);
          if (success) showToast("Nova matrícula com histórico preservado!", "success");
        }
        if (type === 'provider') setProviderSearch('');
      } else {
        // 3. NOVA MATRÍCULA: Sem histórico prévio
        const newMember: any = {
          groupId: currentPG.id,
          [idField]: personId,
          joinedAt: firstDayMs,
          cycleMonth: selectedMonth,
          leftAt: null,
          isError: false
        };
        
        const success = await saveRecord(collection, newMember);
        if (success) {
          showToast("Matrícula realizada!", "success");
          if (type === 'provider') setProviderSearch('');
        }
      }
    } catch (e: any) {
      console.error(`Falha na matrícula:`, e);
      setPendingTransfers(prev => { const newSet = new Set(prev); newSet.delete(personId); return newSet; });
      showToast(e.message || "Erro ao processar matrícula.", "warning");
    } finally { setIsProcessing(false); }
  };

  const handleCreateAndEnrollProvider = async () => {
      if (!currentPG || !providerSearch.trim()) return;
      setIsProcessing(true);
      try {
          // Acha o maior ID 8000...
          const providerIds = proProviders.map(p => parseInt(cleanId(p.id))).filter(id => id >= 8000000000 && id < 9000000000);
          const maxId = providerIds.length > 0 ? Math.max(...providerIds) : 8000000000;
          const newId = String(maxId + 1);

          const newProvider = {
              id: newId,
              name: providerSearch.trim().toUpperCase(),
              unit: unit,
              updatedAt: Date.now()
          };

          const success = await saveRecord('proProviders', newProvider);
          if (success) {
              await handleEnroll(newId, 'provider');
          } else {
              showToast("Erro ao criar prestador.", "warning");
          }
      } catch (e) {
          showToast("Erro inesperado ao criar prestador.", "warning");
      } finally {
          setIsProcessing(false);
      }
  };

  const confirmRemoval = async () => {
    if (!memberToRemove) return;
    const memberId = memberToRemove.id;
    const personId = memberToRemove.staffId;
    // Descobre se é staff ou provider verificando em qual lista o ID existe
    const isProvider = proGroupProviderMembers.some(m => m.id === memberId);
    const collection = isProvider ? 'proGroupProviderMembers' : 'proGroupMembers';
    const idField = isProvider ? 'providerId' : 'staffId';
    const membersList = isProvider ? proGroupProviderMembers : proGroupMembers;
    
    setPendingRemovals(prev => new Set(prev).add(memberId));
    
    // Busca todas as matrículas ativas deste colaborador neste PG (para limpar duplicatas)
    const activeMemberships = membersList.filter(m => 
      cleanId((m as any)[idField]) === cleanId(personId) && 
      m.groupId === currentPG?.id && 
      !m.leftAt
    );
    
    if (activeMemberships.length === 0 && memberId) {
        const byId = membersList.find(m => m.id === memberId && !m.leftAt);
        if (byId) activeMemberships.push(byId);
    }
    
    activeMemberships.forEach(m => setPendingRemovals(prev => new Set(prev).add(m.id)));
    
    setMemberToRemove(null);
    setIsProcessing(true);
    
    try {
      if (activeMemberships.length > 0) {
          // ENCERRAMENTO DE CICLO (SOFT DELETE): Baseado no mês selecionado
          // Define a data de saída como o meio-dia do último dia do mês selecionado
          const { lastDayMs } = getCycleDates(selectedMonth);
          
          const updates = activeMemberships.map(m => ({ 
            ...m, 
            leftAt: lastDayMs,
            isError: removalType === 'error'
          }));
          
          const success = await saveRecord(collection, updates);
          
          if (success) {
            showToast(removalType === 'error' ? "Erro registrado no histórico." : "Saída registrada no histórico.", "success");
          } else {
            throw new Error("O servidor não confirmou a saída. Verifique o console.");
          }
      } else {
        console.warn(`Nenhuma matrícula ativa encontrada para remover.`);
      }
    } catch (e: any) {
      console.error(`Falha na remoção:`, e);
      activeMemberships.forEach(m => {
        setPendingRemovals(prev => { const newSet = new Set(prev); newSet.delete(m.id); return newSet; });
      });
      showToast(e.message || "Erro ao remover do grupo.", "warning");
    } finally { setIsProcessing(false); }
  };

  const handleSetLeader = async (member: any) => {
      if (!currentPG || isProcessing) return;
      if (member.isLeader) return;
      setIsProcessing(true);
      try {
          const updatedPG: ProGroup = { ...currentPG, currentLeader: member.staffName };
          await saveRecord('proGroups', updatedPG);
          showToast(`${member.staffName} é o novo líder!`, "success");
      } catch (e) { showToast("Erro ao definir líder.", "warning"); } 
      finally { setIsProcessing(false); }
  };

  const handleBulkUpdateCycleMonth = async () => {
    if (!currentPG || pgMembers.length === 0) return;
    
    setIsProcessing(true);
    try {
      const { firstDayMs } = getCycleDates(selectedMonth);
      
      // Separar membros por tipo (staff vs provider)
      const staffUpdates: any[] = [];
      const providerUpdates: any[] = [];

      pgMembers.forEach(member => {
        const isProvider = (member as any).type === 'provider';
        const originalMember = isProvider 
          ? proGroupProviderMembers.find(m => m.id === member.id)
          : proGroupMembers.find(m => m.id === member.id);

        if (originalMember) {
          const updated = { 
            ...originalMember, 
            cycleMonth: selectedMonth,
            joinedAt: firstDayMs, // Força a data de entrada para o início do ciclo
            leftAt: null, // Garante que estão ativos
            isError: false // Limpa erros se houver
          };
          if (isProvider) providerUpdates.push(updated);
          else staffUpdates.push(updated);
        } else {
          // Se não existe no banco, cria um novo registro
          const newMember = { 
            groupId: currentPG.id,
            [isProvider ? 'providerId' : 'staffId']: (member as any)[isProvider ? 'providerId' : 'staffId'],
            cycleMonth: selectedMonth,
            joinedAt: firstDayMs,
            leftAt: null,
            isError: false
          };
          if (isProvider) providerUpdates.push(newMember);
          else staffUpdates.push(newMember);
        }
      });

      if (staffUpdates.length > 0) await saveRecord('proGroupMembers', staffUpdates);
      if (providerUpdates.length > 0) await saveRecord('proGroupProviderMembers', providerUpdates);

      showToast("Ciclo e datas de entrada atualizados para todos!", "success");
      setIsCycleModalOpen(false);
    } catch (e) {
      showToast("Erro ao atualizar ciclo em massa.", "warning");
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    activeTab, setActiveTab,
    selectedSectorName, setSelectedSectorName,
    staffSearch, setStaffSearch,
    selectedPGName, setSelectedPGName,
    providerSearch, setProviderSearch,
    selectedMonth, setSelectedMonth,
    isMonthClosed, isFutureMonth, isOpenMonth,
    isProcessing,
    removalType, setRemovalType,
    memberToRemove, setMemberToRemove,
    isCycleModalOpen, setIsCycleModalOpen,
    currentSector, currentPG,
    availableProviders, coverageGaps, emptyPGs, availableStaff, pgMembers,
    isNewProvider,
    handleEnroll, handleCreateAndEnrollProvider, confirmRemoval, handleSetLeader,
    handleBulkUpdateCycleMonth,
    proSectors, proGroups
  };
};
