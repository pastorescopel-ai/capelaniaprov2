
import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { User } from '../../types';
import { ClipboardCheck, ChevronRight, Check } from 'lucide-react';

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
      return { hasSchedule: false, percent: 0, completedItems: 0, totalItems: 0, isFinished: false };
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

    return { hasSchedule: true, percent, completedItems, totalItems, isFinished: percent >= 100 };
  }, [activitySchedules, dailyActivityReports, currentUser, isInitialized]);

  if (!progressData) return null;

  if (progressData.isFinished) {
    return (
      <div
        onClick={() => onGoToTab('activities', 'checklist')}
        className="flex items-center gap-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl px-3.5 py-2.5 cursor-pointer hover:bg-indigo-100 transition-all group"
      >
        <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
          <Check size={13} className="text-white" strokeWidth={3} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black text-indigo-700 uppercase tracking-tight">Atividades de hoje concluídas</p>
          <div className="h-[3px] bg-indigo-200 rounded-full mt-1 overflow-hidden">
            <div className="h-full w-full bg-indigo-500 rounded-full"></div>
          </div>
        </div>
        <ChevronRight size={14} className="text-indigo-300 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
      </div>
    );
  }

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
