
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

  // 2. CÁLCULO DE MÉDIA ANUAL (ano corrente inteiro, independente do período no calendário)
  // A pedido do usuário: esse card não deve depender do filtro de data de Relatórios -- é
  // sempre "total de alunos únicos do ano até agora" dividido pela quantidade de meses do ano
  // já decorridos (ex: em agosto, divide por 8), não uma média dos totais mês a mês (que
  // contaria o mesmo aluno de novo a cada mês em que ele aparecesse). Continua respeitando os
  // filtros de Capelão e Unidade (faz sentido ver a média anual só de um capelão/unidade), só
  // não o de período.
  const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const averageStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const elapsedMonths = now.getMonth() + 1; // Jan = 1 ... dependendo do mês atual

    const isChaplainMatch = (userId: string) =>
      filters.selectedChaplain === 'all' || userId === filters.selectedChaplain;
    const isUnitMatch = (unit?: Unit) =>
      filters.selectedUnit === 'all' || (unit || Unit.HAB) === filters.selectedUnit;

    const yearStudents = new Set<string>();
    const monthlyUnique = new Map<string, Set<string>>();

    const addYearName = (dateStr: string, rawName: string, explicitId?: string | number | null) => {
      if (!rawName || !dateStr) return;
      // Meio-dia evita que o fuso horário empurre datas no dia 1º para o mês anterior.
      const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
      if (isNaN(d.getTime()) || d.getFullYear() !== currentYear) return;

      const key = getStudentKey(rawName, explicitId);
      if (!key) return;
      yearStudents.add(key);

      const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!monthlyUnique.has(monthKey)) monthlyUnique.set(monthKey, new Set());
      monthlyUnique.get(monthKey)!.add(key);
    };

    // Usa (studies/classes) sem filtro de data/atividade -- só Capelão/Unidade -- pra não
    // depender do período escolhido no calendário de Relatórios.
    // Estudos individuais têm staffId/participantId reais em colunas próprias — usa isso como
    // chave em vez do nome (que pode não ter "(ID)", ex: pacientes digitados só como "Socorro").
    (studies || [])
      .filter(s => isChaplainMatch(s.userId) && isUnitMatch(s.unit))
      .forEach(s => addYearName(s.date, s.name, (s as any).staffId || (s as any).participantId));
    // c.students (bible_class_attendees) e c.adventistStudents (bible_class_adventists) são
    // tabelas separadas -- adventista nunca aparece em c.students, não precisa filtrar aqui.
    (classes || [])
      .filter(c => isChaplainMatch(c.userId) && isUnitMatch(c.unit))
      .forEach(c => {
        if (Array.isArray(c.students)) c.students.forEach(n => addYearName(c.date!, n));
      });

    // Total de alunos únicos no ano inteiro (não soma dos meses -- um aluno visto em 2 meses
    // diferentes conta 1 vez aqui) dividido pelos meses do ano já decorridos até hoje.
    const average = elapsedMonths > 0 ? yearStudents.size / elapsedMonths : 0;

    // Detalhe pro card clicável "Média de Alunos (Mensal)" -- não tem uma lista de nomes fixa
    // (é uma média entre vários meses), então mostra a composição mês a mês em vez de nomes.
    const monthlyBreakdown = Array.from(monthlyUnique.entries())
      .map(([key, set]) => {
        const [year, month] = key.split('-').map(Number);
        return { label: `${MONTH_NAMES[month - 1]} de ${year}`, count: set.size, sortKey: year * 100 + month };
      })
      .sort((a, b) => b.sortKey - a.sortKey);

    return {
      averageStudents: Number(average.toFixed(1)),
      activeMonthsCount: elapsedMonths,
      monthlyBreakdown
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
    // Mapas (não Sets) pra guardar tanto a chave de dedupe quanto um nome de exibição --
    // alimenta os cards clicáveis de Relatórios que abrem a lista de nomes por trás do número.
    const displayName = (raw: string) => raw.split(' (')[0].trim();

    const allStudents = new Map<string, string>();
    const individualStudents = new Map<string, string>();
    const patientStudents = new Map<string, string>();
    const providerStudents = new Map<string, string>();
    const adventistStudents = new Map<string, string>();

    const addName = (map: Map<string, string>, rawName: string, explicitId?: string | number | null) => {
      const key = getStudentKey(rawName, explicitId);
      if (key) map.set(key, displayName(rawName));
      return key;
    };

    filteredData.studies.forEach(s => {
      if (!s.name) return;
      const explicitId = (s as any).staffId || (s as any).participantId;
      const key = addName(allStudents, s.name, explicitId);
      if (!key) return;
      addName(individualStudents, s.name, explicitId);
      if (s.participantType === ParticipantType.PATIENT) addName(patientStudents, s.name, explicitId);
      else if (s.participantType === ParticipantType.PROVIDER) addName(providerStudents, s.name, explicitId);
    });
    filteredData.classes.forEach(c => {
      if (!Array.isArray(c.students)) return;
      c.students.forEach(n => {
        const key = addName(allStudents, n);
        if (!key) return;
        if (c.participantType === ParticipantType.PATIENT) addName(patientStudents, n);
        else if (c.participantType === ParticipantType.PROVIDER) addName(providerStudents, n);
      });
    });

    // Adventistas vivem em tabela própria (bible_class_adventists) -- nunca entram no total de
    // alunos acima; contados aqui à parte, pro relatório separado "Adventistas em Classes".
    let adventistAttendances = 0;
    filteredData.classes.forEach(c => {
      (c.adventistStudents || []).forEach(n => {
        adventistAttendances++;
        addName(adventistStudents, n);
      });
    });

    const sortedNames = (map: Map<string, string>) => Array.from(map.values()).sort((a, b) => a.localeCompare(b));

    return {
      studies: filteredData.studies.length,
      uniqueIndividualStudents: individualStudents.size,
      classes: countUniqueClasses(filteredData.classes),
      groups: filteredData.groups.length,
      visits: filteredData.visits.length,
      totalStudentsPeriod: allStudents.size,
      averageStudentsMonthly: averageStats.averageStudents,
      averageActiveMonths: averageStats.activeMonthsCount,
      adventistUniqueStudents: adventistStudents.size,
      adventistAttendances,
      patientStudents: patientStudents.size,
      providerStudents: providerStudents.size,
      // Listas de nomes por trás de cada número -- usadas pelos cards clicáveis em Relatórios.
      details: {
        allStudentNames: sortedNames(allStudents),
        individualStudentNames: sortedNames(individualStudents),
        patientStudentNames: sortedNames(patientStudents),
        providerStudentNames: sortedNames(providerStudents),
        adventistStudentNames: sortedNames(adventistStudents),
        monthlyBreakdown: averageStats.monthlyBreakdown,
        classSessions: [...filteredData.classes]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map(c => ({ label: c.guide || 'Classe Bíblica', sector: c.sector || 'Sem setor', date: c.date, studentsCount: (c.students || []).length })),
        visitRecords: [...filteredData.visits]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map(v => ({ label: v.staffName, sector: v.sector || '', date: v.date }))
      }
    };
  }, [filteredData, averageStats]);

  return { filteredData, auditList, totalStats };
};
