import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { Unit, UserRole } from '../../types';
import { Calendar, MapPin, Users, HeartPulse, TrendingUp } from 'lucide-react';
import { DataRepository } from '../../services/dataRepository';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';


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

  
  const [localReports, setLocalReports] = useState<any[] | null>(null);
  const [localSchedules, setLocalSchedules] = useState<any[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - 40);
    const limitDate = d.toISOString().split('T')[0];
    const limitMonth = d.toISOString().substring(0, 7) + '-01';
    
    // We fetch if the selectedDate (which dictates the month viewed) is older than 40 days
    if (selectedDate < limitDate) {
      setIsLoadingHistory(true);
      
      const targetMonthStr = selectedDate.substring(0, 7) + '-01';
      
      Promise.all([
        DataRepository.fetchFullTable('daily_activity_reports', 49999, q => q.gte('date', targetMonthStr)),
        DataRepository.fetchFullTable('activity_schedules', 49999, q => q.gte('month', targetMonthStr))
      ]).then(([repRes, schedRes]) => {
        setLocalReports(repRes.data || []);
        setLocalSchedules(schedRes.data || []);
        setIsLoadingHistory(false);
      }).catch(err => {
        console.error('Error loading historical analysis data', err);
        setIsLoadingHistory(false);
      });
    } else {
      setLocalReports(null);
      setLocalSchedules(null);
    }
  }, [selectedDate]);

  const effectiveReports = localReports !== null ? localReports : dailyActivityReports;
  const effectiveSchedules = localSchedules !== null ? localSchedules : activitySchedules;

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
    
    const filtered = effectiveReports.filter(r => {
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
  }, [effectiveReports, selectedUser, startOfMonth, endOfMonth, users]);

  const monthSchedules = useMemo(() => {
    const monthStr = formatLocalDate(startOfMonth).substring(0, 7) + '-01';
    
    return effectiveSchedules.filter(s => 
      (selectedUser ? String(s.userId) === String(selectedUser) : true) && 
      s.month === monthStr
    );
  }, [effectiveSchedules, selectedUser, startOfMonth]);

  const stats = useMemo(() => {
    const activeDaysSet = new Set<string>();

    const result = monthReports.reduce((acc, report) => {
      activeDaysSet.add(report.date);

      return {
        blueprints: acc.blueprints + (report.completedBlueprints?.length || 0),
        cults: acc.cults + (report.completedCults?.length || 0),
        encontros: acc.encontros + (report.completedEncontro ? 1 : 0),
        visiteCantando: acc.visiteCantando + (report.completedVisiteCantando ? 1 : 0)
      };
    }, {
      blueprints: 0, cults: 0, encontros: 0, visiteCantando: 0
    });

    return { ...result, activeDays: activeDaysSet.size };
  }, [monthReports]);

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
            
            // Blueprint/Cult são recorrentes por dia da semana; Encontro/Visite Cantando
            // são eventos de data específica — contá-los pelo dia da semana infla o total
            // esperado em toda ocorrência do mesmo dia no mês, não só na data real marcada.
            const daySchedules = effectiveSchedules.filter(s => {
                if (String(s.userId) !== String(user.id) || s.month !== (formatLocalDate(startOfMonth).substring(0, 7) + '-01')) return false;
                if (s.activityType === 'encontro' || s.activityType === 'visiteCantando') {
                    return !!s.date && s.date.substring(0, 10) === dateStr;
                }
                return s.dayOfWeek === dayOfWeek;
            });
            const dayReport = effectiveReports.find(r => String(r.userId) === String(user.id) && r.date === dateStr);

            if (daySchedules.length > 0) {
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
            }
        });
    }
    
    if (totalItems === 0) return 0;
    return Math.round((completedItems / totalItems) * 100);
  }, [effectiveSchedules, effectiveReports, startOfMonth, endOfMonth, selectedUser, chaplains, users]);

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
    </div>
  );
};

export default ActivityMonthlyAnalysis;
