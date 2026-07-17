
import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { User } from '../../types';
import { ClipboardCheck, ChevronRight } from 'lucide-react';

interface DailyActivitiesReminderProps {
  currentUser: User;
  onGoToTab: (tab: string, subTab?: any) => void;
}

const DailyActivitiesReminder: React.FC<DailyActivitiesReminderProps> = ({ currentUser, onGoToTab }) => {
  const { activitySchedules, dailyActivityReports, isInitialized } = useApp();

  const progressData = useMemo(() => {
    if (!isInitialized) return null;

    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const todayISO = new Date(today.getTime() - offset).toISOString().split('T')[0];
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1-7 (Mon-Sun)
    const monthStr = todayISO.substring(0, 7) + '-01';

    const scheduled = activitySchedules.filter(s =>
      s.userId === currentUser.id &&
      s.month === monthStr &&
      ((s.date && s.date.substring(0, 10) === todayISO) || (!s.date && s.dayOfWeek === dayOfWeek))
    );

    if (scheduled.length === 0) {
      return { hasSchedule: false, percent: 0, completedItems: 0, totalItems: 0 };
    }

    const report = dailyActivityReports.find(r => r.userId === currentUser.id && r.date === todayISO);

    const completedItems = scheduled.filter(s => {
      if (!report) return false;
      const period = s.period || 'tarde';
      const locWithPeriod = `${s.location}:${period}`;

      if (s.activityType === 'blueprint') {
        return report.completedBlueprints?.includes(locWithPeriod) ||
               (period === 'tarde' && report.completedBlueprints?.includes(s.location));
      }
      if (s.activityType === 'cult') {
        return report.completedCults?.includes(locWithPeriod) ||
               (period === 'tarde' && report.completedCults?.includes(s.location));
      }
      if (s.activityType === 'encontro') return report.completedEncontro;
      if (s.activityType === 'visiteCantando') return report.completedVisiteCantando;
      return false;
    }).length;

    const totalItems = scheduled.length;
    const percent = Math.round((completedItems / totalItems) * 100);

    return { hasSchedule: true, percent, completedItems, totalItems };
  }, [activitySchedules, dailyActivityReports, currentUser, isInitialized]);

  if (!progressData) return null;

  return (
    <div
      onClick={() => onGoToTab('activities', 'checklist')}
      className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-500 p-5 rounded-[2rem] shadow-lg shadow-indigo-900/10 cursor-pointer group"
    >
      <div className="absolute -right-5 -top-5 w-28 h-28 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
      <div className="absolute right-5 -bottom-8 w-16 h-16 bg-white/5 rounded-full"></div>

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ClipboardCheck size={22} className="text-white" />
          </div>
          <div>
            <h4 className="font-black text-white text-sm uppercase tracking-tight">Lançar Atividades</h4>
            <p className="text-indigo-100 font-bold text-[10px] uppercase tracking-widest mt-0.5">
              {progressData.hasSchedule ? `${progressData.completedItems} de ${progressData.totalItems} feitas hoje` : 'Registre o que fez hoje'}
            </p>
          </div>
        </div>
        <div className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center flex-shrink-0 group-hover:translate-x-1 transition-transform">
          <ChevronRight size={18} className="text-white" />
        </div>
      </div>

      {progressData.hasSchedule && (
        <>
          <div className="relative mt-4 h-1.5 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${progressData.percent}%` }}
            ></div>
          </div>
          <p className="relative mt-2 text-[10px] font-bold text-indigo-100">Toque para continuar de onde parou</p>
        </>
      )}
    </div>
  );
};

export default DailyActivitiesReminder;
