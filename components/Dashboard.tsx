
import React from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, UserRole, Config } from '../types';
import { useApp } from '../contexts/AppContext'; 
import Mural from './Dashboard/Mural';
import StatCards from './Dashboard/StatCards';
import ImpactCharts from './Dashboard/ImpactCharts';
import VisitRequestsWidget from './Dashboard/VisitRequestsWidget'; 
import ClosureBanner from './Dashboard/ClosureBanner';

interface DashboardProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  currentUser: User;
  config: Config;
  onGoToTab: (tab: string) => void;
  onUpdateConfig: (newConfig: Config) => any;
  onUpdateUser: (updatedUser: User) => any;
}

const Dashboard: React.FC<DashboardProps> = ({ studies, classes, groups, visits, currentUser, config, onGoToTab, onUpdateConfig, onUpdateUser }) => {
  const { visitRequests, users } = useApp(); 

  if (!currentUser) return null;

  const userStudies = (studies || []).filter(s => s && s.userId === currentUser?.id);
  const userClasses = (classes || []).filter(c => c && c.userId === currentUser?.id);
  const userGroups = (groups || []).filter(g => g && g.userId === currentUser?.id);
  const userVisits = (visits || []).filter(v => v && v.userId === currentUser?.id);

  const todayStr = new Date().toISOString().split('T')[0];
  const pendingReturns = userVisits.filter(v => v.requiresReturn && !v.returnCompleted);
  const todaysReturns = userVisits.filter(v => v.requiresReturn && !v.returnCompleted && v.returnDate === todayStr);

  const uniqueStudents = new Set<string>();
  userStudies.forEach(s => { if (s.name) uniqueStudents.add(s.name.trim().toLowerCase()); });
  userClasses.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(name => { if (name) uniqueStudents.add(name.trim().toLowerCase()); }); });

  const totalActions = userStudies.length + userClasses.length + userGroups.length + userVisits.length;

  const getGlobalImpactData = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonthDate = new Date();
    prevMonthDate.setMonth(now.getMonth() - 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    const getMonthStats = (m: number, y: number) => {
      const mStudies = (studies || []).filter(s => { const d = new Date(s.date); return d.getMonth() === m && d.getFullYear() === y; });
      const mClasses = (classes || []).filter(c => { const d = new Date(c.date); return d.getMonth() === m && d.getFullYear() === y; });
      const mGroups = (groups || []).filter(g => { const d = new Date(g.date); return d.getMonth() === m && d.getFullYear() === y; });
      const mVisits = (visits || []).filter(v => { const d = new Date(v.date); return d.getMonth() === m && d.getFullYear() === y; });
      const uStudents = new Set<string>();
      mStudies.forEach(s => { if (s.name) uStudents.add(s.name.trim().toLowerCase()); });
      mClasses.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => uStudents.add(n.trim().toLowerCase())); });
      return { students: uStudents.size, studies: mStudies.length, classes: mClasses.length, groups: mGroups.length, visits: mVisits.length, total: mStudies.length + mClasses.length + mGroups.length + mVisits.length };
    };

    const curr = getMonthStats(currentMonth, currentYear);
    const prev = getMonthStats(prevMonth, prevYear);
    const diff = curr.total - prev.total;
    const pct = prev.total > 0 ? Math.round((diff / prev.total) * 100) : (curr.total > 0 ? 100 : 0);
    
    const chartData = [
      { name: 'Alunos', anterior: prev.students, atual: curr.students },
      { name: 'Estudos', anterior: prev.studies, atual: curr.studies },
      { name: 'Classes', anterior: prev.classes, atual: curr.classes },
      { name: 'PGs', anterior: prev.groups, atual: curr.groups },
      { name: 'Visitas', anterior: prev.visits, atual: curr.visits },
    ];
    return { chartData, pct, isUp: diff >= 0 };
  };

  const globalImpact = getGlobalImpactData();
  const stats = [
    { label: 'Total de alunos (HAB/HABA)', value: uniqueStudents.size, icon: <i className="fas fa-user-graduate"></i>, color: 'bg-blue-50' },
    { label: 'Meus PGs', value: userGroups.length, icon: <i className="fas fa-house-user"></i>, color: 'bg-emerald-50' },
    { label: 'Minhas Ações', value: totalActions, icon: <i className="fas fa-bolt"></i>, color: 'bg-amber-50' },
    { label: 'Minhas Visitas', value: userVisits.length, icon: <i className="fas fa-hands-helping"></i>, color: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 w-full">
          <div className="w-12 h-12 bg-[#005a9c] rounded-2xl flex items-center justify-center text-white text-xl shadow-md overflow-hidden">
            {currentUser.profilePic ? <img src={currentUser.profilePic} className="w-full h-full object-cover" alt="Perfil" /> : <i className="fas fa-user"></i>}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Olá, {currentUser.name}!</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                {currentUser.role === UserRole.ADMIN ? 'Gestor de Capelania' : 'Capelão Ativo'}
            </p>
          </div>
        </div>
      </header>

      <ClosureBanner userRole={currentUser.role} />

      <VisitRequestsWidget requests={visitRequests} currentUser={currentUser} users={users} />

      {todaysReturns.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2.5rem] flex items-center justify-between shadow-md group animate-bounce">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-200"><i className="fas fa-calendar-check"></i></div>
            <div>
              <h4 className="font-black text-amber-900 text-lg uppercase tracking-tight">Seus Retornos para Hoje!</h4>
              <p className="text-amber-700 font-bold text-sm">Você tem {todaysReturns.length} retorno(s) agendado(s).</p>
            </div>
          </div>
          <button onClick={() => onGoToTab('staffVisit')} className="px-6 py-3 bg-white text-amber-600 rounded-xl font-black text-xs uppercase shadow-sm border border-amber-100 hover:bg-amber-50 transition-colors">Ver Agora</button>
        </div>
      )}

      {pendingReturns.length > 0 && todaysReturns.length === 0 && (
        <div onClick={() => onGoToTab('staffVisit')} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all shadow-sm group">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-rose-200 animate-pulse"><i className="fas fa-flag"></i></div>
            <div>
              <h4 className="font-black text-rose-900 text-lg uppercase tracking-tight">Retornos Pendentes!</h4>
              <p className="text-rose-600 font-bold text-sm">Há {pendingReturns.length} atendimentos aguardando retorno.</p>
            </div>
          </div>
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-rose-500 shadow-sm group-hover:translate-x-1 transition-transform border border-slate-100"><i className="fas fa-chevron-right"></i></div>
        </div>
      )}

      <Mural config={config} userRole={currentUser.role} onUpdateConfig={onUpdateConfig} />
      <StatCards stats={stats} />
      <ImpactCharts individualData={[
        { name: 'Estudos', val: userStudies.length },
        { name: 'Classes', val: userClasses.length },
        { name: 'PGs', val: userGroups.length },
        { name: 'Visitas', val: userVisits.length },
      ]} globalData={globalImpact} />
    </div>
  );
};

export default Dashboard;
