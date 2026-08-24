
import { useMemo } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, Unit, RecordStatus, ActivityFilter, User, ParticipantType } from '../types';
import { normalizeString, cleanID, countUniqueClasses, getStudentKey } from '../utils/formatters';

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

  // 2. CÁLCULO DE MÉDIA MENSAL (dentro do período/filtros selecionados)
  // Calcula a média de alunos únicos atendidos por mês, considerando apenas os meses
  // que tiveram registros dentro do período e demais filtros já aplicados em filteredData.
  const averageStats = useMemo(() => {
    const monthlyUnique = new Map<string, Set<string>>();

    const addMonthlyName = (dateStr: string, rawName: string, explicitId?: string | number | null) => {
      if (!rawName || !dateStr) return;
      // Meio-dia evita que o fuso horário empurre datas no dia 1º para o mês anterior.
      const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
      if (isNaN(d.getTime())) return;

      const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!monthlyUnique.has(monthKey)) monthlyUnique.set(monthKey, new Set());
      const key = getStudentKey(rawName, explicitId);
      if (key) monthlyUnique.get(monthKey)!.add(key);
    };

    // Estudos individuais têm staffId/participantId reais em colunas próprias — usa isso como
    // chave em vez do nome (que pode não ter "(ID)", ex: pacientes digitados só como "Socorro").
    filteredData.studies.forEach(s => addMonthlyName(s.date, s.name, (s as any).staffId || (s as any).participantId));
    // c.students (bible_class_attendees) e c.adventistStudents (bible_class_adventists) são
    // tabelas separadas -- adventista nunca aparece em c.students, não precisa filtrar aqui.
    filteredData.classes.forEach(c => {
      if (Array.isArray(c.students)) c.students.forEach(n => addMonthlyName(c.date!, n));
    });

    // Conta quantos meses (dentro do filtro) tiveram atividade (registros de alunos)
    const activeMonthsCount = monthlyUnique.size;

    // Soma os totais de cada mês ativo
    let totalMonthlySum = 0;
    monthlyUnique.forEach(set => {
      totalMonthlySum += set.size;
    });

    // A média é a soma dos mensais dividida pelo número de meses ATIVOS
    const average = activeMonthsCount > 0 ? totalMonthlySum / activeMonthsCount : 0;

    return {
      averageStudents: Number(average.toFixed(1)),
      activeMonthsCount
    };
  }, [filteredData]);

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
    // Contagem de alunos do PERÍODO SELECIONADO (estudos individuais + classes, sem repetir)
    const uniqueStudentsPeriod = new Set<string>();
    // Contagem de alunos ÚNICOS só de estudos individuais (sem classes) — para o card
    // "Estudos Bíblicos Individuais". A contagem de SESSÕES (com repetição) continua em
    // `studies` abaixo, usada no ranking por capelão e nos relatórios exportados.
    const uniqueIndividualStudents = new Set<string>();
    const addUniqueName = (rawName: string, explicitId?: string | number | null) => {
      const key = getStudentKey(rawName, explicitId);
      if (key) uniqueStudentsPeriod.add(key);
      return key;
    };
    // Contagem separada de Pacientes e Prestadores -- só informativo (pra saber a composição do
    // total de alunos), eles continuam somando normalmente em uniqueStudentsPeriod acima.
    const uniquePatientStudents = new Set<string>();
    const uniqueProviderStudents = new Set<string>();

    filteredData.studies.forEach(s => {
      if (!s.name) return;
      // Mesma razão do addMonthlyName acima: prioriza staffId/participantId reais.
      const key = addUniqueName(s.name, (s as any).staffId || (s as any).participantId);
      if (key) {
        uniqueIndividualStudents.add(key);
        if (s.participantType === ParticipantType.PATIENT) uniquePatientStudents.add(key);
        else if (s.participantType === ParticipantType.PROVIDER) uniqueProviderStudents.add(key);
      }
    });
    filteredData.classes.forEach(c => {
      if (!Array.isArray(c.students)) return;
      c.students.forEach(n => {
        const key = addUniqueName(n);
        if (!key) return;
        if (c.participantType === ParticipantType.PATIENT) uniquePatientStudents.add(key);
        else if (c.participantType === ParticipantType.PROVIDER) uniqueProviderStudents.add(key);
      });
    });

    // Adventistas vivem em tabela própria (bible_class_adventists) -- nunca entram no total de
    // alunos acima; contados aqui à parte, pro relatório separado "Adventistas em Classes".
    const uniqueAdventistStudents = new Set<string>();
    let adventistAttendances = 0;
    filteredData.classes.forEach(c => {
      (c.adventistStudents || []).forEach(n => {
        adventistAttendances++;
        const key = getStudentKey(n);
        if (key) uniqueAdventistStudents.add(key);
      });
    });

    return {
      studies: filteredData.studies.length,
      uniqueIndividualStudents: uniqueIndividualStudents.size,
      classes: countUniqueClasses(filteredData.classes),
      groups: filteredData.groups.length,
      visits: filteredData.visits.length,
      totalStudentsPeriod: uniqueStudentsPeriod.size,
      averageStudentsMonthly: averageStats.averageStudents,
      averageActiveMonths: averageStats.activeMonthsCount,
      adventistUniqueStudents: uniqueAdventistStudents.size,
      adventistAttendances,
      patientStudents: uniquePatientStudents.size,
      providerStudents: uniqueProviderStudents.size
    };
  }, [filteredData, averageStats]);

  return { filteredData, auditList, totalStats };
};
