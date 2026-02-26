
import { useMemo } from 'react';
import { StaffVisit, User } from '../types';

export const useVisitGoals = (userVisits: StaffVisit[], currentUser: User | null) => {
  const goals = useMemo(() => {
    if (!currentUser) return [];
    
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

  return goals;
};
