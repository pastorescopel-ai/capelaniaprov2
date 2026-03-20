import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthProvider';
import { Unit } from '../../types';
import { Calendar, MapPin, Users, HeartPulse, TrendingUp } from 'lucide-react';

const ActivityWeeklyAnalysis: React.FC = () => {
  const { activitySchedules, dailyActivityReports } = useApp();
  const { currentUser } = useAuth();
  
  const today = useMemo(() => new Date(), []);
  const currentDayOfWeek = today.getDay();
  // Get start of week (Sunday)
  const startOfWeek = useMemo(() => {
    const start = new Date(today);
    start.setDate(today.getDate() - currentDayOfWeek);
    return start;
  }, [today, currentDayOfWeek]);
  
  // Get end of week (Saturday)
  const endOfWeek = useMemo(() => {
    const end = new Date(startOfWeek);
    end.setDate(startOfWeek.getDate() + 6);
    return end;
  }, [startOfWeek]);

  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const offset = d.getTimezoneOffset() * 60000;
      dates.push(new Date(d.getTime() - offset).toISOString().split('T')[0]);
    }
    return dates;
  }, [startOfWeek]);

  const weekReports = useMemo(() => {
    return dailyActivityReports.filter(r => 
      r.userId === currentUser?.id && 
      weekDates.includes(r.date)
    );
  }, [dailyActivityReports, currentUser?.id, weekDates]);

  const weekSchedules = useMemo(() => {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const offset = firstDay.getTimezoneOffset() * 60000;
    const currentMonth = new Date(firstDay.getTime() - offset).toISOString().split('T')[0];
    return activitySchedules.filter(s => 
      s.userId === currentUser?.id && 
      s.month === currentMonth
    );
  }, [activitySchedules, currentUser?.id, today]);

  const stats = useMemo(() => {
    return weekReports.reduce((acc, report) => ({
      blueprints: acc.blueprints + (report.completedBlueprints?.length || 0),
      cults: acc.cults + (report.completedCults?.length || 0),
      encontros: acc.encontros + (report.completedEncontro ? 1 : 0),
      visiteCantando: acc.visiteCantando + (report.completedVisiteCantando ? 1 : 0),
      palliative: acc.palliative + (report.palliativeCount || 0),
      surgical: acc.surgical + (report.surgicalCount || 0),
      pediatric: acc.pediatric + (report.pediatricCount || 0),
      uti: acc.uti + (report.utiCount || 0),
      totalVisits: acc.totalVisits + (report.palliativeCount || 0) + (report.surgicalCount || 0) + (report.pediatricCount || 0) + (report.utiCount || 0)
    }), {
      blueprints: 0, cults: 0, encontros: 0, visiteCantando: 0,
      palliative: 0, surgical: 0, pediatric: 0, uti: 0, totalVisits: 0
    });
  }, [weekReports]);

  const progress = useMemo(() => {
    const totalScheduled = weekSchedules.length;
    if (totalScheduled === 0) return 0;
    
    let completedScheduled = 0;
    
    weekDates.forEach((date, idx) => {
      const dayOfWeek = idx; // 0 for Sunday, 6 for Saturday
      const daySchedules = weekSchedules.filter(s => s.dayOfWeek === dayOfWeek);
      const dayReport = weekReports.find(r => r.date === date);
      
      if (dayReport) {
        completedScheduled += daySchedules.filter(s => {
          const period = s.period || 'tarde';
          const locWithPeriod = `${s.location}:${period}`;

          if (s.activityType === 'blueprint') {
            return dayReport.completedBlueprints?.includes(locWithPeriod) || 
                   (period === 'tarde' && dayReport.completedBlueprints?.includes(s.location));
          }
          if (s.activityType === 'cult') {
            return dayReport.completedCults?.includes(locWithPeriod) || 
                   (period === 'tarde' && dayReport.completedCults?.includes(s.location));
          }
          if (s.activityType === 'encontro') return dayReport.completedEncontro;
          if (s.activityType === 'visiteCantando') return dayReport.completedVisiteCantando;
          return false;
        }).length;
      }
    });
    
    return Math.round((completedScheduled / totalScheduled) * 100);
  }, [weekSchedules, weekReports, weekDates]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <TrendingUp size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Análise Semanal</h2>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">
              {startOfWeek.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} a {endOfWeek.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
            </p>
          </div>
        </div>
        
        <div className="flex-1 max-w-xs w-full space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black text-indigo-400 uppercase">Progresso da Semana</span>
            <span className="text-lg font-black text-indigo-600">{progress}%</span>
          </div>
          <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
            <div 
              className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><MapPin size={24} /></div>
          <span className="text-3xl font-black text-slate-800 block">{stats.blueprints}</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blueprints</span>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Users size={24} /></div>
          <span className="text-3xl font-black text-slate-800 block">{stats.cults}</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setores</span>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Users size={24} /></div>
          <span className="text-3xl font-black text-slate-800 block">{stats.encontros}</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Encontros HAB</span>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><HeartPulse size={24} /></div>
          <span className="text-3xl font-black text-slate-800 block">{stats.visiteCantando}</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visite Cantando</span>
        </div>
      </div>

      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-8 flex items-center gap-2">
          <HeartPulse className="text-rose-500" size={20} /> Detalhamento de Visitas da Semana
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: 'Paliativos', count: stats.palliative, color: 'rose' },
            { label: 'Cirúrgicos', count: stats.surgical, color: 'amber' },
            { label: 'Pediátrico', count: stats.pediatric, color: 'indigo' },
            { label: 'UTI', count: stats.uti, color: 'emerald' },
          ].map(item => (
            <div key={item.label} className="text-center space-y-3">
              <div className={`text-4xl font-black text-${item.color}-600`}>{item.count}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</div>
              <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                <div className={`h-full bg-${item.color}-500`} style={{ width: `${(item.count / (stats.totalVisits || 1)) * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-8 border-t border-slate-100 text-center">
          <span className="text-5xl font-black text-slate-800 block mb-2">{stats.totalVisits}</span>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total de Visitas na Semana</span>
        </div>
      </section>
    </div>
  );
};

export default ActivityWeeklyAnalysis;
