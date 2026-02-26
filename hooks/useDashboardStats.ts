
import { useMemo } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User } from '../types';

export const useDashboardStats = (
  studies: BibleStudy[],
  classes: BibleClass[],
  groups: SmallGroup[],
  visits: StaffVisit[],
  currentUser: User
) => {
  
  // 1. Dados Históricos Completos
  const userStudies = useMemo(() => (studies || []).filter(s => s && s.userId === currentUser?.id), [studies, currentUser]);
  const userClasses = useMemo(() => (classes || []).filter(c => c && c.userId === currentUser?.id), [classes, currentUser]);
  const userGroups = useMemo(() => (groups || []).filter(g => g && g.userId === currentUser?.id), [groups, currentUser]);
  const userVisits = useMemo(() => (visits || []).filter(v => v && v.userId === currentUser?.id), [visits, currentUser]);

  // 2. Lógica de Retornos
  const { pendingReturns, todaysReturns } = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const normalizeString = (str: string) => {
      if (!str) return '';
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    };

    const pending = userVisits.filter(v => {
      if (!v.requiresReturn) return false;
      const vDate = new Date(v.date).getTime();
      const hasSubsequent = visits.some(allV => 
        normalizeString(allV.staffName) === normalizeString(v.staffName) && 
        new Date(allV.date).getTime() > vDate
      );
      return !hasSubsequent;
    });

    const todays = pending.filter(v => v.returnDate === todayStr);
    
    return { pendingReturns: pending, todaysReturns: todays };
  }, [userVisits, visits]);

  // 3. Filtros e Cálculos Mensais
  const { monthlyStudies, monthlyClasses, monthlyGroups, monthlyVisits, uniqueStudentsMonth, monthName } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const mName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(now);

    const isCurrentMonth = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr + 'T12:00:00');
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    };

    const mStudies = userStudies.filter(s => isCurrentMonth(s.date));
    const mClasses = userClasses.filter(c => isCurrentMonth(c.date));
    const mGroups = userGroups.filter(g => isCurrentMonth(g.date));
    const mVisits = userVisits.filter(v => isCurrentMonth(v.date));

    const uStudents = new Set<string>();
    mStudies.forEach(s => { if (s.name) uStudents.add(s.name.trim().toLowerCase()); });
    mClasses.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(name => { if (name) uStudents.add(name.trim().toLowerCase()); }); });

    return {
      monthlyStudies: mStudies,
      monthlyClasses: mClasses,
      monthlyGroups: mGroups,
      monthlyVisits: mVisits,
      uniqueStudentsMonth: uStudents,
      monthName: mName
    };
  }, [userStudies, userClasses, userGroups, userVisits]);

  // 4. Impacto Global
  const globalImpact = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const prevMonthDate = new Date();
    prevMonthDate.setMonth(now.getMonth() - 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    const getMonthStats = (m: number, y: number) => {
      const filterFn = (item: any) => {
        const d = new Date(item.date + 'T12:00:00');
        return d.getMonth() === m && d.getFullYear() === y;
      };
      
      const mS = (studies || []).filter(filterFn);
      const mC = (classes || []).filter(filterFn);
      const mG = (groups || []).filter(filterFn);
      const mV = (visits || []).filter(filterFn);
      
      const uS = new Set<string>();
      mS.forEach(s => { if (s.name) uS.add(s.name.trim().toLowerCase()); });
      mC.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => uS.add(n.trim().toLowerCase())); });
      
      return { 
        students: uS.size, 
        studies: mS.length, 
        classes: mC.length, 
        groups: mG.length, 
        visits: mV.length, 
        total: mS.length + mC.length + mG.length + mV.length 
      };
    };

    const curr = getMonthStats(currentMonth, currentYear);
    const prev = getMonthStats(prevMonth, prevYear);
    const diff = curr.total - prev.total;
    const pct = prev.total > 0 ? Math.round((diff / prev.total) * 100) : (curr.total > 0 ? 100 : 0);
    
    const chartData = [
      { name: 'Alunos', anterior: prev.students, atual: curr.students },
      { name: 'Estudos', anterior: prev.studies, atual: curr.studies },
      { name: 'Classes', anterior: prev.classes, atual: curr.classes },
      { name: 'PGs', anterior: prev.groups, atual: curr.groups },
      { name: 'Visitas', anterior: prev.visits, atual: curr.visits },
    ];
    return { chartData, pct, isUp: diff >= 0 };
  }, [studies, classes, groups, visits]);

  // 5. Metas de Visitas
  const goals = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
    const isTueOrThu = dayOfWeek === 2 || dayOfWeek === 4;
    const isGabriel = currentUser?.name?.toLowerCase().includes('gabriel');
    const isIntern = currentUser?.role === 'INTERN';
    const isChaplain = currentUser?.role === 'CHAPLAIN';

    // Visitas de hoje (Contabiliza StaffVisit)
    const todayStr = now.toISOString().split('T')[0];
    const todaysVisitsCount = userVisits.filter(v => v.date === todayStr).length;

    // Visitas da semana (Segunda a Domingo)
    const startOfWeek = new Date(now);
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajusta para Segunda
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const weeklyVisitsCount = userVisits.filter(v => {
      const d = new Date(v.date + 'T12:00:00');
      return d >= startOfWeek && v.unit === 'HAB';
    }).length;

    // Visitas mensais HABA
    const monthlyHABAVisitsCount = userVisits.filter(v => {
      const d = new Date(v.date + 'T12:00:00');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && v.unit === 'HABA';
    }).length;

    const activeGoals = [];

    // Regra Pr. Gabriel
    if (isGabriel) {
      if (!isTueOrThu) {
        activeGoals.push({ label: 'Meta Diária (HAB)', current: todaysVisitsCount, target: 2, type: 'daily' });
      }
      activeGoals.push({ label: 'Meta Mensal (HABA)', current: monthlyHABAVisitsCount, target: 8, type: 'monthly' });
    } else if (isIntern) {
      activeGoals.push({ label: 'Meta Semanal (HAB)', current: weeklyVisitsCount, target: 2, type: 'weekly' });
    } else if (isChaplain) {
      activeGoals.push({ label: 'Meta Diária (HAB)', current: todaysVisitsCount, target: 2, type: 'daily' });
    }

    return activeGoals;
  }, [userVisits, currentUser]);

  const totalActionsMonth = monthlyStudies.length + monthlyClasses.length + monthlyGroups.length + monthlyVisits.length;

  return {
    pendingReturns,
    todaysReturns,
    monthlyStudies,
    monthlyClasses,
    monthlyGroups,
    monthlyVisits,
    uniqueStudentsMonth,
    totalActionsMonth,
    globalImpact,
    monthName,
    goals
  };
};
