
import React, { useState } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Config } from '../../types';
import { useApp } from '../../hooks/useApp';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import Mural from './Mural';
import DailyActivitiesReminder from './DailyActivitiesReminder';
import StatCards from './StatCards';
import ImpactCharts from './ImpactCharts';
import VisitGoalWidget from './VisitGoalWidget';
import VisitRequestsWidget from './VisitRequestsWidget';

interface DashboardProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  currentUser: User;
  config: Config;
  onGoToTab: (tab: string, subTab?: any) => void;
  onRegisterMission: (visit: any) => void;
  onEditRequest?: (visit: any) => void;
  onGoToReturnHistory: (visit?: any) => void;
  onUpdateConfig: (newConfig: Config) => any;
  onUpdateUser: (updatedUser: User) => any;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  studies, classes, groups, visits, currentUser, config, onGoToTab, onRegisterMission, onEditRequest, onGoToReturnHistory, onUpdateConfig 
}) => {
  const { visitRequests, users, isInitialized, proMonthlyStats } = useApp(); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));
  
  const {
    pendingReturns,
    todaysReturns,
    monthlyStudies,
    monthlyClasses,
    monthlyGroups,
    monthlyVisits,
    uniqueStudentsMonth,
    totalActionsMonth,
    globalImpact,
    monthName,
    goals,
    accumulated
  } = useDashboardStats(studies, classes, groups, visits, currentUser, proMonthlyStats, selectedMonth);

  if (!isInitialized) {
    return <div className="p-8 text-center text-slate-500 font-bold">Carregando dashboard...</div>;
  }

  if (!currentUser) return null;

  const stats = [
    { label: `Alunos Ativos (${monthName})`, value: uniqueStudentsMonth.size, icon: <i className="fas fa-user-graduate"></i>, color: 'bg-blue-500' },
    { label: `Meus PGs (${monthName})`, value: monthlyGroups.length, icon: <i className="fas fa-house-user"></i>, color: 'bg-emerald-500' },
    { label: `Minhas Ações (${monthName})`, value: totalActionsMonth, icon: <i className="fas fa-bolt"></i>, color: 'bg-amber-500' },
    { label: `Minhas Visitas (${monthName})`, value: monthlyVisits.length, icon: <i className="fas fa-hands-helping"></i>, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Header Row: Mural */}
      <div className="w-full">
        <Mural config={config} userRole={currentUser.role} onUpdateConfig={onUpdateConfig} />
      </div>

      {/* Lembrete de Atividades Diárias */}
      <DailyActivitiesReminder currentUser={currentUser} onGoToTab={onGoToTab} />

      {/* Notificações de Retorno */}
      {todaysReturns.length > 0 ? (
        <div onClick={() => onGoToReturnHistory(todaysReturns[0])} className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-sm group cursor-pointer hover:bg-amber-100 transition-all animate-bounce-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-amber-200"><i className="fas fa-calendar-check"></i></div>
            <div>
              <h4 className="font-black text-amber-900 text-sm uppercase tracking-tight">Retornos para Hoje!</h4>
              <p className="text-amber-700 font-bold text-[10px] uppercase">Você tem {todaysReturns.length} retorno(s) agendado(s) para hoje.</p>
            </div>
          </div>
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-amber-500 shadow-sm group-hover:translate-x-1 transition-transform border border-amber-100"><i className="fas fa-chevron-right"></i></div>
        </div>
      ) : pendingReturns.length > 0 ? (
        <div onClick={() => onGoToReturnHistory(pendingReturns[0])} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm group cursor-pointer hover:bg-slate-100 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-slate-200"><i className="fas fa-calendar-alt"></i></div>
            <div>
              <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">Retornos Agendados</h4>
              <p className="text-slate-600 font-bold text-[10px] uppercase">
                Você tem {pendingReturns.length} retorno(s) pendente(s). Próximo: {
                  (() => {
                    const timestamps = pendingReturns.map(v => {
                      if (typeof v.returnDate === 'number') return v.returnDate;
                      const d = new Date(String(v.returnDate).split('T')[0] + 'T12:00:00');
                      return isNaN(d.getTime()) ? Infinity : d.getTime();
                    }).filter(t => t !== Infinity);
                    
                    if (timestamps.length === 0) return '---';
                    return new Date(Math.min(...timestamps)).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
                  })()
                }
              </p>
            </div>
          </div>
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-500 shadow-sm group-hover:translate-x-1 transition-transform border border-slate-100"><i className="fas fa-chevron-right"></i></div>
        </div>
      ) : null}

      {/* Escala de Visitas PG (VisitRequestsWidget) */}
      <VisitRequestsWidget 
        requests={visitRequests} 
        currentUser={currentUser} 
        users={users} 
        onRegisterMission={onRegisterMission} 
        onEditFullRequest={onEditRequest}
      />

      {/* Metas de Visitas (VisitGoalWidget) */}
      <VisitGoalWidget goals={goals} accumulated={accumulated} currentUser={currentUser} />

      {/* Cartões de Estatísticas */}
      <StatCards stats={stats} />

      {/* Gráficos de Impacto */}
      <ImpactCharts individualData={[
        { name: 'Estudos', val: monthlyStudies.length },
        { name: 'Classes', val: monthlyClasses.length },
        { name: 'PGs', val: monthlyGroups.length },
        { name: 'Visitas', val: monthlyVisits.length },
      ]} globalData={globalImpact} />
    </div>
  );
};

export default Dashboard;
