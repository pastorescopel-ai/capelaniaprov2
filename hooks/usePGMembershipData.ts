
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
  pendingRemovals
}: UsePGMembershipDataProps) => {
  const cleanId = (id: any) => String(id || '').replace(/\D/g, '');

  const currentSector = useMemo(() => 
    proSectors.find(s => s.name === selectedSectorName && s.unit === unit), 
    [proSectors, selectedSectorName, unit]
  );
  
  const currentPG = useMemo(() => 
    proGroups.find(g => g.name === selectedPGName && g.unit === unit), 
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
            !m.leftAt && 
            !pendingRemovals.has(m.id)
        );
        const groupName = membership ? proGroups.find(g => g.id === membership.groupId)?.name : null;
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
  }, [proProviders, unit, providerSearch, proGroupProviderMembers, proGroups, currentPG, pendingRemovals, pendingTransfers]);

  const coverageGaps = useMemo(() => {
    const sectors = proSectors.filter(s => s.unit === unit);
    const staff = proStaff.filter(s => s.unit === unit);

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
      .filter(g => g.unit === unit)
      .filter(g => !proGroupMembers.some(m => m.groupId === g.id && !m.leftAt))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [proGroups, proGroupMembers, unit]);

  const availableStaff = useMemo(() => {
    let filtered = proStaff.filter(s => s.unit === unit);
    
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

    return filtered.map(staff => {
        const membership = proGroupMembers.find(m => 
          cleanId(m.staffId) === cleanId(staff.id) && 
          !m.leftAt && 
          !pendingRemovals.has(m.id)
        );
        
        const groupName = membership ? proGroups.find(g => g.id === membership.groupId)?.name : null;
        const dateStr = membership?.joinedAt 
            ? new Date(membership.joinedAt).toLocaleDateString('pt-BR') 
            : null;

        const sector = proSectors.find(s => s.id === staff.sectorId);
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
  }, [proStaff, currentSector, staffSearch, proGroupMembers, proGroups, currentPG, pendingTransfers, pendingRemovals, unit, proSectors]);

  const pgMembers = useMemo(() => {
    if (!currentPG) return [];
    
    const realStaffMembers = proGroupMembers
      .filter(m => m.groupId === currentPG.id && !m.leftAt && !pendingRemovals.has(m.id))
      .map(m => {
        const staff = proStaff.find(s => cleanId(s.id) === cleanId(m.staffId));
        const sector = proSectors.find(s => s.id === staff?.sectorId);
        return { 
            id: m.id,
            staffName: staff?.name || `Desconhecido (ID: ${m.staffId})`, 
            staffId: m.staffId,
            sectorName: sector?.name || 'Sem Setor',
            joinedDate: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-BR') : '',
            isOptimistic: false,
            isLeader: currentPG.currentLeader === staff?.name,
            type: 'staff'
        };
      });

    const realProviderMembers = proGroupProviderMembers
      .filter(m => m.groupId === currentPG.id && !m.leftAt && !pendingRemovals.has(m.id))
      .map(m => {
        const provider = proProviders.find(p => cleanId(p.id) === cleanId(m.providerId));
        return {
            id: m.id,
            staffName: provider?.name || `Desconhecido (ID: ${m.providerId})`,
            staffId: m.providerId,
            joinedDate: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-BR') : '',
            isOptimistic: false,
            isLeader: currentPG.currentLeader === provider?.name,
            type: 'provider'
        };
      });

    const optimisticMembers = Array.from(pendingTransfers).map(id => {
        const staff = proStaff.find(s => s.id === id);
        const provider = proProviders.find(p => p.id === id);
        const sector = staff ? proSectors.find(s => s.id === staff.sectorId) : null;
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
  }, [proGroupMembers, proGroupProviderMembers, currentPG, proStaff, proProviders, pendingTransfers, pendingRemovals, proSectors]);

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
