
import { useMemo } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, Unit, RecordStatus, ActivityFilter, User } from '../types';
import { normalizeString, cleanID } from '../utils/formatters';

interface ReportFilters {
  startDate: string;
  endDate: string;
  selectedChaplain: string;
  selectedUnit: 'all' | Unit;
  selectedActivity: ActivityFilter;
  selectedStatus: 'all' | RecordStatus;
}

export const useReportLogic = (
  studies: BibleStudy[],
  classes: BibleClass[],
  groups: SmallGroup[],
  visits: StaffVisit[],
  users: User[],
  filters: ReportFilters
) => {
  // 1. DADOS FILTRADOS (Respeita as datas selecionadas na UI)
  const filteredData = useMemo(() => {
    // Create filter functions outside the loop for better performance
    const isDateInRange = (dateStr: string) => {
      const d = dateStr.split('T')[0];
      return d >= filters.startDate && d <= filters.endDate;
    };

    const isChaplainMatch = (userId: string) => 
      filters.selectedChaplain === 'all' || userId === filters.selectedChaplain;

    const isUnitMatch = (unit?: Unit) => 
      filters.selectedUnit === 'all' || (unit || Unit.HAB) === filters.selectedUnit;

    const isStatusMatch = (status?: RecordStatus) => 
      filters.selectedStatus === 'all' || normalizeString(status || '') === normalizeString(filters.selectedStatus);

    const result = {
      studies: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.ESTUDOS 
        ? (studies || []).filter(s => s.date && isDateInRange(s.date) && isChaplainMatch(s.userId) && isUnitMatch(s.unit) && isStatusMatch(s.status))
        : [],
      classes: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.CLASSES 
        ? (classes || []).filter(c => c.date && isDateInRange(c.date) && isChaplainMatch(c.userId) && isUnitMatch(c.unit) && isStatusMatch(c.status))
        : [],
      groups: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.PGS 
        ? (groups || []).filter(g => g.date && isDateInRange(g.date) && isChaplainMatch(g.userId) && isUnitMatch(g.unit))
        : [],
      visits: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.VISITAS 
        ? (visits || []).filter(v => v.date && isDateInRange(v.date) && isChaplainMatch(v.userId) && isUnitMatch(v.unit))
        : [],
    };
    return result;
  }, [studies, classes, groups, visits, filters]);

  // 2. CÁLCULO DE MÉDIA MENSAL ANUAL (MÉTRICA-FIDELIDADE V2)
  // Calcula a média de alunos únicos atendidos por mês, considerando apenas os meses que tiveram registros.
  // Esta métrica ignora o filtro de data e foca no desempenho real do ano corrente.
  const averageStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const monthlyUnique = new Map<string, Set<string>>();
    
    const addMonthlyName = (dateStr: string, rawName: string) => {
      if (!rawName || !dateStr) return;
      const d = new Date(dateStr);
      if (d.getFullYear() !== currentYear) return; // Garante que é do ano atual
      
      const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!monthlyUnique.has(monthKey)) monthlyUnique.set(monthKey, new Set());
      const nameOnly = rawName.split(' (')[0].trim();
      monthlyUnique.get(monthKey)!.add(normalizeString(nameOnly));
    };

    // Varre TODO o histórico para o cálculo anual (ignora filteredData)
    studies.forEach(s => {
      const chaplainMatch = filters.selectedChaplain === 'all' || s.userId === filters.selectedChaplain;
      const unitMatch = filters.selectedUnit === 'all' || s.unit === filters.selectedUnit;
      if (chaplainMatch && unitMatch) addMonthlyName(s.date, s.name);
    });

    classes.forEach(c => {
      const chaplainMatch = filters.selectedChaplain === 'all' || c.userId === filters.selectedChaplain;
      const unitMatch = filters.selectedUnit === 'all' || c.unit === filters.selectedUnit;
      if (chaplainMatch && unitMatch && Array.isArray(c.students)) {
        c.students.forEach(n => addMonthlyName(c.date!, n));
      }
    });

    // Conta quantos meses tiveram atividade (registros de alunos)
    const activeMonthsCount = monthlyUnique.size;
    
    // Soma os totais de cada mês ativo
    let totalMonthlySum = 0;
    monthlyUnique.forEach(set => {
      totalMonthlySum += set.size;
    });

    // A média é a soma dos mensais dividida pelo número de meses ATIVOS
    const average = activeMonthsCount > 0 ? totalMonthlySum / activeMonthsCount : 0;

    return {
      averageStudents: Number(average.toFixed(1))
    };
  }, [studies, classes, filters.selectedChaplain, filters.selectedUnit]);

  const auditList = useMemo(() => {
    const list: any[] = [];
    filteredData.studies.forEach(s => {
      list.push({ name: s.name, isClass: false, sector: s.sector, unit: s.unit, type: 'Estudo Bíblico', icon: '📖', chaplain: users.find(u => u.id === s.userId)?.name || 'N/I', status: s.status, date: s.date, original: s });
    });
    filteredData.classes.forEach(c => {
      if (Array.isArray(c.students)) {
        list.push({ name: c.students[0] || 'Sem nomes', studentsList: c.students, isClass: true, sector: c.sector, unit: c.unit, type: 'Classe Bíblica', icon: '👥', chaplain: users.find(u => u.id === c.userId)?.name || 'N/I', status: c.status, date: c.date, original: c });
      }
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredData, users]);

  const totalStats = useMemo(() => {
    // Contagem de alunos do PERÍODO SELECIONADO (para comparação)
    const uniqueStudentsPeriod = new Set<string>();
    const addUniqueName = (rawName: string) => {
      if (!rawName) return;
      const nameOnly = rawName.split(' (')[0].trim();
      uniqueStudentsPeriod.add(normalizeString(nameOnly));
    };
    filteredData.studies.forEach(s => s.name && addUniqueName(s.name));
    filteredData.classes.forEach(c => {
      if (Array.isArray(c.students)) c.students.forEach(n => addUniqueName(n));
    });

    return {
      studies: filteredData.studies.length,
      classes: filteredData.classes.length,
      groups: filteredData.groups.length,
      visits: filteredData.visits.length,
      totalStudentsPeriod: uniqueStudentsPeriod.size,
      averageStudentsMonthly: averageStats.averageStudents
    };
  }, [filteredData, averageStats]);

  return { filteredData, auditList, totalStats };
};
