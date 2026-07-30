
import { useMemo, useState, useEffect } from 'react';
import { Unit, ProHistoryRecord } from '../types';
import { usePro } from '../contexts/ProContext';
import { useApp } from './useApp';
import { getTimestamp, normalizeString, cleanID } from '../utils/formatters';
import { DataRepository } from '../services/dataRepository';
import { toCamel } from '../utils/transformers';

interface UsePGReportsDataProps {
  unit: Unit;
  startDate: string;
  endDate: string;
  searchTerm: string;
  selectedTarget: { type: 'sector' | 'pg' | 'leader'; id: string; label: string } | null;
  filterCritical: boolean;
}

export function usePGReportsData({
  unit,
  startDate,
  endDate,
  searchTerm,
  selectedTarget,
  filterCritical
}: UsePGReportsDataProps) {
  const { 
    proSectors, 
    proStaff, 
    proGroupMembers, 
    proGroupProviderMembers, 
    proProviders, 
    proGroupLocations, 
    proGroups, 
    proHistoryRecords 
  } = usePro();
  const { config } = useApp();

  // A sincronização geral só mantém ~45 dias de pro_history_records em memória (ver
  // dataRepository.ts). Para meses fora dessa janela, busca o snapshot direto no Supabase —
  // mesmo padrão já usado em PGDashboard.tsx — para não mostrar tudo zerado em meses antigos.
  const monthKeyForFetch = useMemo(() => {
    const sDate = new Date(startDate + 'T12:00:00');
    return new Date(sDate.getFullYear(), sDate.getMonth(), 1).toISOString().split('T')[0];
  }, [startDate]);
  const [localHistory, setLocalHistory] = useState<ProHistoryRecord[] | null>(null);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    const limitMonth = d.toISOString().substring(0, 7) + '-01';

    if (monthKeyForFetch < limitMonth) {
      let cancelled = false;
      DataRepository.fetchFullTable('pro_history_records', 199999, q => q.eq('month', monthKeyForFetch))
        // fetchFullTable retorna as colunas cruas do Supabase (snake_case) — sem essa conversão,
        // os campos camelCase que o resto do app espera (isEnrolled, groupName, staffId...) ficam
        // undefined e todo o relatório computa como zero, mesmo com os dados corretos vindo da API.
        .then(res => { if (!cancelled) setLocalHistory(res.data ? toCamel(res.data) : []); })
        .catch(err => { console.error('Error loading historical report data', err); if (!cancelled) setLocalHistory([]); });
      return () => { cancelled = true; };
    } else {
      setLocalHistory(null);
    }
  }, [monthKeyForFetch]);

  const effectiveHistoryRecords = localHistory !== null ? localHistory : proHistoryRecords;

  return useMemo(() => {
    const sectors = proSectors.filter(s => s.unit === unit).sort((a, b) => a.name.localeCompare(b.name));
    let activePGCount = 0;
    const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
    const endTimestamp = new Date(endDate + 'T23:59:59').getTime();
    const sDate = new Date(startDate + 'T12:00:00');

    const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));
    const providersById = new Map(proProviders.map(p => [cleanID(p.id), p]));

    const monthStr = new Date(sDate.getFullYear(), sDate.getMonth(), 1).toISOString().split('T')[0];
    const historyForMonth = effectiveHistoryRecords.filter(r => r.month === monthStr && r.unit === unit);

    let data: any[] = [];

    if (historyForMonth.length > 0) {
      // Group all staff members in historyForMonth by groupName/groupId
      // So that we can display ALL staff of this PG in the unit for that closed month!
      const activeStaffByPGNameHistory = new Map<string, any[]>();
      historyForMonth.filter(r => r.isEnrolled).forEach(r => {
        const pgNameNorm = normalizeString(r.groupName || 'Sem PG Definido');
        if (!activeStaffByPGNameHistory.has(pgNameNorm)) {
          activeStaffByPGNameHistory.set(pgNameNorm, []);
        }
        activeStaffByPGNameHistory.get(pgNameNorm)?.push(r);
      });

      data = sectors.map(sector => {
        const sectorIdClean = cleanID(sector.id);
        const staffInHistory = historyForMonth.filter(r => cleanID(r.sectorId) === sectorIdClean || (r.sectorId === 'unassigned' && sectorIdClean === 'unassigned'));
        
        const enrolledStaff = staffInHistory.filter(r => r.isEnrolled);
        const notEnrolled = staffInHistory.filter(r => !r.isEnrolled);

        const enrolledByPGMap = new Map<string, { pgName: string, members: any[], leaderName: string | null }>();
        
        const pgsInSectorIds = new Set(enrolledStaff.map(r => r.groupId).filter(id => id));
        const pgs = Array.from(pgsInSectorIds).map(gid => groupsById.get(cleanID(gid))).filter(g => !!g) as any[];

        pgs.forEach(pg => {
          if (!pg) return;
          const pgName = pg.name || 'Sem PG Definido';
          const leaderName = pg.currentLeader || null;
          const pgNameNorm = normalizeString(pgName);

          if (!enrolledByPGMap.has(pgNameNorm)) {
            enrolledByPGMap.set(pgNameNorm, { pgName, members: [], leaderName });
          }

          const pgStaffHistory = activeStaffByPGNameHistory.get(pgNameNorm) || [];
          pgStaffHistory.forEach(r => {
            const sSector = proSectors.find(sec => cleanID(sec.id) === cleanID(r.sectorId));
            const sectorName = sSector?.name || 'Setor Não Definido';
            const isOtherSector = cleanID(r.sectorId) !== sectorIdClean;

            if (!enrolledByPGMap.get(pgNameNorm)!.members.some(mem => mem.id === r.staffId && mem.type === 'staff')) {
              enrolledByPGMap.get(pgNameNorm)!.members.push({
                id: r.staffId,
                name: r.staffName,
                registrationId: r.registrationId,
                type: 'staff',
                sectorId: r.sectorId,
                sectorName,
                isOtherSector
              });
            }
          });
        });

        const enrolledByPG = Array.from(enrolledByPGMap.values()).sort((a, b) => a.pgName.localeCompare(b.pgName));
        const coverage = staffInHistory.length > 0 ? (enrolledStaff.length / staffInHistory.length) * 100 : 0;

        return { 
          sector, 
          totalStaff: staffInHistory.length, 
          enrolledCount: enrolledStaff.length, 
          coverage, 
          pgs, 
          notEnrolledList: notEnrolled.map(r => ({ id: r.staffId, name: r.staffName, registrationId: r.registrationId })), 
          enrolledList: enrolledStaff.map(r => ({ id: r.staffId, name: r.staffName, registrationId: r.registrationId })), 
          enrolledByPG,
          isSnapshot: true
        };
      }).filter(d => d.totalStaff > 0);
      
      const activePGIds = new Set(historyForMonth.filter(r => r.isEnrolled && r.groupId).map(r => cleanID(r.groupId)));
      activePGCount = activePGIds.size;
    } else {
      const activeStaffMemberships = proGroupMembers.filter(m => {
          const group = groupsById.get(cleanID(m.groupId));
          if (!group || group.unit !== unit) return false;
          
          const mCycleDate = m.cycleMonth ? new Date(m.cycleMonth + 'T12:00:00').getTime() : 0;
          const mLeftDate = getTimestamp(m.leftAt);
          
          return !m.isError &&
                 (!m.cycleMonth || mCycleDate <= endTimestamp) &&
                 (!mLeftDate || mLeftDate >= startTimestamp);
      });

      const activeProviderMemberships = proGroupProviderMembers.filter(m => {
          const group = groupsById.get(cleanID(m.groupId));
          if (!group || group.unit !== unit) return false;
          
          const mCycleDate = m.cycleMonth ? new Date(m.cycleMonth + 'T12:00:00').getTime() : 0;
          const mLeftDate = getTimestamp(m.leftAt);
          
          return !m.isError &&
                 (!m.cycleMonth || mCycleDate <= endTimestamp) &&
                 (!mLeftDate || mLeftDate >= startTimestamp);
      });

      const activePGIds = new Set<string>();
      activeStaffMemberships.forEach(m => activePGIds.add(cleanID(m.groupId)));
      activeProviderMemberships.forEach(m => activePGIds.add(cleanID(m.groupId)));
      activePGCount = activePGIds.size;

      const activeStaffMembershipsByStaffId = new Map<string, any>();
      activeStaffMemberships.forEach(m => activeStaffMembershipsByStaffId.set(cleanID(m.staffId), m));

      const staffBySector = new Map<string, any[]>();
      const monthEnd = new Date(sDate.getFullYear(), sDate.getMonth() + 1, 0, 23, 59, 59).getTime();
      const targetDate = new Date(startDate + 'T12:00:00');

      proStaff.forEach(s => {
        if (s.unit !== unit) return;
        if (s.active === false) return;

        const createdDate = getTimestamp(s.createdAt);
        if (createdDate && createdDate > monthEnd) return;

        if (!createdDate && s.cycleMonth) {
          const cycleDate = new Date(s.cycleMonth + 'T12:00:00').getTime();
          if (cycleDate > monthEnd) return;
        }

        const leftDate = getTimestamp(s.leftAt);
        if (leftDate && leftDate < targetDate.getTime()) return;

        const sId = cleanID(s.sectorId);
        if (!staffBySector.has(sId)) staffBySector.set(sId, []);
        staffBySector.get(sId)?.push(s);
      });

      const locsBySector = new Map<string, Set<string>>();
      proGroupLocations.forEach(loc => {
        const sId = cleanID(loc.sectorId);
        if (!locsBySector.has(sId)) locsBySector.set(sId, new Set());
        locsBySector.get(sId)?.add(cleanID(loc.groupId));
      });

      const activeProviderMembershipsByGroupId = new Map<string, any[]>();
      activeProviderMemberships.forEach(m => {
          const gId = cleanID(m.groupId);
          if (!activeProviderMembershipsByGroupId.has(gId)) activeProviderMembershipsByGroupId.set(gId, []);
          activeProviderMembershipsByGroupId.get(gId)?.push(m);
      });

      const activeStaffMembershipsByGroupId = new Map<string, any[]>();
      activeStaffMemberships.forEach(m => {
          const gId = cleanID(m.groupId);
          if (!activeStaffMembershipsByGroupId.has(gId)) activeStaffMembershipsByGroupId.set(gId, []);
          activeStaffMembershipsByGroupId.get(gId)?.push(m);
      });

      const processedPGIds = new Set<string>();

      data = sectors.map(sector => {
          const sectorIdClean = cleanID(sector.id);
          const staff = staffBySector.get(sectorIdClean) || [];
          const enrolledStaff: any[] = [];
          const notEnrolled: any[] = [];

          staff.forEach(s => {
              if (activeStaffMembershipsByStaffId.has(cleanID(s.id))) {
                  enrolledStaff.push(s);
              } else {
                  notEnrolled.push(s);
              }
          });
          
          const enrolledByPGMap = new Map<string, { pgName: string, members: any[], leaderName: string | null }>();
          
          const sectorLocs = locsBySector.get(sectorIdClean) || new Set();
          const geoGroupIds = sectorLocs;
          const memberGroupIds = new Set(enrolledStaff.map(s => {
              const m = activeStaffMembershipsByStaffId.get(cleanID(s.id));
              return m ? cleanID(m.groupId) : null;
          }).filter(id => id !== null) as string[]);
          
          const allGroupIdsInSector = new Set([...Array.from(geoGroupIds), ...Array.from(memberGroupIds)]);
          allGroupIdsInSector.forEach(id => processedPGIds.add(id));
          
          const pgs = Array.from(allGroupIdsInSector).map(gid => groupsById.get(gid)).filter(g => !!g);

          allGroupIdsInSector.forEach(pgIdClean => {
              const pg = groupsById.get(pgIdClean);
              if (!pg) return;
              
              const pgName = pg.name || 'Sem PG Definido';
              const leaderName = pg.currentLeader || null;
              const pgNameNorm = normalizeString(pgName);
              
              if (!enrolledByPGMap.has(pgNameNorm)) {
                  enrolledByPGMap.set(pgNameNorm, { pgName, members: [], leaderName });
              }

              // Staff
              const sMemberships = activeStaffMembershipsByGroupId.get(pgIdClean) || [];
              sMemberships.forEach(m => {
                  const s = proStaff.find(st => cleanID(st.id) === cleanID(m.staffId));
                  if (s) {
                      const sSector = proSectors.find(sec => cleanID(sec.id) === cleanID(s.sectorId));
                      const sectorName = sSector?.name || 'Setor Não Definido';
                      const isOtherSector = cleanID(s.sectorId) !== sectorIdClean;
                      
                      if (!enrolledByPGMap.get(pgNameNorm)!.members.some(mem => mem.id === s.id && mem.type === 'staff')) {
                          enrolledByPGMap.get(pgNameNorm)!.members.push({
                              ...s,
                              type: 'staff',
                              sectorName,
                              isOtherSector
                          });
                      }
                  }
              });

              // Providers
              const pMemberships = activeProviderMembershipsByGroupId.get(pgIdClean) || [];
              pMemberships.forEach(m => {
                  const provider = providersById.get(cleanID(m.providerId));
                  if (provider) {
                      if (!enrolledByPGMap.get(pgNameNorm)!.members.some(mem => mem.id === provider.id && mem.type === 'provider')) {
                          enrolledByPGMap.get(pgNameNorm)!.members.push({ ...provider, type: 'provider' });
                      }
                  }
              });
          });

          const enrolledByPG = Array.from(enrolledByPGMap.values()).sort((a, b) => a.pgName.localeCompare(b.pgName));
          const coverage = staff.length > 0 ? (enrolledStaff.length / staff.length) * 100 : 0;

          return { sector, totalStaff: staff.length, enrolledCount: enrolledStaff.length, coverage, pgs, notEnrolledList: notEnrolled, enrolledList: enrolledStaff, enrolledByPG };
      });

      const unassignedPGIds = Array.from(activePGIds).filter(id => !processedPGIds.has(id));
      if (unassignedPGIds.length > 0) {
          const enrolledByPGMap = new Map<string, { pgName: string, members: any[], leaderName: string | null }>();
          const pgs: any[] = [];

          unassignedPGIds.forEach(pgIdClean => {
              const pg = groupsById.get(pgIdClean);
              if (!pg) return;
              pgs.push(pg);

              const providerMemberships = activeProviderMembershipsByGroupId.get(pgIdClean) || [];
              providerMemberships.forEach(m => {
                  const provider = providersById.get(cleanID(m.providerId));
                  if (provider) {
                      const pgName = pg.name || 'Sem PG Definido';
                      const leaderName = pg.currentLeader || null;
                      const pgNameNorm = normalizeString(pgName);
                      
                      if (!enrolledByPGMap.has(pgNameNorm)) {
                          enrolledByPGMap.set(pgNameNorm, { pgName, members: [], leaderName });
                      }
                      if (!enrolledByPGMap.get(pgNameNorm)!.members.some(mem => mem.id === provider.id)) {
                          enrolledByPGMap.get(pgNameNorm)!.members.push({ ...provider, type: 'provider' });
                      }
                  }
              });

              activeStaffMemberships.forEach(m => {
                  if (cleanID(m.groupId) === pgIdClean) {
                      const staffMember = proStaff.find(s => cleanID(s.id) === cleanID(m.staffId));
                      if (staffMember) {
                          const pgName = pg.name || 'Sem PG Definido';
                          const leaderName = pg.currentLeader || null;
                          const pgNameNorm = normalizeString(pgName);
                          
                          if (!enrolledByPGMap.has(pgNameNorm)) {
                              enrolledByPGMap.set(pgNameNorm, { pgName, members: [], leaderName });
                          }
                          if (!enrolledByPGMap.get(pgNameNorm)!.members.some(mem => mem.id === staffMember.id)) {
                              enrolledByPGMap.get(pgNameNorm)!.members.push({ ...staffMember, type: 'staff' });
                          }
                      }
                  }
              });
          });

          if (enrolledByPGMap.size > 0) {
              data.push({
                  sector: { id: 'virtual-independent', name: 'PGs Independentes / Prestadores', unit, active: true },
                  totalStaff: 0,
                  enrolledCount: 0,
                  coverage: 0,
                  pgs,
                  notEnrolledList: [],
                  enrolledList: [],
                  enrolledByPG: Array.from(enrolledByPGMap.values()).sort((a, b) => a.pgName.localeCompare(b.pgName))
              });
          }
      }

      data = data.filter(d => d.totalStaff > 0 || d.enrolledByPG.length > 0);
    }

    const normSearch = normalizeString(searchTerm);
    const searchTerms = normSearch.split(' ').filter(t => t);

    return {
        reportData: data.filter(d => {
            if (d.totalStaff === 0 && d.enrolledByPG.length === 0) return false;
            if (filterCritical && d.coverage >= 80) return false;

            if (selectedTarget) {
                if (selectedTarget.type === 'sector') return d.sector.id === selectedTarget.id;
                if (selectedTarget.type === 'pg') return d.pgs.some((pg: any) => pg?.id === selectedTarget.id);
                if (selectedTarget.type === 'leader') return d.enrolledByPG.some((group: any) => group.leaderName === selectedTarget.label.split('Líder: ')[1].split(' (')[0]);
            }
            
            if (searchTerms.length === 0) return true;
            
            const targetText = d.sector.name + ' ' + d.pgs.map((pg: any) => pg?.name || '').join(' ');
            const normTarget = normalizeString(targetText);
            return searchTerms.every(term => normTarget.includes(term));
        }),
        activePGCount: activePGCount
    };
  }, [proSectors, proStaff, proGroupMembers, proGroupProviderMembers, proProviders, proGroupLocations, proGroups, effectiveHistoryRecords, unit, searchTerm, selectedTarget, startDate, endDate, filterCritical]);
}
