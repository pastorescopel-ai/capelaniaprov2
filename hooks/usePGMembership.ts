import { useState, useEffect } from 'react';
import { Unit, ProGroup } from '../types';
import { useApp } from '../hooks/useApp';
import { useToast } from '../contexts/ToastContext';
import { usePGMembershipData } from './usePGMembershipData';

interface UsePGMembershipProps {
  unit: Unit;
}

export const usePGMembership = ({ unit }: UsePGMembershipProps) => {
  const { proSectors, proStaff, proProviders, proGroups, proGroupMembers, proGroupProviderMembers, proGroupLocations, saveRecord } = useApp();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'staff' | 'providers'>('staff');
  const [selectedSectorName, setSelectedSectorName] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedPGName, setSelectedPGName] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // --- CICLO DE COMPETÊNCIA ---
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  
  // --- ESTADOS OTIMISTAS (UI Instantânea) ---
  const [pendingTransfers, setPendingTransfers] = useState<Set<string>>(new Set());
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());

  // Estado para o Modal de Exclusão
  const [removalType, setRemovalType] = useState<'exit' | 'error'>('exit');
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string; staffId: string } | null>(null);

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
    staffSearch,
    providerSearch,
    selectedSectorName,
    selectedPGName,
    pendingTransfers,
    pendingRemovals
  });

  const isNewProvider = providerSearch && !proProviders.some(p => String(p.name || "").toLowerCase().trim() === providerSearch.toLowerCase().trim() && p.unit === unit);

  // --- AÇÕES ---

  const handleEnroll = async (personId: string, type: 'staff' | 'provider' = 'staff') => {
    if (!currentPG) { showToast("Selecione um PG de destino primeiro.", "warning"); return; }
    console.log(`[Protocolo] Iniciando matrícula: ${type} ${personId} -> PG ${currentPG.id}`);
    
    setPendingTransfers(prev => new Set(prev).add(personId));
    setIsProcessing(true);
    try {
      const collection = type === 'staff' ? 'proGroupMembers' : 'proGroupProviderMembers';
      const idField = type === 'staff' ? 'staffId' : 'providerId';
      const membersList = type === 'staff' ? proGroupMembers : proGroupProviderMembers;

      // Soft Delete: Verifica se existe QUALQUER matrícula ATIVA (em qualquer grupo)
      const existingActiveMemberships = membersList.filter(m => cleanId((m as any)[idField]) === cleanId(personId) && !m.leftAt);
      
      if (existingActiveMemberships.length > 0) {
        console.log(`[Protocolo] Encontradas ${existingActiveMemberships.length} matrículas ativas. Fechando...`);
        // Se já estiver no grupo de destino, não faz nada
        if (existingActiveMemberships.some(m => m.groupId === currentPG.id)) {
          console.warn(`[Protocolo] Colaborador já está no PG de destino.`);
          setPendingTransfers(prev => { const newSet = new Set(prev); newSet.delete(personId); return newSet; });
          return; 
        }
        
        // "Fecha" TODAS as matrículas anteriores para garantir limpeza total
        const closeUpdates = existingActiveMemberships.map(m => ({ ...m, leftAt: Date.now() }));
        await saveRecord(collection, closeUpdates);
      }

      // Cria nova matrícula com base no seletor de mês
      const cycleMonth = selectedMonth;

      const newMember: any = {
        groupId: currentPG.id,
        [idField]: personId,
        joinedAt: Date.now(),
        cycleMonth
      };
      
      const success = await saveRecord(collection, newMember);
      
      if (success) {
        showToast("Matrícula realizada!", "success");
        if (type === 'provider') setProviderSearch('');
      } else {
        throw new Error("O banco de dados rejeitou a gravação. Verifique o console.");
      }
    } catch (e: any) {
      console.error(`[Protocolo] Falha na matrícula:`, e);
      setPendingTransfers(prev => { const newSet = new Set(prev); newSet.delete(personId); return newSet; });
      showToast(e.message || "Erro ao matricular. Verifique a conexão.", "warning");
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
    
    console.log(`[Protocolo] Iniciando remoção: Membro ${memberId} (Pessoa ${personId}) de ${collection}`);
    
    setPendingRemovals(prev => new Set(prev).add(memberId));
    
    // Busca todas as matrículas ativas deste colaborador neste PG (para limpar duplicatas)
    const activeMemberships = membersList.filter(m => 
      cleanId((m as any)[idField]) === cleanId(personId) && 
      m.groupId === currentPG?.id && 
      !m.leftAt
    );
    
    if (activeMemberships.length === 0 && memberId) {
        console.warn(`[Protocolo] Nenhuma matrícula por ID. Tentando por ID direto: ${memberId}`);
        const byId = membersList.find(m => m.id === memberId && !m.leftAt);
        if (byId) activeMemberships.push(byId);
    }
    
    console.log(`[Protocolo] Matrículas ativas para fechar:`, activeMemberships.map(m => m.id));
    activeMemberships.forEach(m => setPendingRemovals(prev => new Set(prev).add(m.id)));
    
    setMemberToRemove(null);
    setIsProcessing(true);
    
    try {
      if (activeMemberships.length > 0) {
          // ENCERRAMENTO DE CICLO (SOFT DELETE): Baseado no mês selecionado
          // Define a data de saída como o último momento do mês selecionado
          const cycleDate = new Date(selectedMonth + 'T12:00:00');
          const lastDayOfMonth = new Date(cycleDate.getFullYear(), cycleDate.getMonth() + 1, 0, 23, 59, 59);
          
          const updates = activeMemberships.map(m => ({ 
            ...m, 
            leftAt: lastDayOfMonth.getTime(),
            isError: removalType === 'error'
          }));
          
          console.log(`[Protocolo] Executando SOFT DELETE (BI-Ready)...`);
          const success = await saveRecord(collection, updates);
          
          if (success) {
            console.log(`[Protocolo] Movimentação registrada com sucesso.`);
            showToast(removalType === 'error' ? "Erro registrado no histórico." : "Saída registrada no histórico.", "success");
          } else {
            throw new Error("O servidor não confirmou a saída. Verifique o console.");
          }
      } else {
        console.warn(`[Protocolo] Nenhuma matrícula ativa encontrada para remover.`);
      }
    } catch (e: any) {
      console.error(`[Protocolo] Falha na remoção:`, e);
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
    
    const confirm = window.confirm(`Deseja ajustar o Ciclo de Competência de TODOS os ${pgMembers.length} membros deste PG para ${selectedMonth}?`);
    if (!confirm) return;

    setIsProcessing(true);
    try {
      // Separar membros por tipo (staff vs provider)
      const staffUpdates: any[] = [];
      const providerUpdates: any[] = [];

      pgMembers.forEach(member => {
        const isProvider = (member as any).type === 'provider';
        const originalMember = isProvider 
          ? proGroupProviderMembers.find(m => m.id === member.id)
          : proGroupMembers.find(m => m.id === member.id);

        if (originalMember) {
          const updated = { ...originalMember, cycleMonth: selectedMonth };
          if (isProvider) providerUpdates.push(updated);
          else staffUpdates.push(updated);
        }
      });

      if (staffUpdates.length > 0) await saveRecord('proGroupMembers', staffUpdates);
      if (providerUpdates.length > 0) await saveRecord('proGroupProviderMembers', providerUpdates);

      showToast("Ciclo de competência atualizado para todos!", "success");
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
    isProcessing,
    removalType, setRemovalType,
    memberToRemove, setMemberToRemove,
    currentSector, currentPG,
    availableProviders, coverageGaps, emptyPGs, availableStaff, pgMembers,
    isNewProvider,
    handleEnroll, handleCreateAndEnrollProvider, confirmRemoval, handleSetLeader,
    handleBulkUpdateCycleMonth,
    proSectors, proGroups
  };
};
