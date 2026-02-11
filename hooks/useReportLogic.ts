
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
    const filterFn = (item: any) => {
      if (!item || !item.date) return false;
      const itemDate = item.date.split('T')[0];
      const dateMatch = itemDate >= filters.startDate && itemDate <= filters.endDate;
      const chaplainMatch = filters.selectedChaplain === 'all' || item.userId === filters.selectedChaplain;
      const itemUnit = item.unit || Unit.HAB;
      const unitMatch = filters.selectedUnit === 'all' || itemUnit === filters.selectedUnit;
      
      const isStudyOrClass = item.status !== undefined;
      const statusMatch = (filters.selectedStatus === 'all' || !isStudyOrClass) || 
                          normalizeString(item.status) === normalizeString(filters.selectedStatus);
      
      return dateMatch && chaplainMatch && unitMatch && statusMatch;
    };

    return {
      studies: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.ESTUDOS ? (studies || []).filter(filterFn) : [],
      classes: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.CLASSES ? (classes || []).filter(filterFn) : [],
      groups: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.PGS ? (groups || []).filter(filterFn) : [],
      visits: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.VISITAS ? (visits || []).filter(filterFn) : [],
    };
  }, [studies, classes, groups, visits, filters]);

  // 2. DADOS ACUMULADOS DO ANO (Ignora data de início do filtro, usa 01/01 do ano corrente)
  // Isso resolve o problema dos números "sumindo" quando muda o mês.
  const accumulatedStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    // Usa a data fim do filtro para não pegar futuro, mas começa em Jan 01
    const endOfFilter = filters.endDate; 

    const uniqueStudentsYTD = new Set<string>();

    const isYTD = (dateStr: string) => {
        const d = dateStr.split('T')[0];
        return d >= startOfYear && d <= endOfFilter;
    };

    const addUniqueName = (rawName: string) => {
      if (!rawName) return;
      const nameOnly = rawName.split(' (')[0].trim();
      uniqueStudentsYTD.add(normalizeString(nameOnly));
    };

    // Varre Estudos do Ano
    studies.forEach(s => {
        if (s.date && isYTD(s.date)) {
             // Aplica filtros de unidade/capelão se selecionados, mas ignora data inicial
             const unitMatch = filters.selectedUnit === 'all' || s.unit === filters.selectedUnit;
             const chaplainMatch = filters.selectedChaplain === 'all' || s.userId === filters.selectedChaplain;
             if (unitMatch && chaplainMatch) {
                 if (s.name) addUniqueName(s.name);
             }
        }
    });

    // Varre Classes do Ano
    classes.forEach(c => {
        if (c.date && isYTD(c.date)) {
             const unitMatch = filters.selectedUnit === 'all' || c.unit === filters.selectedUnit;
             const chaplainMatch = filters.selectedChaplain === 'all' || c.userId === filters.selectedChaplain;
             if (unitMatch && chaplainMatch) {
                 if (Array.isArray(c.students)) c.students.forEach(n => addUniqueName(n));
             }
        }
    });

    return {
        uniqueStudentsYTD: uniqueStudentsYTD.size
    };
  }, [studies, classes, filters.selectedUnit, filters.selectedChaplain, filters.endDate]);

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
      totalStudentsYTD: accumulatedStats.uniqueStudentsYTD // Total acumulado do ano
    };
  }, [filteredData, accumulatedStats]);

  return { filteredData, auditList, totalStats };
};
