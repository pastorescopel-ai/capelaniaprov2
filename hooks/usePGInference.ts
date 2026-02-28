
import { useMemo, useCallback } from 'react';
import { Unit, ProGroup, ProSector, ProGroupLocation, ProStaff } from '../types';
import { normalizeString } from '../utils/formatters';

interface PGInferenceResult {
  leaderName: string;
  sectorName: string;
  sectorId: string | null;
  leaderPhone: string;
}

export const usePGInference = (
  unit: Unit,
  proGroups: ProGroup[],
  proSectors: ProSector[],
  proGroupLocations: ProGroupLocation[],
  proStaff: ProStaff[]
) => {
  
  const inferPGDetails = useCallback((pgName: string): PGInferenceResult => {
    if (!pgName) {
      return { leaderName: '', sectorName: 'Setor não informado', sectorId: null, leaderPhone: '' };
    }

    const pg = proGroups.find(g => g.name === pgName && g.unit === unit);
    if (!pg) {
      return { leaderName: '', sectorName: 'Setor não informado', sectorId: null, leaderPhone: '' };
    }

    const leaderName = pg.currentLeader || 'Não informado';
    const leaderPhone = pg.leaderPhone || '';
    
    let sectorName = 'Setor não informado';
    let sectorId = pg.sectorId || null;
    
    // 1. Check proGroupLocations
    if (!sectorId) {
        const loc = proGroupLocations.find(l => l.groupId === pg.id);
        if (loc) sectorId = loc.sectorId;
    }

    // 2. Check Leader's Registration (ProStaff)
    if (!sectorId && pg.currentLeader) {
        const staff = proStaff.find(s => normalizeString(s.name) === normalizeString(pg.currentLeader) && s.unit === unit);
        if (staff) sectorId = staff.sectorId;
    }
    
    if (sectorId) {
        const sec = proSectors.find(s => s.id === sectorId);
        if (sec) sectorName = sec.name;
    }

    return { 
      leaderName, 
      sectorName, 
      sectorId: sectorId || null, 
      leaderPhone 
    };
  }, [proGroups, unit, proGroupLocations, proSectors, proStaff]);

  const inferLeaderDetails = useCallback((leaderName: string) => {
    if (!leaderName) return null;
    
    const staff = proStaff.find(s => normalizeString(s.name) === normalizeString(leaderName) && s.unit === unit);
    if (!staff) return null;

    const sector = proSectors.find(s => s.id === staff.sectorId);
    
    return {
      phone: staff.whatsapp || '',
      sectorName: sector?.name || 'Setor não informado',
      sectorId: staff.sectorId
    };
  }, [proStaff, unit, proSectors]);

  return { inferPGDetails, inferLeaderDetails };
};
