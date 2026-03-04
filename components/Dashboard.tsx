
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
  onRegisterReturnVisit: (visit: any) => void;
  onUpdateConfig: (newConfig: Config) => any;
  onUpdateUser: (updatedUser: User) => any;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  studies, classes, groups, visits, currentUser, config, onGoToTab, onRegisterMission, onRegisterReturnVisit, onUpdateConfig 
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

      {/* Notificações de Retorno (Movido para baixo do Mural) */}
      {(todaysReturns.length > 0 || pendingReturns.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <i className="fas fa-flag text-rose-500"></i> Retornos Pendentes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todaysReturns.map(visit => (
              <div key={visit.id} onClick={() => onRegisterReturnVisit(visit)} className="bg-amber-50 border border-amber-200 p-4 rounded-3xl flex items-center justify-between shadow-sm group cursor-pointer hover:bg-amber-100 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-amber-200 animate-pulse"><i className="fas fa-calendar-check"></i></div>
                  <div>
                    <h4 className="font-black text-amber-900 text-sm uppercase tracking-tight">{visit.staffName}</h4>
                    <p className="text-amber-700 font-bold text-[10px] uppercase">{visit.sector} • Hoje</p>
                  </div>
                </div>
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-amber-500 shadow-sm group-hover:translate-x-1 transition-transform border border-amber-100"><i className="fas fa-chevron-right"></i></div>
              </div>
            ))}
            {pendingReturns.filter(v => !todaysReturns.includes(v)).slice(0, 4).map(visit => (
              <div key={visit.id} onClick={() => onRegisterReturnVisit(visit)} className="bg-white p-4 rounded-3xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all shadow-sm group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center text-lg"><i className="fas fa-flag"></i></div>
                  <div>
                    <h4 className="font-black text-slate-700 text-sm uppercase tracking-tight">{visit.staffName}</h4>
                    <p className="text-slate-400 font-bold text-[10px] uppercase">{visit.sector} • {new Date(visit.returnDate + 'T12:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</p>
                  </div>
                </div>
                <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-rose-500 shadow-sm group-hover:translate-x-1 transition-transform border border-slate-100"><i className="fas fa-chevron-right"></i></div>
              </div>
            ))}
          </div>
        </div>
      )}

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
