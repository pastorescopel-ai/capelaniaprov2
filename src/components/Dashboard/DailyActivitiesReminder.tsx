
import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { User } from '../../types';
import { CheckCircle2, ArrowRight } from 'lucide-react';

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

    if (scheduled.length === 0) return null;

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

    return { percent, completedItems, totalItems, isFinished: percent >= 100 };
  }, [activitySchedules, dailyActivityReports, currentUser, isInitialized]);

  if (!progressData || progressData.isFinished) return null;

  return (
    <div
      onClick={() => onGoToTab('activities', 'checklist')}
      className="bg-white border border-indigo-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
    >
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>

      <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-indigo-200">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight">Atividades de Hoje</h4>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1">
              {progressData.completedItems} de {progressData.totalItems} concluídas
            </p>
          </div>
        </div>

        <div className="flex-1 max-w-md w-full space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Progresso Diário</span>
            <span className="text-sm font-black text-indigo-600">{progressData.percent}%</span>
          </div>
          <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out relative"
              style={{ width: `${progressData.percent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
          <span>Lançar Agora</span>
          <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
};

export default DailyActivitiesReminder;
