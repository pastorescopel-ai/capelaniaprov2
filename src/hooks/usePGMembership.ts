import { useState, useEffect } from 'react';
import { Unit, ProGroup, ProHistoryRecord } from '../types';
import { usePro } from '../contexts/ProContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { usePGMembershipData } from './usePGMembershipData';
import { isCurrentlyActive, isLiveMembership } from '../utils/pgMembership';
import { DataRepository } from '../services/dataRepository';
import { toCamel } from '../utils/transformers';

interface UsePGMembershipProps {
  unit: Unit;
}

export const usePGMembership = ({ unit }: UsePGMembershipProps) => {
  const { proSectors, proStaff, proProviders, proGroups, proGroupMembers, proGroupProviderMembers, proGroupLocations, proMonthlyStats, proHistoryRecords } = usePro();
  const { config, saveRecord } = useApp();
  const { showToast } = useToast();
  
  const [selectedMonth, setSelectedMonth] = useState(config.activeCompetenceMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
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

  const activeComp = config.activeCompetenceMonth || new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
  
  // O mês só é considerado fechado se houver um registro explícito de fechamento no banco (proMonthlyStats)
  // e se for um mês passado. Se não houver fechamento, ele permanece aberto para ajustes.
  const isMonthClosed = proMonthlyStats.some(s => s.month === selectedMonth && (s as any).type === 'pg' && (s as any).targetId === 'all');
  
  const isFutureMonth = selectedMonth > activeComp;
  const isOpenMonth = selectedMonth === activeComp;

  // Quando o mês está fechado (histórico), a tela lê de proHistoryRecords — mas a sincronização
  // geral só mantém ~45 dias desse histórico em memória (ver dataRepository.ts). Para meses mais
  // antigos, busca o snapshot direto no Supabase, senão a lista fica vazia mesmo com dados reais.
  const [localHistory, setLocalHistory] = useState<ProHistoryRecord[] | null>(null);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    const limitMonth = d.toISOString().substring(0, 7) + '-01';

    if (isMonthClosed && selectedMonth < limitMonth) {
      let cancelled = false;
      DataRepository.fetchFullTable('pro_history_records', 199999, q => q.eq('month', selectedMonth))
        .then(res => { if (!cancelled) setLocalHistory(res.data ? toCamel(res.data) : []); })
        .catch(err => { console.error('Error loading historical membership data', err); if (!cancelled) setLocalHistory([]); });
      return () => { cancelled = true; };
    } else {
      setLocalHistory(null);
    }
  }, [isMonthClosed, selectedMonth]);

  const effectiveHistoryRecords = localHistory !== null ? localHistory : proHistoryRecords;

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

  const cleanId = (id: any) => {
    const str = String(id || '');
    if (str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return str;
    return str.replace(/\D/g, '');
  };

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
    proHistoryRecords: effectiveHistoryRecords,
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
    if (isMonthClosed) { showToast("Este mês está encerrado. Não é possível realizar novas matrículas.", "warning"); return; }
    if (!currentPG) { showToast("Selecione um PG de destino primeiro.", "warning"); return; }
    
    setPendingTransfers(prev => new Set(prev).add(personId));
    setIsProcessing(true);
    try {
      const collection = type === 'staff' ? 'proGroupMembers' : 'proGroupProviderMembers';
      const idField = type === 'staff' ? 'staffId' : 'providerId';
      const membersList = type === 'staff' ? proGroupMembers : proGroupProviderMembers;

      // Limpar liderança antiga se este colaborador for transferido e for líder de outro grupo
      let personName = "";
      if (type === 'staff') {
        const staff = proStaff.find(s => cleanId(s.id) === cleanId(personId));
        if (staff) personName = staff.name;
      } else {
        const provider = proProviders.find(p => cleanId(p.id) === cleanId(personId));
        if (provider) personName = provider.name;
      }

      if (personName) {
        // Prioriza o vínculo por ID (imune a homônimo/apelido/erro de digitação);
        // cai para o casamento por nome só quando o PG ainda não tem leaderStaffId gravado.
        const otherPGWhereHeIsLeader = proGroups.find(g => {
          if (g.unit !== unit || g.id === currentPG.id) return false;
          if (type === 'staff' && g.leaderStaffId) return cleanId(g.leaderStaffId) === cleanId(personId);
          return g.currentLeader === personName;
        });
        if (otherPGWhereHeIsLeader) {
          const updatedOldPG = { ...otherPGWhereHeIsLeader, currentLeader: "", leaderStaffId: null };
          await saveRecord('proGroups', updatedOldPG);
        }
      }

      const { firstDayMs } = getCycleDates(selectedMonth);

      // Uma pessoa só pode ter UMA matrícula de PG aberta por vez (regra reforçada no banco por
      // um índice único em staff_id/provider_id). Por isso essa checagem abaixo é GLOBAL — em
      // qualquer PG, de qualquer unidade — e não só nos PGs da unidade selecionada no momento:
      // se checássemos só a unidade atual, uma matrícula viva noutra unidade ficaria invisível
      // aqui e a matrícula nova violaria essa trava do banco.
      const { firstDayMs: mStart, lastDayMs: mEnd } = getCycleDates(selectedMonth);
      const allOpenMemberships = membersList.filter(m => {
        if (cleanId((m as any)[idField]) !== cleanId(personId)) return false;
        return isLiveMembership(m, selectedMonth, { start: mStart, end: mEnd }, isOpenMonth);
      });

    // 1. PRIORIDADE: Destravar registros com erro (isError: true)
      const errorRecord = membersList.find(m => cleanId((m as any)[idField]) === cleanId(personId) && m.isError);

      if (errorRecord) {
        const update = {
          ...errorRecord,
          groupId: currentPG.id,
          joinedAt: firstDayMs,
          cycleMonth: selectedMonth,
          leftAt: null,
          isError: false,
          updatedAt: Date.now()
        };
        // Fecha qualquer OUTRA matrícula ainda aberta (em qualquer PG/unidade) antes de reativar
        // esta, pra não violar a trava de "uma matrícula aberta por pessoa" do banco.
        const otherOpensToClose = allOpenMemberships
          .filter(m => m.id !== errorRecord.id)
          .map(m => ({ ...m, leftAt: 1, isError: true, updatedAt: Date.now() }));
        const success = await saveRecord(collection, [update, ...otherOpensToClose]);
        if (success) {
          showToast("Matrícula reativada no novo grupo!", "success");
          if (type === 'provider') setProviderSearch('');
          return;
        }
      }

      // 2. MOVIMENTAÇÃO: Verificar todos os registros ativos da pessoa (qualquer PG/unidade)
      const allRelevantMemberships = allOpenMemberships;

      if (allRelevantMemberships.length > 0) {
        // Se já existe no mês selecionado, fazemos o "Hard Move" (Limpa antigos e atualiza para o novo)
        const updates = allRelevantMemberships.map((m, idx) => {
          // Mantemos apenas um registro vivo (o primeiro que encontrarmos ou o que já estava no ciclo)
          const isPrimary = idx === 0;
          if (isPrimary) {
            return { 
              ...m, 
              groupId: currentPG.id, 
              joinedAt: firstDayMs, 
              cycleMonth: selectedMonth,
              leftAt: null, 
              isError: false, 
              updatedAt: Date.now() 
            };
          }
          // Todos os outros registros duplicados são "mortos" retroativamente
          return { 
            ...m, 
            leftAt: 1, 
            isError: true, 
            updatedAt: Date.now() 
          };
        });

        const success = await saveRecord(collection, updates);
        if (success) showToast("Membro transferido com sucesso!", "success");
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
      if (isMonthClosed) { showToast("Este mês está encerrado. Não é possível cadastrar novos prestadores.", "warning"); return; }
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
    if (isMonthClosed) { showToast("Este mês está encerrado. Não é possível remover membros.", "warning"); return; }
    if (!memberToRemove) return;
    const memberId = memberToRemove.id;
    const personId = memberToRemove.staffId;
    // Descobre se é staff ou provider verificando em qual lista o ID existe
    const isProvider = proGroupProviderMembers.some(m => m.id === memberId);
    const collection = isProvider ? 'proGroupProviderMembers' : 'proGroupMembers';
    const idField = isProvider ? 'providerId' : 'staffId';
    const membersList = isProvider ? proGroupProviderMembers : proGroupMembers;
    
    setPendingRemovals(prev => new Set(prev).add(memberId));
    
    // Busca TODAS as matrículas que interferem no mês selecionado para este colaborador na unidade
    const unitGroupIds = new Set(proGroups.filter(g => g.unit === unit).map(g => g.id));
    const { firstDayMs: mStart, lastDayMs: mEnd } = getCycleDates(selectedMonth);
    
    // Filtra todos os registros desse colaborador que tocam o mês atual
    const activeMemberships = membersList.filter(m => {
      const isSamePerson = cleanId((m as any)[idField]) === cleanId(personId);
      if (!isSamePerson) return false;
      
      const isSameUnit = unitGroupIds.has(m.groupId);
      if (!isSameUnit) return false;

      const { firstDayMs: mStart, lastDayMs: mEnd } = getCycleDates(selectedMonth);
      return isLiveMembership(m, selectedMonth, { start: mStart, end: mEnd }, isOpenMonth);
    });
    
    // Se não encontrou por lógica global mas tem um id específico, tenta por ID para segurança
    if (activeMemberships.length === 0 && memberId) {
        const byId = membersList.find(m => m.id === memberId && !m.leftAt);
        if (byId) activeMemberships.push(byId);
    }
    
    // Se for uma exclusão direcionada de um PG específico vinda da UI, mas encontramos múltiplos,
    // vamos garantir que todos os IDs encontrados entrem no estado de "pendente" para a UI atualizar
    activeMemberships.forEach(m => setPendingRemovals(prev => new Set(prev).add(m.id)));
    
    setMemberToRemove(null);
    setIsProcessing(true);
    
    try {
      if (activeMemberships.length > 0) {
          // ENCERRAMENTO OU ERRO
          const { lastDayMs } = getCycleDates(selectedMonth);
          const firstDayMs = getCycleDates(selectedMonth).firstDayMs;
          
          const updates = activeMemberships.map(m => {
            if (removalType === 'error') {
              // Se for erro, "mata" o registro retroativamente para que não conte em nada
              return { 
                ...m, 
                leftAt: 1, // 01/01/1970
                isError: true,
                updatedAt: Date.now()
              };
            } else {
              // Se for transferência, encerra no final do mês ou na data atual se preferir
              // Se for o mês aberto, encerra agora. Se for passado, fim do mês.
              const leaveDate = isOpenMonth ? Date.now() : lastDayMs;
              return { 
                ...m, 
                leftAt: leaveDate,
                isError: false,
                updatedAt: Date.now()
              };
            }
          });
          
          const success = await saveRecord(collection, updates);
          
          if (success) {
            // Se o membro removido era o líder do PG atual, limpa a liderança dele no PG
            const wasLeader = currentPG && (
              currentPG.leaderStaffId
                ? cleanId(currentPG.leaderStaffId) === cleanId(memberToRemove.staffId)
                : currentPG.currentLeader === memberToRemove.name
            );
            if (wasLeader) {
              const updatedPG = { ...currentPG, currentLeader: "", leaderStaffId: null };
              await saveRecord('proGroups', updatedPG);
            }
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
      if (isMonthClosed) { showToast("Este mês está encerrado. Não é possível alterar o líder.", "warning"); return; }
      if (!currentPG || isProcessing) return;
      setIsProcessing(true);
      try {
          const isRemovingLeader = !!member.isLeader;
          const updatedPG: ProGroup = {
              ...currentPG,
              currentLeader: isRemovingLeader ? "" : member.staffName,
              leaderStaffId: isRemovingLeader ? null : (member.type === 'staff' ? member.staffId : null)
          };
          const success = await saveRecord('proGroups', updatedPG);
          if (!success) {
              showToast("Erro ao definir líder.", "warning");
              return;
          }
          if (isRemovingLeader) {
              showToast(`Função de líder removida de ${member.staffName}!`, "success");
          } else {
              showToast(`${member.staffName} é o novo líder!`, "success");
          }
      } catch (e) { 
          showToast("Erro ao definir líder.", "warning"); 
      } finally { 
          setIsProcessing(false); 
      }
  };

  const handleBulkUpdateCycleMonth = async () => {
    if (isMonthClosed) { showToast("Este mês está encerrado. Não é possível atualizar ciclos.", "warning"); return; }
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
