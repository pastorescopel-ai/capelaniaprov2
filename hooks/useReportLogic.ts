
import { useMemo } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, Unit, RecordStatus, ActivityFilter, User } from '../types';

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
  const filteredData = useMemo(() => {
    const filterFn = (item: any) => {
      if (!item || !item.date) return false;
      const itemDate = item.date.split('T')[0];
      const dateMatch = itemDate >= filters.startDate && itemDate <= filters.endDate;
      const chaplainMatch = filters.selectedChaplain === 'all' || item.userId === filters.selectedChaplain;
      const itemUnit = item.unit || Unit.HAB;
      const unitMatch = filters.selectedUnit === 'all' || itemUnit === filters.selectedUnit;
      
      const isStudyOrClass = item.status !== undefined;
      const statusMatch = (filters.selectedStatus === 'all' || !isStudyOrClass) || item.status === filters.selectedStatus;
      
      return dateMatch && chaplainMatch && unitMatch && statusMatch;
    };

    return {
      studies: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.ESTUDOS ? (studies || []).filter(filterFn) : [],
      classes: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.CLASSES ? (classes || []).filter(filterFn) : [],
      groups: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.PGS ? (groups || []).filter(filterFn) : [],
      visits: filters.selectedActivity === ActivityFilter.TODAS || filters.selectedActivity === ActivityFilter.VISITAS ? (visits || []).filter(filterFn) : [],
    };
  }, [studies, classes, groups, visits, filters]);

  const auditList = useMemo(() => {
    const list: any[] = [];
    filteredData.studies.forEach(s => {
      list.push({
        name: s.name, isClass: false, sector: s.sector, unit: s.unit, type: 'Estudo Bíblico', icon: '📖',
        chaplain: users.find(u => u.id === s.userId)?.name || 'N/I', status: s.status, date: s.date, original: s
      });
    });
    filteredData.classes.forEach(c => {
      if (Array.isArray(c.students)) {
        list.push({
          name: c.students[0] || 'Sem nomes', studentsList: c.students, isClass: true, sector: c.sector, unit: c.unit,
          type: 'Classe Bíblica', icon: '👥', chaplain: users.find(u => u.id === c.userId)?.name || 'N/I',
          status: c.status, date: c.date, original: c
        });
      }
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredData, users]);

  const totalStats = useMemo(() => {
    const uniqueStudents = new Set<string>();
    filteredData.studies.forEach(s => s.name && uniqueStudents.add(s.name.trim().toLowerCase()));
    filteredData.classes.forEach(c => Array.isArray(c.students) && c.students.forEach(n => n && uniqueStudents.add(n.trim().toLowerCase())));
    
    return {
      studies: filteredData.studies.length,
      classes: filteredData.classes.length,
      groups: filteredData.groups.length,
      visits: filteredData.visits.length,
      totalStudents: uniqueStudents.size
    };
  }, [filteredData]);

  return { filteredData, auditList, totalStats };
};
