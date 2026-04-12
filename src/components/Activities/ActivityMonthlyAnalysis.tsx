import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { Unit } from '../../types';
import { Calendar, MapPin, Users, HeartPulse, TrendingUp } from 'lucide-react';

interface ActivityMonthlyAnalysisProps {
  selectedUser: string;
  setSelectedUser: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const ActivityMonthlyAnalysis: React.FC<ActivityMonthlyAnalysisProps> = ({
  selectedUser,
  setSelectedUser,
  selectedDate,
  setSelectedDate
}) => {
  const { activitySchedules, dailyActivityReports, users } = useApp();
  const { currentUser } = useAuth();
  
  const isAdmin = currentUser?.role === 'ADMIN';

  const chaplains = useMemo(() => {
    return users.filter(u => u.role === 'CHAPLAIN' || u.role === 'INTERN' || u.role === 'ADMIN');
  }, [users]);

  const baseDate = useMemo(() => new Date(selectedDate + 'T12:00:00'), [selectedDate]);
  
  // Get start of month
  const startOfMonth = useMemo(() => {
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [baseDate]);
  
  // Get end of month
  const endOfMonth = useMemo(() => {
    const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [baseDate]);

  const monthReports = useMemo(() => {
    const startStr = startOfMonth.toISOString().split('T')[0];
    const endStr = endOfMonth.toISOString().split('T')[0];
    
    return dailyActivityReports.filter(r => 
      (selectedUser ? r.userId === selectedUser : true) && 
      r.date >= startStr && 
      r.date <= endStr
    );
  }, [dailyActivityReports, selectedUser, startOfMonth, endOfMonth]);

  const monthSchedules = useMemo(() => {
    const monthStr = startOfMonth.toISOString().split('T')[0].substring(0, 7) + '-01';
    
    return activitySchedules.filter(s => 
      (selectedUser ? s.userId === selectedUser : true) && 
      s.month === monthStr
    );
  }, [activitySchedules, selectedUser, startOfMonth]);

  const stats = useMemo(() => {
    return monthReports.reduce((acc, report) => ({
      blueprints: acc.blueprints + (report.completedBlueprints?.length || 0),
      cults: acc.cults + (report.completedCults?.length || 0),
      encontros: acc.encontros + (report.completedEncontro ? 1 : 0),
      visiteCantando: acc.visiteCantando + (report.completedVisiteCantando ? 1 : 0),
      palliative: acc.palliative + (report.palliativeCount || 0),
      surgical: acc.surgical + (report.surgicalCount || 0),
      pediatric: acc.pediatric + (report.pediatricCount || 0),
      uti: acc.uti + (report.utiCount || 0),
      terminal: acc.terminal + (report.terminalCount || 0),
      clinical: acc.clinical + (report.clinicalCount || 0),
      totalVisits: acc.totalVisits + (report.palliativeCount || 0) + (report.surgicalCount || 0) + (report.pediatricCount || 0) + (report.utiCount || 0) + (report.terminalCount || 0) + (report.clinicalCount || 0)
    }), {
      blueprints: 0, cults: 0, encontros: 0, visiteCantando: 0,
      palliative: 0, surgical: 0, pediatric: 0, uti: 0, terminal: 0, clinical: 0, totalVisits: 0
    });
  }, [monthReports]);

  const progress = useMemo(() => {
    const totalScheduled = monthSchedules.length;
    if (totalScheduled === 0) return 0;
    
    // For monthly progress, we check all reports in the month
    let completedScheduled = 0;
    
    // This is a simplified monthly progress: how many of the scheduled items across the month were completed
    // Since schedules are per dayOfWeek, we need to map them to actual dates in the month
    const daysInMonth = endOfMonth.getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        const dObj = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), i);
        const dateStr = dObj.toISOString().split('T')[0];
        const dayOfWeek = dObj.getDay() === 0 ? 7 : dObj.getDay();
        
        const daySchedules = monthSchedules.filter(s => s.dayOfWeek === dayOfWeek);
        const dayReports = monthReports.filter(r => r.date === dateStr);
        
        daySchedules.forEach(s => {
            const period = s.period || 'tarde';
            const locWithPeriod = `${s.location}:${period}`;
            
            const isDone = dayReports.some(dayReport => {
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
            });

            if (isDone) completedScheduled++;
        });
    }
    
    return Math.round((completedScheduled / totalScheduled) * 100);
  }, [monthSchedules, monthReports, startOfMonth, endOfMonth]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Filters for Admin */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Mês de Referência</label>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <div className="p-3 text-slate-400"><Calendar size={16} /></div>
            <input
              type="month"
              value={selectedDate.substring(0, 7)}
              onChange={e => setSelectedDate(e.target.value + '-01')}
              className="flex-1 p-2 bg-transparent border-none font-bold focus:ring-0 outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Capelão</label>
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            disabled={!isAdmin}
            className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
          >
            {isAdmin && <option value="">Todos os Capelães</option>}
            {chaplains.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <TrendingUp size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Análise Mensal</h2>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">
              {startOfMonth.toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}
            </p>
          </div>
        </div>
        
        <div className="flex-1 max-w-xs w-full space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black text-indigo-400 uppercase">Progresso do Mês</span>
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
          <HeartPulse className="text-rose-500" size={20} /> Detalhamento de Visitas do Mês
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {[
            { label: 'Paliativos', count: stats.palliative, color: 'rose' },
            { label: 'Cirúrgicos', count: stats.surgical, color: 'amber' },
            { label: 'Pediátrico', count: stats.pediatric, color: 'indigo' },
            { label: 'UTI', count: stats.uti, color: 'emerald' },
            { label: 'Terminal', count: stats.terminal, color: 'slate' },
            { label: 'Clínico', count: stats.clinical, color: 'blue' },
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
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total de Visitas no Mês</span>
        </div>
      </section>
    </div>
  );
};

export default ActivityMonthlyAnalysis;
