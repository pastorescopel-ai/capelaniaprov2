
import React, { useMemo } from 'react';
import { ActivitySchedule, DailyActivityReport, User } from '../../types';
import { getMonthStartISO } from '../../utils/formatters';
import { CheckCircle, Circle, MapPin, Users, HeartPulse, Calendar } from 'lucide-react';

interface ActivityProgressWidgetProps {
  schedules: ActivitySchedule[];
  reports: DailyActivityReport[];
  currentUser: User;
  onGoToActivities: () => void;
}

const ActivityProgressWidget: React.FC<ActivityProgressWidgetProps> = ({
  schedules,
  reports,
  currentUser,
  onGoToActivities
}) => {
  const today = new Date().toISOString().split('T')[0];
  const d = new Date().getDay();
  const dayOfWeek = d === 0 ? 7 : d;
  const currentMonth = getMonthStartISO();

  const todaysSchedules = useMemo(() => 
    schedules.filter(s => 
      s.userId === currentUser.id && 
      s.month === currentMonth && 
      Number(s.dayOfWeek) === dayOfWeek
    ),
    [schedules, currentUser.id, currentMonth, dayOfWeek]
  );

  const todaysReport = useMemo(() => 
    reports.find(r => r.userId === currentUser.id && r.date === today),
    [reports, currentUser.id, today]
  );

  const stats = useMemo(() => {
    const total = todaysSchedules.length;
    if (total === 0) return { total: 0, completed: 0, percent: 0 };

    const completed = todaysSchedules.filter(s => {
      if (!todaysReport) return false;
      if (s.activityType === 'blueprint') return todaysReport.completedBlueprints?.includes(s.location);
      if (s.activityType === 'cult') return todaysReport.completedCults?.includes(s.location);
      if (s.activityType === 'encontro') return todaysReport.completedEncontro;
      if (s.activityType === 'visiteCantando') return todaysReport.completedVisiteCantando;
      return false;
    }).length;

    return {
      total,
      completed,
      percent: Math.round((completed / total) * 100)
    };
  }, [todaysSchedules, todaysReport]);

  if (todaysSchedules.length === 0) return null;

  return (
    <div 
      onClick={onGoToActivities}
      className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
            <i className="fas fa-tasks"></i>
          </div>
          <div>
            <h4 className="font-black text-indigo-900 text-base uppercase tracking-tight">Progresso de Atividades</h4>
            <p className="text-indigo-700 font-bold text-[10px] uppercase tracking-widest">
              {stats.completed} de {stats.total} atividades concluídas hoje
            </p>
          </div>
        </div>
        
        <div className="flex-1 max-w-xs w-full space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-[9px] font-black text-indigo-400 uppercase">Progresso Diário</span>
            <span className="text-sm font-black text-indigo-600">{stats.percent}%</span>
          </div>
          <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
            <div 
              className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
              style={{ width: `${stats.percent}%` }}
            ></div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-indigo-400 group-hover:translate-x-1 transition-transform">
          <span className="text-[10px] font-black uppercase">Lançar</span>
          <i className="fas fa-chevron-right"></i>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-50">
        {['blueprint', 'cult', 'encontro', 'visiteCantando'].map(type => {
          const typeSchedules = todaysSchedules.filter(s => s.activityType === type);
          if (typeSchedules.length === 0) return null;

          const typeCompleted = typeSchedules.filter(s => {
            if (!todaysReport) return false;
            if (type === 'blueprint') return todaysReport.completedBlueprints?.includes(s.location);
            if (type === 'cult') return todaysReport.completedCults?.includes(s.location);
            if (type === 'encontro') return todaysReport.completedEncontro;
            if (type === 'visiteCantando') return todaysReport.completedVisiteCantando;
            return false;
          }).length;

          let Icon = MapPin;
          let color = 'text-indigo-500';
          let label = 'Blueprint';

          if (type === 'cult') { Icon = Users; color = 'text-emerald-500'; label = 'Cultos'; }
          if (type === 'encontro') { Icon = HeartPulse; color = 'text-amber-500'; label = 'Encontro'; }
          if (type === 'visiteCantando') { Icon = HeartPulse; color = 'text-rose-500'; label = 'Visite Cant.'; }

          return (
            <div key={type} className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
              <div className={`${color} bg-white p-2 rounded-xl shadow-sm`}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <p className="text-xs font-black text-slate-700">{typeCompleted}/{typeSchedules.length}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityProgressWidget;
