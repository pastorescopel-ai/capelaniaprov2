
import { Unit, ProHistoryRecord, ProStaff, ProSector, ProGroup, ProGroupMember, ProGroupProviderMember, ProGroupLocation, ProMonthlyStats } from '../types';
import { cleanID, getTimestamp, normalizeString } from './formatters';

export interface DashboardMetrics {
  globalPercentage: number;
  totalStaff: number;
  enrolledStaff: number;
  activePGCount: number;
  displaySectors: any[];
  duplicateError?: string | null;
}

export const calculateDashboardMetrics = (
  unit: Unit,
  selectedMonth: string,
  proSectors: ProSector[],
  proStaff: ProStaff[],
  proGroupMembers: ProGroupMember[],
  proGroupProviderMembers: ProGroupProviderMember[],
  proGroupLocations: ProGroupLocation[],
  proGroups: ProGroup[],
  proMonthlyStats: ProMonthlyStats[],
  proHistoryRecords: ProHistoryRecord[],
  debouncedSearchTerm: string,
  filterType: 'sector' | 'pg'
): DashboardMetrics => {
  const targetDate = new Date(selectedMonth + 'T12:00:00');
  const isCurrentMonth = selectedMonth === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59).getTime();
  const monthStart = targetDate.getTime();
  
  // 0. Verificar se o mês está encerrado (Snapshot de Fechamento)
  const isClosed = proMonthlyStats?.some(s => s.month === selectedMonth);
  const historyForMonth = proHistoryRecords.filter(r => r.month === selectedMonth && r.unit === unit);

  if (isClosed && historyForMonth.length > 0) {
    // Deduplicar histórico por staffId
    const historyMap = new Map<string, ProHistoryRecord>();
    historyForMonth.forEach(r => {
      const sid = cleanID(r.staffId);
      const existing = historyMap.get(sid);
      if (!existing || (r.isEnrolled && !existing.isEnrolled)) {
        historyMap.set(sid, r);
      }
    });
    const uniqueHistory = Array.from(historyMap.values());

    const enrolledStaff = uniqueHistory.filter(r => r.isEnrolled);
    const activePGIds = new Set(enrolledStaff.map(r => cleanID(r.groupId)).filter(id => !!id));
    const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));

    const sectorData = proSectors.filter(s => s.unit === unit).map(sector => {
      const sectorIdClean = cleanID(sector.id);
      const staffInSector = uniqueHistory.filter(r => cleanID(r.sectorId) === sectorIdClean);
      const enrolledInSector = staffInSector.filter(r => r.isEnrolled);
      
      const pgsInSectorIds = new Set(enrolledInSector.map(r => cleanID(r.groupId)));
      const pgsInSector = Array.from(pgsInSectorIds).map(gid => groupsById.get(gid)).filter(g => !!g);

      return {
        sector,
        pgsInSector,
        total: staffInSector.length,
        enrolled: enrolledInSector.length,
        pgCount: pgsInSector.length,
        percentage: staffInSector.length > 0 ? (enrolledInSector.length / staffInSector.length) * 100 : 0,
        isSnapshot: true,
        staffList: staffInSector.map(r => ({ id: r.staffId, name: r.staffName, isEnrolled: r.isEnrolled }))
      };
    });

    // Adicionar "Sem Setor" do histórico
    const unassignedInHistory = uniqueHistory.filter(r => r.sectorId === 'unassigned' || !r.sectorId);
    if (unassignedInHistory.length > 0) {
      const enrolledUnassigned = unassignedInHistory.filter(r => r.isEnrolled);
      sectorData.push({
        sector: { id: 'unassigned', name: 'SEM SETOR DEFINIDO', unit } as any,
        pgsInSector: [],
        total: unassignedInHistory.length,
        enrolled: enrolledUnassigned.length,
        pgCount: 0,
        percentage: (enrolledUnassigned.length / unassignedInHistory.length) * 100,
        isSnapshot: true
      });
    }

    const totalStaffCount = uniqueHistory.length;
    const enrolledStaffCount = enrolledStaff.length;
    const globalPercentage = totalStaffCount > 0 ? (enrolledStaffCount / totalStaffCount) * 100 : 0;

    // Filtro de Busca
    const normSearch = normalizeString(debouncedSearchTerm);
    const searchTerms = normSearch.split(' ').filter(t => t);
    const filteredData = sectorData.filter(d => {
        if (searchTerms.length === 0) return d.total > 0;
        const targetText = filterType === 'sector' ? d.sector.name : d.pgsInSector.map(pg => pg?.name || '').join(' ');
        const normTarget = normalizeString(targetText);
        return searchTerms.every(term => normTarget.includes(term)) && d.total > 0;
    });

    return {
      globalPercentage,
      totalStaff: totalStaffCount,
      enrolledStaff: enrolledStaffCount,
      activePGCount: activePGIds.size,
      displaySectors: filteredData.sort((a, b) => a.percentage - b.percentage)
    };
  }

  // 1. Filtrar setores e staff da unidade
  const staffMap = new Map<string, any>();
  const migrationDate = new Date('2026-04-04').getTime();

  proStaff.forEach(s => {
    if (s.unit !== unit) return;
    
    const createdDate = getTimestamp(s.createdAt);
    const leftDate = getTimestamp(s.leftAt);
    
    const hasLeftBeforeMonth = leftDate && leftDate < monthStart;
    const wasCreatedBeforeEnd = createdDate && createdDate <= monthEnd;

    const isMigrationReset = !isCurrentMonth && 
                             createdDate >= migrationDate && 
                             (!leftDate || leftDate >= monthStart) &&
                             selectedMonth >= '2026-02-01';

    if (!hasLeftBeforeMonth && (wasCreatedBeforeEnd || isMigrationReset)) {
      if (isCurrentMonth && s.active === false) return;

      const idClean = cleanID(s.id);
      const existing = staffMap.get(idClean);
      if (!existing || (s.active && !existing.active)) {
        staffMap.set(idClean, s);
      }
    }
  });

  const unitStaff = Array.from(staffMap.values());
  const unitSectors = proSectors.filter(s => s.unit === unit && (isCurrentMonth ? s.active !== false : true));

  const validSectorIds = new Set(unitSectors.map(s => cleanID(s.id)));
  const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));
  
  const enrolledStaffIds = new Set<string>();
  const memberGroupIdsBySector = new Map<string, Set<string>>();
  const activePGIds = new Set<string>();

  proGroupMembers.forEach(m => {
    const group = groupsById.get(cleanID(m.groupId));
    if (!group || group.unit !== unit) return;

    const mCycleDate = m.cycleMonth ? new Date(m.cycleMonth + 'T12:00:00').getTime() : 0;
    const mLeftDate = getTimestamp(m.leftAt);
    const mJoinedAt = getTimestamp(m.joinedAt);
    const mCreatedAt = getTimestamp(m.createdAt);
    
    const effectiveJoined = mJoinedAt || mCreatedAt;
    const isCycleMatch = !m.cycleMonth || mCycleDate <= monthEnd;
    const isMigrationReset = !isCurrentMonth && !mJoinedAt && mCreatedAt >= migrationDate && (!mLeftDate || mLeftDate >= monthStart);
    const isPeriodMatch = (effectiveJoined <= monthEnd || isMigrationReset) && (!mLeftDate || mLeftDate >= monthStart);

    if (isCycleMatch || isPeriodMatch) {
      enrolledStaffIds.add(cleanID(m.staffId));
      activePGIds.add(cleanID(m.groupId));
    }
  });
  
  (proGroupProviderMembers || []).forEach(m => {
    const group = groupsById.get(cleanID(m.groupId));
    if (!group || group.unit !== unit) return;

    const mCycleDate = m.cycleMonth ? new Date(m.cycleMonth + 'T12:00:00').getTime() : 0;
    const mLeftDate = getTimestamp(m.leftAt);
    const mJoinedDate = getTimestamp(m.joinedAt || m.createdAt);

    const isCycleMatch = !m.cycleMonth || mCycleDate <= monthEnd;
    const isPeriodMatch = mJoinedDate <= monthEnd && (!mLeftDate || mLeftDate >= targetDate.getTime());

    if (isCycleMatch || isPeriodMatch) {
      activePGIds.add(cleanID(m.groupId));
    }
  });

  const staffBySector = new Map<string, any[]>();
  const unassignedStaff: any[] = [];
  const sectorIdByStaffId = new Map<string, string>();

  unitStaff.forEach(s => {
    const sId = cleanID(s.sectorId);
    const staffIdClean = cleanID(s.id);
    if (sId && validSectorIds.has(sId)) {
      if (!staffBySector.has(sId)) staffBySector.set(sId, []);
      staffBySector.get(sId)?.push(s);
      sectorIdByStaffId.set(staffIdClean, sId);
    } else {
      unassignedStaff.push(s);
      sectorIdByStaffId.set(staffIdClean, 'unassigned');
    }
  });

  proGroupMembers.forEach(m => {
    const mLeftDate = getTimestamp(m.leftAt);
    if (!mLeftDate || mLeftDate >= targetDate.getTime()) {
      const staffIdClean = cleanID(m.staffId);
      const sId = sectorIdByStaffId.get(staffIdClean);
      if (sId) {
        if (!memberGroupIdsBySector.has(sId)) memberGroupIdsBySector.set(sId, new Set());
        memberGroupIdsBySector.get(sId)?.add(cleanID(m.groupId));
      }
    }
  });

  const geoGroupIdsBySector = new Map<string, Set<string>>();
  proGroupLocations.forEach(loc => {
    const sId = cleanID(loc.sectorId);
    if (!geoGroupIdsBySector.has(sId)) geoGroupIdsBySector.set(sId, new Set());
    geoGroupIdsBySector.get(sId)?.add(cleanID(loc.groupId));
  });

  const sectorData = unitSectors.map(sector => {
    const sectorIdClean = cleanID(sector.id);
    const staffInSector = staffBySector.get(sectorIdClean) || [];
    const countTotal = staffInSector.length;
    const staffEnrolled = staffInSector.filter(s => enrolledStaffIds.has(cleanID(s.id))).length;

    const geoGroupIds = geoGroupIdsBySector.get(sectorIdClean) || new Set();
    const memberGroupIds = memberGroupIdsBySector.get(sectorIdClean) || new Set();

    const allGroupIdsInSector = new Set([...Array.from(geoGroupIds), ...Array.from(memberGroupIds)]);
    const pgsInSector = Array.from(allGroupIdsInSector)
      .map(gid => groupsById.get(gid))
      .filter(g => !!g);

    return {
      sector,
      pgsInSector,
      total: countTotal,
      enrolled: staffEnrolled,
      pgCount: pgsInSector.length,
      percentage: countTotal > 0 ? (staffEnrolled / countTotal) * 100 : 0,
      staffList: staffInSector.map(s => ({ id: s.id, name: s.name, isEnrolled: enrolledStaffIds.has(cleanID(s.id)), active: s.active }))
    };
  });

  if (unassignedStaff.length > 0) {
    const enrolledUnassigned = unassignedStaff.filter(s => enrolledStaffIds.has(cleanID(s.id))).length;
    sectorData.push({
      sector: { id: 'unassigned', name: 'SEM SETOR DEFINIDO', unit } as any,
      pgsInSector: [],
      total: unassignedStaff.length,
      enrolled: enrolledUnassigned,
      pgCount: 0,
      percentage: (enrolledUnassigned / unassignedStaff.length) * 100,
      staffList: unassignedStaff.map(s => ({ id: s.id, name: s.name, isEnrolled: enrolledStaffIds.has(cleanID(s.id)), active: s.active }))
    });
  }

  const normSearch = normalizeString(debouncedSearchTerm);
  const searchTerms = normSearch.split(' ').filter(t => t);

  const filteredData = sectorData.filter(d => {
      if (searchTerms.length === 0) return d.total > 0;
      const targetText = filterType === 'sector' ? d.sector.name : d.pgsInSector.map(pg => pg?.name || '').join(' ');
      const normTarget = normalizeString(targetText);
      return searchTerms.every(term => normTarget.includes(term)) && d.total > 0;
  });

  let totalStaff = 0;
  let enrolledStaffCount = 0;
  sectorData.forEach(d => {
      totalStaff += d.total;
      enrolledStaffCount += d.enrolled;
  });

  const globalPercentage = totalStaff > 0 ? (enrolledStaffCount / totalStaff) * 100 : 0;

  let duplicateError: string | null = null;
  if (!isClosed) {
    const idCounts = new Map<string, number>();
    const duplicates: string[] = [];
    proStaff.forEach(s => {
      if (s.unit === unit) {
        const id = cleanID(s.id);
        const createdDate = getTimestamp(s.createdAt);
        const leftAt = getTimestamp(s.leftAt);
        const wasActiveInMonth = createdDate <= monthEnd && (!leftAt || leftAt >= targetDate.getTime());
        if (wasActiveInMonth) {
          idCounts.set(id, (idCounts.get(id) || 0) + 1);
          if (idCounts.get(id) === 2) duplicates.push(id);
        }
      }
    });
    if (duplicates.length > 0) {
      duplicateError = `DETECTADO: ${duplicates.length} IDs duplicados ativos para ${selectedMonth}. IDs: ${duplicates.join(', ')}.`;
    }
  }

  return { 
      globalPercentage, 
      totalStaff, 
      enrolledStaff: enrolledStaffCount, 
      activePGCount: activePGIds.size,
      displaySectors: filteredData.sort((a, b) => a.percentage - b.percentage),
      duplicateError
  };
};
