
import { useMemo } from 'react';
import { Unit, ProStaff, ProSector, ProGroup, ProGroupMember, ProGroupProviderMember, ProProvider, ProGroupLocation } from '../types';
import { normalizeString, tokenMatch } from '../utils/formatters';

interface UsePGMembershipDataProps {
  unit: Unit;
  proStaff: ProStaff[];
  proSectors: ProSector[];
  proGroups: ProGroup[];
  proGroupMembers: ProGroupMember[];
  proGroupProviderMembers: ProGroupProviderMember[];
  proGroupLocations: ProGroupLocation[];
  proProviders: ProProvider[];
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
  staffSearch,
  providerSearch,
  selectedSectorName,
  selectedPGName,
  pendingTransfers,
  pendingRemovals,
  selectedMonth,
  isMonthClosed
}: UsePGMembershipDataProps) => {
  const cleanId = (id: any) => String(id || '').replace(/\D/g, '');

  // --- MAPAS DE ÍNDICE (Otimização de Performance) ---
  const staffMap = useMemo(() => new Map(proStaff.map(s => [cleanId(s.id), s])), [proStaff]);
  const providerMap = useMemo(() => new Map(proProviders.map(p => [cleanId(p.id), p])), [proProviders]);
  const groupMap = useMemo(() => new Map(proGroups.map(g => [g.id, g])), [proGroups]);
  const sectorMap = useMemo(() => new Map(proSectors.map(s => [s.id, s])), [proSectors]);

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
    
    return filtered.map(provider => {
        const membership = proGroupProviderMembers.find(m => 
            cleanId(m.providerId) === cleanId(provider.id) && 
            (isMonthClosed ? m.cycleMonth === selectedMonth : !m.leftAt) && 
            !pendingRemovals.has(m.id)
        );
        const groupName = membership ? groupMap.get(membership.groupId)?.name : null;
        const dateStr = membership?.joinedAt ? new Date(membership.joinedAt).toLocaleDateString('pt-BR') : null;
        
        return { ...provider, membership, groupName, joinedDate: dateStr };
    }).filter(provider => {
        if (currentPG) {
            const isAlreadyInThisGroup = proGroupProviderMembers.some(m => 
                m.groupId === currentPG.id && 
                cleanId(m.providerId) === cleanId(provider.id) && 
                !m.leftAt &&
                !pendingRemovals.has(m.id)
            );
            if (isAlreadyInThisGroup) return false;
        }
        if (pendingTransfers.has(provider.id)) return false;
        return true;
    }).sort((a, b) => {
        if (!a.membership && b.membership) return -1;
        if (a.membership && !b.membership) return 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [proProviders, unit, providerSearch, proGroupProviderMembers, groupMap, currentPG, pendingRemovals, pendingTransfers, isMonthClosed, selectedMonth]);

  const coverageGaps = useMemo(() => {
    const sectors = proSectors.filter(s => s.unit === unit && s.active !== false);
    const staff = proStaff.filter(s => s.unit === unit && s.active !== false);

    return sectors.map(s => {
      const sectorStaff = staff.filter(st => cleanId(st.sectorId) === cleanId(s.id));
      const total = sectorStaff.length;
      if (total === 0) return null;

      const enrolled = sectorStaff.filter(st => 
        proGroupMembers.some(m => cleanId(m.staffId) === cleanId(st.id) && !m.leftAt)
      ).length;

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
  }, [proSectors, proStaff, proGroupMembers, unit]);

  const emptyPGs = useMemo(() => {
    return proGroups
      .filter(g => g.unit === unit && g.active !== false)
      .filter(g => !proGroupMembers.some(m => m.groupId === g.id && !m.leftAt))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [proGroups, proGroupMembers, unit]);

  const availableStaff = useMemo(() => {
    let filtered = proStaff.filter(s => s.unit === unit && s.active !== false);
    
    if (staffSearch) {
        filtered = filtered.filter(s => 
            tokenMatch(s.name, staffSearch) || 
            cleanId(s.id).includes(normalizeString(staffSearch))
        );
    } else if (currentSector) {
        filtered = filtered.filter(s => s.sectorId === currentSector.id);
    } else {
        return [];
    }

    // Mapa de membros ativos para busca rápida
    const activeMembersMap = new Map();
    proGroupMembers.forEach(m => {
        if ((isMonthClosed ? m.cycleMonth === selectedMonth : !m.leftAt) && !pendingRemovals.has(m.id)) {
            activeMembersMap.set(cleanId(m.staffId), m);
        }
    });

    return filtered.map(staff => {
        const membership = activeMembersMap.get(cleanId(staff.id));
        
        const groupName = membership ? groupMap.get(membership.groupId)?.name : null;
        const dateStr = membership?.joinedAt 
            ? new Date(membership.joinedAt).toLocaleDateString('pt-BR') 
            : null;

        const sector = sectorMap.get(staff.sectorId);
        return { ...staff, membership, groupName, joinedDate: dateStr, sectorName: sector?.name || 'Sem Setor' };
      })
      .filter(staff => {
        if (currentPG) {
            const isAlreadyInThisGroup = proGroupMembers.some(m => 
                m.groupId === currentPG.id && 
                cleanId(m.staffId) === cleanId(staff.id) && 
                !m.leftAt &&
                !pendingRemovals.has(m.id)
            );
            if (isAlreadyInThisGroup) return false;
        }
        if (pendingTransfers.has(staff.id)) return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.membership && b.membership) return -1;
        if (a.membership && !b.membership) return 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [proStaff, currentSector, staffSearch, proGroupMembers, groupMap, currentPG, pendingTransfers, pendingRemovals, unit, sectorMap, isMonthClosed, selectedMonth]);

  const pgMembers = useMemo(() => {
    if (!currentPG) return [];
    
    // Filtra membros ativos para o PG atual
    const staffMembers = proGroupMembers.filter(m => 
        m.groupId === currentPG.id && 
        (isMonthClosed ? m.cycleMonth === selectedMonth : !m.leftAt) && 
        !pendingRemovals.has(m.id)
    );

    const realStaffMembers = staffMembers.map(m => {
        const staff = staffMap.get(cleanId(m.staffId));
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
    });

    const providerMembers = proGroupProviderMembers.filter(m => 
        m.groupId === currentPG.id && 
        (isMonthClosed ? m.cycleMonth === selectedMonth : !m.leftAt) && 
        !pendingRemovals.has(m.id)
    );

    const realProviderMembers = providerMembers.map(m => {
        const provider = providerMap.get(cleanId(m.providerId));
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
    });

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

    return allMembers.sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return String(a.staffName || "").localeCompare(String(b.staffName || ""));
    });
  }, [proGroupMembers, proGroupProviderMembers, currentPG, staffMap, providerMap, pendingTransfers, pendingRemovals, sectorMap, isMonthClosed, selectedMonth]);

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
