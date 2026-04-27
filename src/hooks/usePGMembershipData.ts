
import { useMemo, useCallback } from 'react';
import { Unit, ProStaff, ProSector, ProGroup, ProGroupMember, ProGroupProviderMember, ProProvider, ProGroupLocation } from '../types';
import { normalizeString, tokenMatch, getTimestamp } from '../utils/formatters';

interface UsePGMembershipDataProps {
  unit: Unit;
  proStaff: ProStaff[];
  proSectors: ProSector[];
  proGroups: ProGroup[];
  proGroupMembers: ProGroupMember[];
  proGroupProviderMembers: ProGroupProviderMember[];
  proGroupLocations: ProGroupLocation[];
  proProviders: ProProvider[];
  proHistoryRecords: ProHistoryRecord[];
  staffSearch: string;
  providerSearch: string;
  selectedSectorName: string;
  selectedPGName: string;
  pendingTransfers: Set<string>;
  pendingRemovals: Set<string>;
  selectedMonth: string;
  isMonthClosed: boolean;
}

export const usePGMembershipData = ({
  unit,
  proStaff,
  proSectors,
  proGroups,
  proGroupMembers,
  proGroupProviderMembers,
  proGroupLocations,
  proProviders,
  proHistoryRecords,
  staffSearch,
  providerSearch,
  selectedSectorName,
  selectedPGName,
  pendingTransfers,
  pendingRemovals,
  selectedMonth,
  isMonthClosed
}: UsePGMembershipDataProps) => {
  const cleanId = (id: any) => {
    const str = String(id || '');
    if (str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) return str;
    return str.replace(/\D/g, '');
  };

  // --- MAPAS DE ÍNDICE (Otimização de Performance) ---
  // Filtrar por unidade antes de criar o mapa para evitar colisões de ID entre HAB/HABA
  const staffMap = useMemo(() => {
    const filtered = proStaff.filter(s => s.unit === unit);
    return new Map(filtered.map(s => [cleanId(s.id), s]));
  }, [proStaff, unit]);

  const providerMap = useMemo(() => {
    const filtered = proProviders.filter(p => p.unit === unit);
    return new Map(filtered.map(p => [cleanId(p.id), p]));
  }, [proProviders, unit]);

  const groupMap = useMemo(() => {
    const filtered = proGroups.filter(g => g.unit === unit);
    return new Map(filtered.map(g => [g.id, g]));
  }, [proGroups, unit]);

  const sectorMap = useMemo(() => {
    const filtered = proSectors.filter(s => s.unit === unit);
    return new Map(filtered.map(s => [s.id, s]));
  }, [proSectors, unit]);

  // Limites temporais do mês selecionado para filtragem estrita
  const monthBoundaries = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1, 0, 0, 0).getTime();
    const end = new Date(year, month, 0, 23, 59, 59).getTime();
    return { start, end };
  }, [selectedMonth]);

  // Função auxiliar para verificar se um registro de matrícula era ativo no mês selecionado
  const isActiveInMonth = useCallback((m: any) => {
    const joinedAt = getTimestamp(m.joinedAt);
    const createdAt = getTimestamp(m.createdAt);
    const left = m.leftAt ? getTimestamp(m.leftAt) : Infinity;
    
    const migrationDate = new Date('2026-04-04').getTime();
    const currentMonthStr = new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const isCurrentMonth = selectedMonth === currentMonthStr;

    // EXCEÇÃO DE MIGRAÇÃO: Apenas se o createdAt foi resetado para HOJE
    // E não temos uma data de matrícula real (joinedAt)
    // E o mês selecionado é a partir do início da operação (Fevereiro/2026)
    const isMigrationReset = !isCurrentMonth && 
                             !joinedAt && 
                             createdAt >= migrationDate && 
                             left >= monthBoundaries.start &&
                             selectedMonth >= '2026-02-01';

    // Prioridade total à data de matrícula real
    const effectiveJoined = joinedAt || createdAt;
    const wasActiveInPeriod = (effectiveJoined <= monthBoundaries.end || isMigrationReset) && left >= monthBoundaries.start;

    // 1. Se o registro tem um ciclo específico
    if (m.cycleMonth) {
      // Retorna verdadeiro se o ciclo bate OU se as datas reais mostram que ele estava lá
      return m.cycleMonth <= selectedMonth || wasActiveInPeriod;
    }

    // 2. Fallback para registros sem cycleMonth
    return wasActiveInPeriod;
  }, [selectedMonth, monthBoundaries]);

  const currentSector = useMemo(() => 
    proSectors.find(s => s.name === selectedSectorName && s.unit === unit && s.active !== false), 
    [proSectors, selectedSectorName, unit]
  );
  
  const currentPG = useMemo(() => 
    proGroups.find(g => g.name === selectedPGName && g.unit === unit && g.active !== false), 
    [proGroups, selectedPGName, unit]
  );

  const availableProviders = useMemo(() => {
    let filtered = proProviders.filter(p => p.unit === unit);
    if (providerSearch) {
        const searchNorm = normalizeString(providerSearch);
        filtered = filtered.filter(p => normalizeString(p.name).includes(searchNorm));
    }
    
    const activeProviderMembershipsMap = new Map();
    proGroupProviderMembers.forEach(m => {
        if (isActiveInMonth(m) && !pendingRemovals.has(m.id)) {
            activeProviderMembershipsMap.set(cleanId(m.providerId), m);
        }
    });

    const currentPGProviderIds = new Set();
    if (currentPG) {
        proGroupProviderMembers.forEach(m => {
            if (m.groupId === currentPG.id && isActiveInMonth(m) && !pendingRemovals.has(m.id)) {
                currentPGProviderIds.add(cleanId(m.providerId));
            }
        });
    }

    const result = filtered.map(provider => {
        const membership = activeProviderMembershipsMap.get(cleanId(provider.id));
        const groupName = membership ? groupMap.get(membership.groupId)?.name : null;
        const dateStr = membership?.joinedAt ? new Date(membership.joinedAt).toLocaleDateString('pt-BR') : null;
        
        return { ...provider, membership, groupName, joinedDate: dateStr };
    }).filter(provider => {
        if (currentPG && currentPGProviderIds.has(cleanId(provider.id))) return false;
        if (pendingTransfers.has(provider.id)) return false;
        return true;
    }).sort((a, b) => {
        if (!a.membership && b.membership) return -1;
        if (a.membership && !b.membership) return 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
    });
    return result;
  }, [proProviders, unit, providerSearch, proGroupProviderMembers, groupMap, currentPG, pendingRemovals, pendingTransfers, isActiveInMonth]);

  const coverageGaps = useMemo(() => {
    const sectors = proSectors.filter(s => s.unit === unit && s.active !== false);
    const staff = proStaff.filter(s => s.unit === unit && s.active !== false);

    const enrolledStaffIds = new Set();
    proGroupMembers.forEach(m => {
        if (isActiveInMonth(m)) enrolledStaffIds.add(cleanId(m.staffId));
    });

    const staffBySector = new Map<string, any[]>();
    staff.forEach(st => {
        const sId = cleanId(st.sectorId);
        if (!staffBySector.has(sId)) staffBySector.set(sId, []);
        staffBySector.get(sId)?.push(st);
    });

    const result = sectors.map(s => {
      const sectorStaff = staffBySector.get(cleanId(s.id)) || [];
      const total = sectorStaff.length;
      if (total === 0) return null;

      const enrolled = sectorStaff.filter(st => enrolledStaffIds.has(cleanId(st.id))).length;

      const percentage = (enrolled / total) * 100;
      if (percentage >= 100) return null;

      return {
        id: s.id,
        name: s.name,
        percentage,
        total,
        enrolled,
        color: percentage >= 80 ? 'emerald' : percentage >= 31 ? 'amber' : 'rose'
      };
    }).filter(item => item !== null).sort((a, b) => a!.percentage - b!.percentage);
    return result;
  }, [proSectors, proStaff, proGroupMembers, unit, isActiveInMonth]);

  const emptyPGs = useMemo(() => {
    const activeGroupIds = new Set();
    proGroupMembers.forEach(m => {
        if (isActiveInMonth(m)) activeGroupIds.add(m.groupId);
    });

    const result = proGroups
      .filter(g => g.unit === unit && g.active !== false)
      .filter(g => !activeGroupIds.has(g.id))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return result;
  }, [proGroups, proGroupMembers, unit, isActiveInMonth]);

  const availableStaff = useMemo(() => {
    // Filtrar staff que estava ativo no mês selecionado
    let filtered = proStaff.filter(s => {
      if (s.unit !== unit) return false;
      
      const joined = getTimestamp(s.joinedAt || s.createdAt);
      const left = s.leftAt ? getTimestamp(s.leftAt) : Infinity;
      
      // EXCEÇÃO DE MIGRAÇÃO: Se o createdAt é de hoje mas o mês é passado, 
      // ignoramos o createdAt para não filtrar indevidamente.
      const currentMonthStr = new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
      const isCurrentMonth = selectedMonth === currentMonthStr;
      const isMigrationReset = !isCurrentMonth && joined > monthBoundaries.end && left >= monthBoundaries.start;

      // Ativo se entrou antes do fim do mês (ou reset de migração) e não saiu antes do início do mês
      const wasActive = (joined <= monthBoundaries.end || isMigrationReset) && left >= monthBoundaries.start;
      
      // Se o mês selecionado NÃO estiver fechado, usamos o status 'active' como filtro adicional
      if (!isMonthClosed) {
        return wasActive && s.active !== false;
      }
      
      return wasActive;
    });
    
    if (staffSearch) {
        const searchNorm = normalizeString(staffSearch);
        filtered = filtered.filter(s => 
            tokenMatch(s.name, staffSearch) || 
            cleanId(s.id).includes(searchNorm)
        );
    } else if (currentSector) {
        filtered = filtered.filter(s => s.sectorId === currentSector.id);
    } else {
        // Se não houver busca nem setor selecionado, retorna vazio para não sobrecarregar
        return [];
    }

    // Mapa de membros ativos para busca rápida
    const activeMembersMap = new Map();
    proGroupMembers.forEach(m => {
        if (isActiveInMonth(m) && !pendingRemovals.has(m.id)) {
            activeMembersMap.set(cleanId(m.staffId), m);
        }
    });

    const currentPGStaffIds = new Set();
    if (currentPG) {
        proGroupMembers.forEach(m => {
            if (m.groupId === currentPG.id && isActiveInMonth(m) && !pendingRemovals.has(m.id)) {
                currentPGStaffIds.add(cleanId(m.staffId));
            }
        });
    }

    const result = filtered.map(staff => {
        const membership = activeMembersMap.get(cleanId(staff.id));
        
        const groupName = membership ? groupMap.get(membership.groupId)?.name : null;
        const dateStr = membership?.joinedAt 
            ? new Date(membership.joinedAt).toLocaleDateString('pt-BR') 
            : null;

        const sector = sectorMap.get(staff.sectorId);
        return { ...staff, membership, groupName, joinedDate: dateStr, sectorName: sector?.name || 'Sem Setor' };
      })
      .filter(staff => {
        if (currentPG && currentPGStaffIds.has(cleanId(staff.id))) return false;
        if (pendingTransfers.has(staff.id)) return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.membership && b.membership) return -1;
        if (a.membership && !b.membership) return 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    return result;
  }, [proStaff, currentSector, staffSearch, proGroupMembers, groupMap, currentPG, pendingTransfers, pendingRemovals, unit, sectorMap, isMonthClosed, selectedMonth, isActiveInMonth, monthBoundaries]);

  const pgMembers = useMemo(() => {
    if (!currentPG) {
        return [];
    }
    
    // --- MODO HISTÓRICO (Mês Fechado) ---
    if (isMonthClosed) {
      const historyForMonth = proHistoryRecords.filter((r: any) => 
        r.month === selectedMonth && 
        r.unit === unit && 
        r.groupId === currentPG.id && 
        r.isEnrolled
      );

      // Deduplicação garantida por staffId
      const seen = new Set();
      const uniqueHistory = historyForMonth.filter((r: any) => {
        if (!r.staffId) return true;
        const duplicate = seen.has(r.staffId);
        seen.add(r.staffId);
        return !duplicate;
      });

      return uniqueHistory.map((r: any) => ({
        id: r.id,
        staffName: r.staffName,
        staffId: r.staffId,
        sectorName: r.sectorName || 'Sem Setor',
        joinedDate: r.joinedAt ? new Date(r.joinedAt).toLocaleDateString('pt-BR') : '',
        cycleMonth: r.cycleMonth,
        isOptimistic: false,
        isLeader: r.leaderName === r.staffName || currentPG.currentLeader === r.staffName,
        type: 'staff'
      })).sort((a: any, b: any) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return String(a.staffName || "").localeCompare(String(b.staffName || ""));
      });
    }
    
    // --- MODO OPERACIONAL (Tempo Real) ---
    // Filtra membros ativos para o PG atual
    const staffMembers = proGroupMembers.filter(m => 
        m.groupId === currentPG.id && 
        isActiveInMonth(m) && 
        !pendingRemovals.has(m.id)
    );

    const realStaffMembers = staffMembers.map(m => {
        const staff = staffMap.get(cleanId(m.staffId));
        
        // Verificar se o colaborador ainda existe e estava ativo no mês selecionado
        if (!staff) return null;
        
        const joined = getTimestamp(staff.joinedAt || staff.createdAt);
        const left = staff.leftAt ? getTimestamp(staff.leftAt) : Infinity;

        // EXCEÇÃO DE MIGRAÇÃO
        const currentMonthStr = new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
        const isCurrentMonth = selectedMonth === currentMonthStr;
        const isMigrationReset = !isCurrentMonth && joined > monthBoundaries.end && left >= monthBoundaries.start;

        const wasActive = (joined <= monthBoundaries.end || isMigrationReset) && left >= monthBoundaries.start;
        
        // Se o colaborador saiu ou foi desativado (em meses abertos), ele não deve aparecer no PG
        if (!wasActive) return null;
        if (!isMonthClosed && staff.active === false) return null;

        const sector = sectorMap.get(staff?.sectorId || '');
        return { 
            id: m.id,
            staffName: staff?.name || `Desconhecido (ID: ${m.staffId})`, 
            staffId: m.staffId,
            sectorName: sector?.name || 'Sem Setor',
            joinedDate: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-BR') : '',
            cycleMonth: m.cycleMonth,
            isOptimistic: false,
            isLeader: currentPG.currentLeader === staff?.name,
            type: 'staff'
        };
    }).filter(m => m !== null);

    const providerMembers = proGroupProviderMembers.filter(m => 
        m.groupId === currentPG.id && 
        isActiveInMonth(m) && 
        !pendingRemovals.has(m.id)
    );

    const realProviderMembers = providerMembers.map(m => {
        const provider = providerMap.get(cleanId(m.providerId));
        
        if (!provider) return null;
        
        // Prestadores geralmente não tem joinedAt/leftAt no mesmo formato que staff, 
        // mas se tiverem, devemos respeitar. Se não tiverem, usamos apenas o status active.
        if (!isMonthClosed && provider.active === false) return null;

        return {
            id: m.id,
            staffName: provider?.name || `Desconhecido (ID: ${m.providerId})`,
            staffId: m.providerId,
            joinedDate: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-BR') : '',
            cycleMonth: m.cycleMonth,
            isOptimistic: false,
            isLeader: currentPG.currentLeader === provider?.name,
            type: 'provider'
        };
    }).filter(m => m !== null);

    const optimisticMembers = Array.from(pendingTransfers).map(id => {
        const staff = staffMap.get(id);
        const provider = providerMap.get(id);
        const sector = staff ? sectorMap.get(staff.sectorId || '') : null;
        const name = staff?.name || provider?.name || "Processando...";
        return {
            id: `temp-${id}`, 
            staffName: name,
            staffId: id,
            sectorName: sector?.name || (provider ? 'Prestador' : '...'),
            joinedDate: "Hoje",
            isOptimistic: true,
            isLeader: false,
            type: staff ? 'staff' : 'provider'
        };
    });

    const allMembers = [...realStaffMembers, ...realProviderMembers, ...optimisticMembers].filter((m, index, self) => 
        index === self.findIndex((t) => (t.staffId === m.staffId))
    );

    const result = allMembers.sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return String(a.staffName || "").localeCompare(String(b.staffName || ""));
    });
    return result;
  }, [proGroupMembers, proGroupProviderMembers, currentPG, staffMap, providerMap, pendingTransfers, pendingRemovals, sectorMap, isMonthClosed, selectedMonth, isActiveInMonth, monthBoundaries, proHistoryRecords, unit]);

  return {
    currentSector,
    currentPG,
    availableProviders,
    coverageGaps,
    emptyPGs,
    availableStaff,
    pgMembers
  };
};
