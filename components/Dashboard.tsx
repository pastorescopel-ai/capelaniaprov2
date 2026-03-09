
import React from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, UserRole, Config } from '../types';
import { useApp } from '../contexts/AppContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import Mural from './Dashboard/Mural';
import StatCards from './Dashboard/StatCards';
import ImpactCharts from './Dashboard/ImpactCharts';
import VisitGoalWidget from './Dashboard/VisitGoalWidget';
import VisitRequestsWidget from './Dashboard/VisitRequestsWidget';

interface DashboardProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  currentUser: User;
  config: Config;
  onGoToTab: (tab: string) => void;
  onRegisterMission: (visit: any) => void;
  onGoToReturnHistory: (visit?: any) => void;
  onUpdateConfig: (newConfig: Config) => any;
  onUpdateUser: (updatedUser: User) => any;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  studies, classes, groups, visits, currentUser, config, onGoToTab, onRegisterMission, onGoToReturnHistory, onUpdateConfig 
}) => {
  const { visitRequests, users, activitySchedules, dailyActivityReports } = useApp(); 
  
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const todaysSchedules = activitySchedules.filter(s => 
    s.userId === currentUser.id && 
    s.month === monthStart && 
    s.dayOfWeek === dayOfWeek
  );
  
  const reportToday = dailyActivityReports.find(r => r.userId === currentUser.id && r.date === today);
  
  const completedCount = todaysSchedules.filter(s => {
    if (s.activityType === 'blueprint') return reportToday?.completedBlueprints?.includes(s.location);
    if (s.activityType === 'cult') return reportToday?.completedCults?.includes(s.location);
    if (s.activityType === 'encontro') return reportToday?.completedEncontro;
    if (s.activityType === 'visiteCantando') return reportToday?.completedVisiteCantando;
    return false;
  }).length;
  
  const activityProgress = todaysSchedules.length > 0 ? Math.round((completedCount / todaysSchedules.length) * 100) : 0;
  
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
  } = useDashboardStats(studies, classes, groups, visits, currentUser);

  if (!currentUser) return null;

  const stats = [
    { label: `Alunos Ativos (${monthName})`, value: uniqueStudentsMonth.size, icon: <i className="fas fa-user-graduate"></i>, color: 'bg-blue-50' },
    { label: `Meus PGs (${monthName})`, value: monthlyGroups.length, icon: <i className="fas fa-house-user"></i>, color: 'bg-emerald-50' },
    { label: `Minhas Ações (${monthName})`, value: totalActionsMonth, icon: <i className="fas fa-bolt"></i>, color: 'bg-amber-50' },
    { label: `Minhas Visitas (${monthName})`, value: monthlyVisits.length, icon: <i className="fas fa-hands-helping"></i>, color: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <Mural config={config} userRole={currentUser.role} onUpdateConfig={onUpdateConfig} />

      {/* Missão de Atividades Diárias */}
      {todaysSchedules.length > 0 && (
        <div onClick={() => onGoToTab('activities')} className="bg-indigo-50 border border-indigo-200 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between shadow-sm group cursor-pointer hover:bg-indigo-100 transition-all">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-200">
              <i className="fas fa-tasks"></i>
            </div>
            <div>
              <h4 className="font-black text-indigo-900 text-base uppercase tracking-tight">Missão de Hoje</h4>
              <p className="text-indigo-700 font-bold text-[10px] uppercase tracking-widest">
                {completedCount} de {todaysSchedules.length} atividades concluídas
              </p>
            </div>
          </div>
          
          <div className="flex-1 max-w-xs w-full mt-4 md:mt-0 md:mx-8 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[9px] font-black text-indigo-400 uppercase">Progresso</span>
              <span className="text-sm font-black text-indigo-600">{activityProgress}%</span>
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden border border-indigo-100 p-0.5">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                style={{ width: `${activityProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="hidden md:flex w-10 h-10 bg-white rounded-full items-center justify-center text-indigo-600 shadow-sm group-hover:translate-x-1 transition-transform border border-indigo-100">
            <i className="fas fa-chevron-right"></i>
          </div>
        </div>
      )}

      {/* Notificações de Retorno (Movido para baixo do Mural) */}
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
                  new Date(Math.min(...pendingReturns.map(v => new Date(v.returnDate + 'T12:00:00').getTime()))).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})
                }
              </p>
            </div>
          </div>
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-500 shadow-sm group-hover:translate-x-1 transition-transform border border-slate-100"><i className="fas fa-chevron-right"></i></div>
        </div>
      ) : null}

      <VisitRequestsWidget requests={visitRequests} currentUser={currentUser} users={users} onRegisterMission={onRegisterMission} />

      <VisitGoalWidget goals={goals} accumulated={accumulated} currentUser={currentUser} />

      <StatCards stats={stats} />
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
