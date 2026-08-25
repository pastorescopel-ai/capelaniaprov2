
import { useMemo } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User } from '../types';
import { useVisitGoals } from './useVisitGoals';
import { countUniqueClasses, countUniqueStudents, getStudentKey } from '../utils/formatters';

export type GlobalImpactComparisonMode = 'previousMonth' | 'sameMonthLastYear' | 'average';

export const useDashboardStats = (
  studies: BibleStudy[],
  classes: BibleClass[],
  groups: SmallGroup[],
  visits: StaffVisit[],
  currentUser: User,
  proMonthlyStats: any[] = [],
  selectedMonth?: string,
  comparisonMode: GlobalImpactComparisonMode = 'previousMonth',
  averageMonths: string[] = []
) => {
  
  // 1. Dados Históricos Completos
  const userStudies = useMemo(() => (studies || []).filter(s => s && s.userId === currentUser?.id), [studies, currentUser]);
  const userClasses = useMemo(() => (classes || []).filter(c => c && c.userId === currentUser?.id), [classes, currentUser]);
  const userGroups = useMemo(() => (groups || []).filter(g => g && g.userId === currentUser?.id), [groups, currentUser]);
  const userVisits = useMemo(() => (visits || []).filter(v => v && v.userId === currentUser?.id), [visits, currentUser]);

  // 2. Lógica de Retornos
  const { pendingReturns, todaysReturns } = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const normalizeString = (str: string) => {
      if (!str) return '';
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    };

    const pending = userVisits.filter(v => {
      if (!v.requiresReturn) return false;
      const vDate = new Date(v.date).getTime();
      const hasSubsequent = visits.some(allV => {
        if (allV.id === v.id) return false;
        
        // ID-BASED LINKING
        if (v.staffId && allV.staffId) {
          return allV.staffId === v.staffId && new Date(allV.date).getTime() >= vDate;
        }
        if (v.providerId && allV.providerId) {
          return allV.providerId === v.providerId && new Date(allV.date).getTime() >= vDate;
        }

        // Fallback to name
        return normalizeString(allV.staffName) === normalizeString(v.staffName) && 
               new Date(allV.date).getTime() >= vDate;
      });
      return !hasSubsequent;
    });

    const todays = pending.filter(v => {
      if (!v.returnDate) return false;
      const vReturn = typeof v.returnDate === 'number' ? new Date(v.returnDate).toLocaleDateString('en-CA') : String(v.returnDate).split('T')[0];
      return vReturn === todayStr;
    });
    
    return { pendingReturns: pending, todaysReturns: todays };
  }, [userVisits, visits]);

  // 3. Filtros e Cálculos Mensais
  const { monthlyStudies, monthlyClasses, monthlyGroups, monthlyVisits, uniqueStudentsMonth, monthlyStudiesUniqueCount, adventistStudentsMonth, monthName } = useMemo(() => {
    const now = selectedMonth ? new Date(selectedMonth + 'T12:00:00') : new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const mName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(now);

    // NOTA: não existe (nem deveria existir aqui) um snapshot type:'summary' — o único snapshot
    // gravado no fechamento (type:'pg'/targetId:'all', ver getMonthStatsFromSnapshot abaixo) é
    // um agregado de TODOS os capelães da unidade, e esse bloco é "meu impacto" (só do capelão
    // logado) — usar aquele agregado aqui mostraria os números de todo mundo como se fossem só
    // do usuário. Então isso cai (corretamente) sempre pro cálculo ao vivo, filtrando cada
    // registro pela própria data — o que é seguro mesmo para meses passados.
    const monthISO = selectedMonth || `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const snapshot = proMonthlyStats.find(s => s.month === monthISO && s.type === 'summary');

    if (snapshot && snapshot.snapshotData) {
      const metrics = snapshot.snapshotData.performanceMetrics;
      return {
        monthlyStudies: Array(metrics.totalBibleStudies || 0).fill({}),
        monthlyClasses: Array(metrics.totalBibleClasses || 0).fill({}),
        monthlyGroups: Array(metrics.totalSmallGroups || 0).fill({}),
        monthlyVisits: Array(metrics.totalStaffVisits || 0).fill({}),
        uniqueStudentsMonth: new Set(Array(metrics.totalUniqueStudents || 0).fill(0).map((_, i) => i.toString())),
        // Meses já fechados não guardam "alunos únicos SÓ de Estudo Bíblico" separado de Classe
        // -- só o combinado (totalUniqueStudents). Usa esse combinado como aproximação aqui (é
        // sempre <= totalBibleStudies, então pelo menos nunca fica pior que a contagem de sessões).
        monthlyStudiesUniqueCount: metrics.totalUniqueStudents || 0,
        adventistStudentsMonth: new Set<string>(),
        monthName: mName
      };
    }

    const isCurrentMonth = (val: any) => {
      if (!val) return false;
      const dateStr = typeof val === 'number' ? new Date(val).toLocaleDateString('en-CA') : String(val);
      const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    };

    const mStudies = userStudies.filter(s => isCurrentMonth(s.date));
    const mClasses = userClasses.filter(c => isCurrentMonth(c.date));
    const mGroups = userGroups.filter(g => isCurrentMonth(g.date));
    const mVisits = userVisits.filter(v => isCurrentMonth(v.date));

    // Adventistas vivem em tabela própria (bible_class_adventists) -- c.students nunca inclui
    // eles, então não contam como "aluno" aqui automaticamente. Contados à parte (c.adventistStudents)
    // pro card "Adventistas em Classes" do Dashboard.
    const uStudents = new Set<string>();
    const adventists = new Set<string>();
    mStudies.forEach(s => { const key = getStudentKey(s.name, (s as any).staffId || (s as any).participantId); if (key) uStudents.add(key); });
    mClasses.forEach(c => {
      if (Array.isArray(c.students)) c.students.forEach(name => { const key = getStudentKey(name); if (key) uStudents.add(key); });
      (c.adventistStudents || []).forEach(name => { const key = getStudentKey(name); if (key) adventists.add(key); });
    });

    return {
      monthlyStudies: mStudies,
      monthlyClasses: mClasses,
      monthlyGroups: mGroups,
      monthlyVisits: mVisits,
      uniqueStudentsMonth: uStudents,
      // "Estudos Bíblicos" no Mural conta alunos únicos, não sessões -- dar 3 estudos pro mesmo
      // aluno no mês conta como 1 (mesma regra usada no formulário de Estudo Bíblico).
      monthlyStudiesUniqueCount: countUniqueStudents(mStudies),
      adventistStudentsMonth: adventists,
      monthName: mName
    };
  }, [userStudies, userClasses, userGroups, userVisits, selectedMonth, proMonthlyStats]);


  // 4. Impacto Global
  const globalImpact = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Fora da janela "ao vivo" (dados recentes já carregados), usamos o snapshot mensal
    // já consolidado (soma de todas as unidades) em vez de tentar filtrar arrays que
    // podem não ter mais aquele mês carregado.
    const getMonthStatsFromSnapshot = (monthISO: string) => {
      const snaps = (proMonthlyStats || []).filter(s => s.type === 'pg' && s.targetId === 'all' && s.month?.startsWith(monthISO));
      if (snaps.length === 0) return null;

      const totals = { students: 0, studies: 0, classes: 0, groups: 0, visits: 0, total: 0 };
      snaps.forEach(s => {
        const m = s.snapshotData?.performanceMetrics;
        if (!m) return;
        totals.students += m.totalUniqueStudents || 0;
        totals.studies += m.totalBibleStudies || 0;
        totals.classes += m.totalBibleClasses || 0;
        totals.groups += m.totalSmallGroups || 0;
        totals.visits += m.totalStaffVisits || 0;
      });
      totals.total = totals.studies + totals.classes + totals.groups + totals.visits;
      return totals;
    };

    const getMonthStatsFromLiveData = (m: number, y: number) => {
      const filterFn = (item: any) => {
        if (!item.date) return false;
        const dateStr = typeof item.date === 'number' ? new Date(item.date).toLocaleDateString('en-CA') : String(item.date);
        const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
        return d.getMonth() === m && d.getFullYear() === y;
      };

      const mS = (studies || []).filter(filterFn);
      const mC = (classes || []).filter(filterFn);
      const mG = (groups || []).filter(filterFn);
      const mV = (visits || []).filter(filterFn);

      const uniqueClasses = countUniqueClasses(mC);

      const uS = new Set<string>();
      mS.forEach(s => { const key = getStudentKey(s.name, (s as any).staffId || (s as any).participantId); if (key) uS.add(key); });
      mC.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => { const key = getStudentKey(n); if (key) uS.add(key); }); });

      return {
        students: uS.size,
        studies: countUniqueStudents(mS),
        classes: uniqueClasses,
        groups: mG.length,
        visits: mV.length,
        total: mS.length + uniqueClasses + mG.length + mV.length
      };
    };

    // Mês corrente (ainda em andamento) sempre usa dados ao vivo; meses fechados
    // preferem o snapshot consolidado, caindo para os dados ao vivo se não houver snapshot.
    const getMonthStats = (m: number, y: number) => {
      const isLiveMonth = m === currentMonth && y === currentYear;
      if (!isLiveMonth) {
        const monthISO = `${y}-${String(m + 1).padStart(2, '0')}`;
        const snap = getMonthStatsFromSnapshot(monthISO);
        if (snap) return snap;
      }
      return getMonthStatsFromLiveData(m, y);
    };

    const curr = getMonthStats(currentMonth, currentYear);

    let comparison: ReturnType<typeof getMonthStats>;
    let comparisonLabel: string;

    if (comparisonMode === 'sameMonthLastYear') {
      comparison = getMonthStats(currentMonth, currentYear - 1);
      comparisonLabel = 'Mesmo Mês Ano Passado';
    } else if (comparisonMode === 'average' && averageMonths.length > 0) {
      const allStats = averageMonths.map(monthStr => {
        const [y, m] = monthStr.split('-').map(Number);
        return getMonthStats(m - 1, y);
      });
      const n = allStats.length;
      const sum = (key: 'students' | 'studies' | 'classes' | 'groups' | 'visits') =>
        Math.round(allStats.reduce((acc, s) => acc + s[key], 0) / n);
      comparison = {
        students: sum('students'),
        studies: sum('studies'),
        classes: sum('classes'),
        groups: sum('groups'),
        visits: sum('visits'),
        total: 0
      };
      comparison.total = comparison.studies + comparison.classes + comparison.groups + comparison.visits;
      comparisonLabel = 'Média Selecionada';
    } else {
      const prevMonthDate = new Date();
      prevMonthDate.setMonth(now.getMonth() - 1);
      comparison = getMonthStats(prevMonthDate.getMonth(), prevMonthDate.getFullYear());
      comparisonLabel = 'Mês Anterior';
    }

    const diff = curr.total - comparison.total;
    const pct = comparison.total > 0 ? Math.round((diff / comparison.total) * 100) : (curr.total > 0 ? 100 : 0);

    const chartData = [
      { name: 'Alunos', anterior: comparison.students, atual: curr.students },
      { name: 'Estudos', anterior: comparison.studies, atual: curr.studies },
      { name: 'Classes', anterior: comparison.classes, atual: curr.classes },
      { name: 'PGs', anterior: comparison.groups, atual: curr.groups },
      { name: 'Visitas', anterior: comparison.visits, atual: curr.visits },
    ];
    return { chartData, pct, isUp: diff >= 0, comparisonLabel };
  }, [studies, classes, groups, visits, proMonthlyStats, comparisonMode, averageMonths]);

  // 5. Metas de Visitas
  const { goals, accumulated } = useVisitGoals(userVisits, currentUser);

  const totalActionsMonth = monthlyStudies.length + monthlyClasses.length + monthlyGroups.length + monthlyVisits.length;
 
   return {
     pendingReturns,
     todaysReturns,
     monthlyStudies,
     monthlyClasses,
     monthlyGroups,
     monthlyVisits,
     uniqueStudentsMonth,
     monthlyStudiesUniqueCount,
     adventistStudentsMonth,
     totalActionsMonth,
     globalImpact,
     monthName,
     goals,
     accumulated
   };
 };
