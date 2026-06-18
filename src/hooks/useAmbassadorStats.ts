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

    // Lógica robusta com vigência temporal de dados históricos:
    // 1. O colaborador já devia estar cadastrado/importado no sistema até o final do mês selecionado.
    // 2. O colaborador não pode ter sido desligado (leftAt) em período anterior ao início do mês selecionado.
    // 3. Essa lógica previne distorções drásticas quando planilhas parciais ou mensais são carregadas.
    const getStaffForUnit = (unit: Unit) => {
      const unitStaff = proStaff.filter(s => s.unit === unit);
      if (selectedMonth) {
        const parts = selectedMonth.split('-');
        if (parts.length >= 2) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          
          const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0).getTime();
          const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();

          return unitStaff.filter(s => {
            // 1. Data de criação ou ciclo de referência inicial
            const createdTime = s.createdAt ? new Date(s.createdAt).getTime() : null;
            if (createdTime && createdTime > monthEnd) return false;

            if (!createdTime && s.cycleMonth) {
              const cycleTime = new Date(s.cycleMonth + 'T12:00:00').getTime();
              if (cycleTime > monthEnd) return false;
            }

            // 2. Data de desligamento (resignation)
            const leftTime = s.leftAt ? new Date(s.leftAt).getTime() : null;
            if (leftTime && leftTime < monthStart) return false;

            // Se o funcionário estiver marcado como inativo e não possuir data leftAt explícita,
            // não o listamos como ativo no mês selecionado.
            if (s.active === false && !leftTime) {
              return false;
            }

            return true;
          });
        }
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
  }, [ambassadors, proSectors, proStaff, selectedMonth]);

  const getChartData = (unit: Unit) => {
    return Object.values(stats[unit].sectors)
      .sort((a, b) => b.percent - a.percent)
      .filter(s => s.count > 0 || s.totalStaff > 5)
      .slice(0, 15);
  };

  return { stats, getChartData };
};
