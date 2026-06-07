
import { useMemo } from 'react';
import { StaffVisit, User } from '../types';

export const useVisitGoals = (userVisits: StaffVisit[], currentUser: User | null) => {
  return useMemo(() => {
    if (!currentUser) return { goals: [], accumulated: null };

    // Obter as metas dinâmicas do usuário (com defaults resilientes)
    const dailyGoalVal = currentUser.dailyVisitGoal ?? 2;
    const monthlyHABAGoalVal = currentUser.subunitMonthlyVisitGoal ?? 8;
    const goalPeriod = currentUser.visitGoalPeriod ?? 'daily';
    
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
    const isHabaChaplain = currentUser?.attendsHaba === true;
    const habaDays = currentUser?.habaDays || [];
    const isHabaDay = isHabaChaplain && habaDays.includes(dayOfWeek);
    const isIntern = currentUser?.role === 'INTERN';

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

    // Regra de Metas e Exibição baseada em Período/HABA
    if (isHabaChaplain) {
      if (!isHabaDay) {
        if (goalPeriod === 'weekly') {
          activeGoals.push({ label: 'Meta Semanal (HAB)', current: weeklyVisitsCount, target: dailyGoalVal, type: 'weekly' });
        } else {
          activeGoals.push({ label: 'Meta Diária (HAB)', current: todaysVisitsCount, target: dailyGoalVal, type: 'daily' });
        }
      }
      activeGoals.push({ label: 'Meta Mensal (HABA)', current: monthlyHABAVisitsCount, target: monthlyHABAGoalVal, type: 'monthly' });
    } else if (goalPeriod === 'weekly' || isIntern) {
      activeGoals.push({ label: 'Meta Semanal (HAB)', current: weeklyVisitsCount, target: dailyGoalVal, type: 'weekly' });
    } else {
      activeGoals.push({ label: 'Meta Diária (HAB)', current: todaysVisitsCount, target: dailyGoalVal, type: 'daily' });
    }

    // --- LÓGICA DE ACÚMULO (BACKLOG DE VISITAS) ---
    const getWorkingDays = (startDate: Date, endDate: Date) => {
      let count = 0;
      const curDate = new Date(startDate.getTime());
      while (curDate <= endDate) {
        const dWeek = curDate.getDay();
        if (dWeek !== 0 && dWeek !== 6) count++;
        curDate.setDate(curDate.getDate() + 1);
      }
      return count;
    };

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const workingDaysSoFar = getWorkingDays(startOfMonth, now);
    
    let expectedVisits = 0;
    
    if (isHabaChaplain) {
      // Capelão HABA: metas nos dias que NÃO são de HABA
      let countNonHabaDays = 0;
      const curDate = new Date(startOfMonth.getTime());
      while (curDate <= now) {
        const dWeek = curDate.getDay();
        if (dWeek !== 0 && dWeek !== 6 && !habaDays.includes(dWeek)) countNonHabaDays++;
        curDate.setDate(curDate.getDate() + 1);
      }
      if (goalPeriod === 'weekly') {
        const currentWeekNumber = Math.ceil(now.getDate() / 7);
        expectedVisits = currentWeekNumber * dailyGoalVal;
      } else {
        expectedVisits = countNonHabaDays * dailyGoalVal;
      }
    } else if (goalPeriod === 'weekly' || isIntern) {
      // Semanal: dailyGoalVal visitas por semana
      expectedVisits = Math.ceil(now.getDate() / 7) * dailyGoalVal;
    } else {
      // Diário: dailyGoalVal visitas por dia útil (Seg-Sex)
      expectedVisits = workingDaysSoFar * dailyGoalVal;
    }
    
    // Visitas feitas no mês atual (apenas HAB para a meta diária/semanal padrão)
    const monthlyVisitsCount = userVisits.filter(v => {
      const d = new Date(v.date + 'T12:00:00');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && v.unit === 'HAB';
    }).length;

    const deficit = expectedVisits - monthlyVisitsCount;
    const historicalTotal = userVisits.length;

    const accumulated = {
      expected: expectedVisits,
      current: monthlyVisitsCount,
      deficit: deficit,
      historicalTotal: historicalTotal,
      status: deficit <= 0 ? 'success' : deficit <= (dailyGoalVal * 2) ? 'warning' : 'critical'
    };

    return { goals: activeGoals, accumulated };
  }, [userVisits, currentUser]);
};
