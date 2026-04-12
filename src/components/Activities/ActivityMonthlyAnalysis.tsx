import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { Unit, UserRole } from '../../types';
import { Calendar, MapPin, Users, HeartPulse, TrendingUp } from 'lucide-react';

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const chaplains = useMemo(() => {
    return users.filter(u => u.role === UserRole.CHAPLAIN || u.role === UserRole.INTERN);
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
    const startStr = formatLocalDate(startOfMonth);
    const endStr = formatLocalDate(endOfMonth);
    
    const filtered = dailyActivityReports.filter(r => {
      const matchesUser = selectedUser ? String(r.userId) === String(selectedUser) : true;
      const dateInRange = r.date >= startStr && r.date <= endStr;
      
      // If "All" is selected, only include operational users (Chaplains/Interns)
      if (!selectedUser) {
        const user = users.find(u => String(u.id) === String(r.userId));
        // If user not found yet, we include it to avoid zeroing during load, 
        // but we exclude known ADMINS
        const isOperational = user ? (user.role === UserRole.CHAPLAIN || user.role === UserRole.INTERN) : true;
        return isOperational && dateInRange;
      }
      
      return matchesUser && dateInRange;
    });

    return filtered;
  }, [dailyActivityReports, selectedUser, startOfMonth, endOfMonth, users]);

  const monthSchedules = useMemo(() => {
    const monthStr = formatLocalDate(startOfMonth).substring(0, 7) + '-01';
    
    return activitySchedules.filter(s => 
      (selectedUser ? String(s.userId) === String(selectedUser) : true) && 
      s.month === monthStr
    );
  }, [activitySchedules, selectedUser, startOfMonth]);

  const stats = useMemo(() => {
    const activeDaysSet = new Set<string>();
    
    const result = monthReports.reduce((acc, report) => {
      activeDaysSet.add(report.date);
      return {
        blueprints: acc.blueprints + (report.completedBlueprints?.length || 0),
        cults: acc.cults + (report.completedCults?.length || 0),
        encontros: acc.encontros + (report.completedEncontro ? 1 : 0),
        visiteCantando: acc.visiteCantando + (report.completedVisiteCantando ? 1 : 0),
        palliative: acc.palliative + Number(report.palliativeCount || 0),
        surgical: acc.surgical + Number(report.surgicalCount || 0),
        pediatric: acc.pediatric + Number(report.pediatricCount || 0),
        uti: acc.uti + Number(report.utiCount || 0),
        terminal: acc.terminal + Number(report.terminalCount || 0),
        clinical: acc.clinical + Number(report.clinicalCount || 0),
        totalVisits: acc.totalVisits + 
          Number(report.palliativeCount || 0) + 
          Number(report.surgicalCount || 0) + 
          Number(report.pediatricCount || 0) + 
          Number(report.utiCount || 0) + 
          Number(report.terminalCount || 0) + 
          Number(report.clinicalCount || 0)
      };
    }, {
      blueprints: 0, cults: 0, encontros: 0, visiteCantando: 0,
      palliative: 0, surgical: 0, pediatric: 0, uti: 0, terminal: 0, clinical: 0, totalVisits: 0
    });

    // Calculate active days also from schedules if no reports exist yet
    if (selectedUser) {
        const daysInMonth = endOfMonth.getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dObj = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), i);
            const dayOfWeek = dObj.getDay() === 0 ? 7 : dObj.getDay();
            const hasSchedule = monthSchedules.some(s => s.dayOfWeek === dayOfWeek);
            if (hasSchedule) activeDaysSet.add(formatLocalDate(dObj));
        }
    }

    const activeDays = activeDaysSet.size || 1;
    const dailyAverage = result.totalVisits / activeDays;
    
    // Target Goal
    const targetUser = selectedUser ? users.find(u => String(u.id) === String(selectedUser)) : null;
    const baseGoal = targetUser?.role === UserRole.INTERN ? 18 : 15;
    const performancePercent = baseGoal > 0 ? (dailyAverage / baseGoal) * 100 : 0;

    return { ...result, activeDays, dailyAverage, performancePercent, baseGoal };
  }, [monthReports, monthSchedules, selectedUser, users, startOfMonth, endOfMonth]);

  const getSemaphoreColor = (percent: number) => {
    if (percent >= 95) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (percent >= 70) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-rose-600 bg-rose-50 border-rose-100';
  };

  const progress = useMemo(() => {
    let totalItems = 0;
    let completedItems = 0;
    
    const daysInMonth = endOfMonth.getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        const dObj = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), i);
        const dateStr = formatLocalDate(dObj);
        const dayOfWeek = dObj.getDay() === 0 ? 7 : dObj.getDay();
        
        // Find user for this specific day if we are in "All Chaplains" view
        // For simplicity in "All Chaplains" view, we'll calculate the average or sum.
        // But usually, selectedUser is provided.
        
        const usersToProcess = selectedUser 
          ? [users.find(u => String(u.id) === String(selectedUser))].filter(Boolean) 
          : chaplains;

        usersToProcess.forEach(user => {
            if (!user) return;
            
            const daySchedules = activitySchedules.filter(s => String(s.userId) === String(user.id) && s.dayOfWeek === dayOfWeek && s.month === (formatLocalDate(startOfMonth).substring(0, 7) + '-01'));
            const dayReport = dailyActivityReports.find(r => String(r.userId) === String(user.id) && r.date === dateStr);
            
            // Goal: 18 for Interns, 15 for others (Chaplains/Admins)
            const visitGoal = user.role === UserRole.INTERN ? 18 : 15;

            // Only count days that have either a schedule or a report
            if (daySchedules.length > 0 || dayReport) {
                // Scheduled activities part
                totalItems += daySchedules.length;
                
                daySchedules.forEach(s => {
                    if (!dayReport) return;
                    const period = s.period || 'tarde';
                    const locWithPeriod = `${s.location}:${period}`;
                    
                    const isDone = (s.activityType === 'blueprint' && (dayReport.completedBlueprints?.includes(locWithPeriod) || (period === 'tarde' && dayReport.completedBlueprints?.includes(s.location)))) ||
                                   (s.activityType === 'cult' && (dayReport.completedCults?.includes(locWithPeriod) || (period === 'tarde' && dayReport.completedCults?.includes(s.location)))) ||
                                   (s.activityType === 'encontro' && dayReport.completedEncontro) ||
                                   (s.activityType === 'visiteCantando' && dayReport.completedVisiteCantando);
                    
                    if (isDone) completedItems++;
                });

                // Visit goal part
                totalItems += 1;
                if (dayReport) {
                    const totalVisits = (dayReport.palliativeCount || 0) + 
                                       (dayReport.surgicalCount || 0) + 
                                       (dayReport.pediatricCount || 0) + 
                                       (dayReport.utiCount || 0) + 
                                       (dayReport.terminalCount || 0) + 
                                       (dayReport.clinicalCount || 0);
                    
                    if (totalVisits >= visitGoal) completedItems++;
                }
            }
        });
    }
    
    if (totalItems === 0) return 0;
    return Math.round((completedItems / totalItems) * 100);
  }, [activitySchedules, dailyActivityReports, startOfMonth, endOfMonth, selectedUser, chaplains, users]);

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
        <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className={`p-6 rounded-3xl border ${getSemaphoreColor(stats.performancePercent)} transition-colors duration-500`}>
            <span className="text-5xl font-black block mb-1">{stats.totalVisits}</span>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Total de Visitas no Mês</span>
          </div>
          
          <div className={`p-6 rounded-3xl border ${getSemaphoreColor(stats.performancePercent)} transition-colors duration-500`}>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-black">{stats.dailyAverage.toFixed(1)}</span>
              <span className="text-sm font-bold opacity-60">/ dia</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Média de Visitas Diárias</span>
            <div className="mt-2 text-[9px] font-bold uppercase tracking-tighter opacity-50">
              Meta Base: {stats.baseGoal} visitas/dia
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ActivityMonthlyAnalysis;
