
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
  onUpdateConfig: (newConfig: Config) => any;
  onUpdateUser: (updatedUser: User) => any;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  studies, classes, groups, visits, currentUser, config, onGoToTab, onRegisterMission, onUpdateConfig 
}) => {
  const { visitRequests, users } = useApp(); 
  
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

      <VisitRequestsWidget requests={visitRequests} currentUser={currentUser} users={users} onRegisterMission={onRegisterMission} />

      <VisitGoalWidget goals={goals} accumulated={accumulated} currentUser={currentUser} />

      {todaysReturns.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl flex items-center justify-between shadow-sm group animate-bounce">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-xl flex items-center justify-center text-xl shadow-md shadow-amber-200"><i className="fas fa-calendar-check"></i></div>
            <div>
              <h4 className="font-black text-amber-900 text-base uppercase tracking-tight">Seus Retornos para Hoje!</h4>
              <p className="text-amber-700 font-bold text-xs">Você tem {todaysReturns.length} retorno(s) agendado(s).</p>
            </div>
          </div>
          <button onClick={() => onGoToTab('staffVisit')} className="px-5 py-2.5 bg-white text-amber-600 rounded-xl font-black text-[10px] uppercase shadow-sm border border-amber-100 hover:bg-amber-50 active:scale-95 transition-all">Ver Agora</button>
        </div>
      )}

      {pendingReturns.length > 0 && todaysReturns.length === 0 && (
        <div onClick={() => onGoToTab('staffVisit')} className="bg-white p-5 rounded-3xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all shadow-sm group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-500 text-white rounded-xl flex items-center justify-center text-xl shadow-md shadow-rose-200 animate-pulse"><i className="fas fa-flag"></i></div>
            <div>
              <h4 className="font-black text-rose-900 text-base uppercase tracking-tight">Retornos Pendentes!</h4>
              <p className="text-rose-600 font-bold text-xs">Há {pendingReturns.length} atendimentos aguardando retorno.</p>
            </div>
          </div>
          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-rose-500 shadow-sm group-hover:translate-x-1 transition-transform border border-slate-100"><i className="fas fa-chevron-right"></i></div>
        </div>
      )}

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
