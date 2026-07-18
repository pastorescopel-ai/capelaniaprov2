
import { useMemo, useCallback } from 'react';
import { Unit, ProGroup, ProSector, ProGroupLocation, ProStaff } from '../types';
import { normalizeString } from '../utils/formatters';
import { getValidSectorId } from '../utils/sectorValidation';

interface PGInferenceResult {
  leaderName: string;
  sectorName: string;
  sectorId: string | null;
  leaderPhone: string;
  staffId: string | null;
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
    let staffId: string | null = null;
    
    // 1. Check Leader's Registration (ProStaff) — prioriza o vínculo por ID, já
    // imune a homônimo/erro de digitação; cai para o nome só quando o PG ainda
    // não tem leaderStaffId gravado.
    if (pg.leaderStaffId || pg.currentLeader) {
        const staff = pg.leaderStaffId
            ? proStaff.find(s => s.id === pg.leaderStaffId)
            : proStaff.find(s => normalizeString(s.name) === normalizeString(pg.currentLeader) && s.unit === unit);
        if (staff) {
            staffId = staff.id;
            if (!sectorId) {
                const validSectorId = getValidSectorId(staff.sectorId, unit, proSectors);
                if (validSectorId) sectorId = validSectorId;
            }
        }
    }

    // 2. Check proGroupLocations
    if (!sectorId) {
        const loc = proGroupLocations.find(l => l.groupId === pg.id);
        if (loc) sectorId = loc.sectorId;
    }
    
    if (sectorId) {
        const sec = proSectors.find(s => s.id === sectorId);
        if (sec) sectorName = sec.name;
    }

    return { 
      leaderName, 
      sectorName, 
      sectorId: sectorId || null, 
      leaderPhone,
      staffId
    };
  }, [proGroups, unit, proGroupLocations, proSectors, proStaff]);

  return { inferPGDetails };
};
