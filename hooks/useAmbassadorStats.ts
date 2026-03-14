import { useMemo } from 'react';
import { Unit, Ambassador, ProSector, ProStaff, ProMonthlyStats } from '../types';

export const useAmbassadorStats = (
  ambassadors: Ambassador[],
  proSectors: ProSector[],
  proStaff: ProStaff[],
  proMonthlyStats: ProMonthlyStats[],
  selectedMonth?: string
) => {
  const stats = useMemo(() => {
    const dataByUnit = {
      [Unit.HAB]: { total: 0, sectors: {} as Record<string, { id: string, name: string, count: number, totalStaff: number, percent: number }> },
      [Unit.HABA]: { total: 0, sectors: {} as Record<string, { id: string, name: string, count: number, totalStaff: number, percent: number }> }
    };

    // 1. Verificar se existem snapshots para o mês selecionado
    if (selectedMonth) {
      const snapshots = proMonthlyStats.filter(s => s.month === selectedMonth && s.type === 'sector');
      if (snapshots.length > 0) {
        snapshots.forEach(snap => {
          const sector = proSectors.find(s => s.id === snap.targetId);
          if (sector && dataByUnit[snap.unit]) {
            dataByUnit[snap.unit].sectors[snap.targetId] = {
              id: snap.targetId,
              name: sector.name,
              count: snap.totalParticipants,
              totalStaff: snap.totalStaff,
              percent: snap.percentage
            };
            dataByUnit[snap.unit].total += snap.totalParticipants;
          }
        });
        return dataByUnit;
      }
    }

    // Lógica de Seleção de Staff (Fallback se não houver snapshot): 
    // 1. Tenta pegar o staff importado especificamente para o mês selecionado
    // 2. Se não houver, usa o staff marcado como "Ativo" (última importação realizada)
    const getStaffForUnit = (unit: Unit) => {
      const unitStaff = proStaff.filter(s => s.unit === unit);
      if (selectedMonth) {
        const cycleStaff = unitStaff.filter(s => s.cycleMonth === selectedMonth);
        if (cycleStaff.length > 0) return cycleStaff;
      }
      return unitStaff.filter(s => s.active !== false);
    };

    const staffHAB = getStaffForUnit(Unit.HAB);
    const staffHABA = getStaffForUnit(Unit.HABA);

    proSectors.forEach(sector => {
      if (!dataByUnit[sector.unit]) return;
      const sectorIdStr = String(sector.id);
      const currentStaffList = sector.unit === Unit.HAB ? staffHAB : staffHABA;
      const staffInSector = currentStaffList.filter(s => String(s.sectorId) === sectorIdStr).length;
      
      dataByUnit[sector.unit].sectors[sectorIdStr] = {
        id: sectorIdStr,
        name: sector.name,
        count: 0,
        totalStaff: staffInSector || 1,
        percent: 0
      };
    });

    ambassadors.forEach(amb => {
      const ambSectorIdStr = amb.sectorId ? String(amb.sectorId) : null;
      if (ambSectorIdStr && dataByUnit[amb.unit]?.sectors[ambSectorIdStr]) {
        dataByUnit[amb.unit].sectors[ambSectorIdStr].count++;
        dataByUnit[amb.unit].total++;
      }
    });

    Object.keys(dataByUnit).forEach(u => {
      const unit = u as Unit;
      Object.values(dataByUnit[unit].sectors).forEach(s => {
        s.percent = (s.count / s.totalStaff) * 100;
      });
    });

    return dataByUnit;
  }, [ambassadors, proSectors, proStaff, proMonthlyStats, selectedMonth]);

  const getChartData = (unit: Unit) => {
    return Object.values(stats[unit].sectors)
      .sort((a, b) => b.percent - a.percent)
      .filter(s => s.count > 0 || s.totalStaff > 5)
      .slice(0, 15);
  };

  return { stats, getChartData };
};
