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
      [Unit.HAB]: { 
        total: 0, 
        sectors: {} as Record<string, { id: string, name: string, count: number, totalStaff: number, percent: number, hasDataIssue?: boolean }> 
      },
      [Unit.HABA]: { 
        total: 0, 
        sectors: {} as Record<string, { id: string, name: string, count: number, totalStaff: number, percent: number, hasDataIssue?: boolean }> 
      }
    };

    // CORREÇÃO BUG 2: priorizar s.cycleMonth como data de referência de competência sempre que disponível,
    // caindo para created_at apenas como fallback quando cycle_month for nulo.
    // Isso previne que reimportações posteriores excluam indevidamente colaboradores cadastrados em meses anteriores.
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
            // BUG 2: Prioriza cycleMonth, depois usa createdAt como fallback
            let referenceTime: number | null = null;
            if (s.cycleMonth) {
              referenceTime = new Date(s.cycleMonth + 'T12:00:00').getTime();
            } else if (s.createdAt) {
              referenceTime = new Date(s.createdAt).getTime();
            }

            if (referenceTime && referenceTime > monthEnd) return false;

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

    const units = [Unit.HAB, Unit.HABA];

    units.forEach(unit => {
      // CORREÇÃO BUG 3: Se o mês estiver encerrado, busca snapshot congelado na tabela proMonthlyStats (type='sector')
      // Isso mantém a consistência com o travamento gerado no módulo de fechamento (PGClosing.tsx / calculateDashboardMetrics).
      const sectorSnapshots = selectedMonth 
        ? (proMonthlyStats || []).filter(s => s.month === selectedMonth && s.unit === unit && s.type === 'sector')
        : [];

      if (sectorSnapshots.length > 0) {
        // Mês encerrado: lê os dados diretamente do snapshot congelado de pro_monthly_stats
        sectorSnapshots.forEach(snapshot => {
          const sectorIdStr = String(snapshot.targetId);
          // Tenta casar pelo id usando proSectors como fonte do nome
          const sector = proSectors.find(s => String(s.id) === sectorIdStr);

          const totalStaff = snapshot.totalStaff;
          const count = snapshot.totalParticipants;
          const percent = snapshot.percentage;

          dataByUnit[unit].sectors[sectorIdStr] = {
            id: sectorIdStr,
            name: sector ? sector.name : `Setor ${sectorIdStr} (Inativo / Renomeado)`,
            count: count,
            totalStaff: totalStaff,
            percent: percent,
            hasDataIssue: totalStaff === 0 ? true : undefined
          };
          
          dataByUnit[unit].total += count;
        });
      } else {
        // Mês em aberto: Cálculo dinâmico clássico com proteção
        const currentStaffList = unit === Unit.HAB ? staffHAB : staffHABA;

        proSectors.forEach(sector => {
          if (sector.unit !== unit) return;
          const sectorIdStr = String(sector.id);
          const staffInSector = currentStaffList.filter(s => String(s.sectorId) === sectorIdStr).length;

          // CORREÇÃO BUG 1: Remove o fallback "|| 1" que mascarava totalStaff = 0 como se fosse 1.
          // Setores com totalStaff = 0 são sinalizados com hasDataIssue: true para destaque na UI.
          dataByUnit[unit].sectors[sectorIdStr] = {
            id: sectorIdStr,
            name: sector.name,
            count: 0,
            totalStaff: staffInSector,
            percent: 0,
            hasDataIssue: staffInSector === 0 ? true : undefined
          };
        });

        // Conta os embaixadores ativos dinamicamente
        ambassadors.forEach(amb => {
          if (amb.unit !== unit) return;
          const ambSectorIdStr = amb.sectorId ? String(amb.sectorId) : null;
          if (ambSectorIdStr && dataByUnit[unit].sectors[ambSectorIdStr]) {
            dataByUnit[unit].sectors[ambSectorIdStr].count++;
            dataByUnit[unit].total++;
          }
        });

        // CORREÇÃO BUG 1: Tratar divisão por zero explicitamente no cálculo da porcentagem dinâmica
        Object.values(dataByUnit[unit].sectors).forEach(s => {
          s.percent = s.totalStaff > 0 ? (s.count / s.totalStaff) * 100 : 0;
        });
      }
    });

    return dataByUnit;
  }, [ambassadors, proSectors, proStaff, proMonthlyStats, selectedMonth]); // Adicionado proMonthlyStats nas dependências do useMemo

  const getChartData = (unit: Unit) => {
    return Object.values(stats[unit].sectors)
      .sort((a, b) => b.percent - a.percent)
      .filter(s => s.count > 0 || s.totalStaff > 5)
      .slice(0, 15);
  };

  return { stats, getChartData };
};
