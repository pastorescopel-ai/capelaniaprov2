import React, { useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, UserRole, Config, RecordStatus } from '../types';

interface DashboardProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  currentUser: User;
  config: Config;
  onGoToTab: (tab: string) => void;
  onUpdateConfig: (newConfig: Config) => void;
  onUpdateUser: (updatedUser: User) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ studies, classes, groups, visits, currentUser, config, onGoToTab, onUpdateConfig, onUpdateUser }) => {
  const [isEditingMural, setIsEditingMural] = useState(false);
  const [muralDraft, setMuralDraft] = useState(config?.muralText || "");

  // Filtros baseados no usuário logado
  const userStudies = (studies || []).filter(s => s && s.userId === currentUser?.id);
  const userClasses = (classes || []).filter(c => c && c.userId === currentUser?.id);
  const userGroups = (groups || []).filter(g => g && g.userId === currentUser?.id);
  const userVisits = (visits || []).filter(v => v && v.userId === currentUser?.id);

  const today = new Date().toISOString().split('T')[0];

  const pendingReturns = userVisits.filter(v => v.requiresReturn && !v.returnCompleted);
  const todaysReturns = userVisits.filter(v => 
    v.requiresReturn && 
    !v.returnCompleted && 
    v.returnDate === today
  );

  // FÓRMULA DE SOMA ÚNICA DE ALUNOS ATIVOS (Status Início ou Continuação)
  const uniqueActiveStudents = new Set<string>();
  
  // Adiciona alunos de estudos bíblicos ativos
  userStudies.forEach(s => {
    if (s.status !== RecordStatus.TERMINO) {
      uniqueActiveStudents.add(s.name.trim().toLowerCase());
    }
  });

  // Adiciona alunos de classes bíblicas ativas
  userClasses.forEach(c => {
    if (c.status !== RecordStatus.TERMINO && Array.isArray(c.students)) {
      c.students.forEach(name => uniqueActiveStudents.add(name.trim().toLowerCase()));
    }
  });

  const totalActions = userStudies.length + userClasses.length + userGroups.length + userVisits.length;

  const stats = [
    { label: 'Total de alunos (HAB/HABA)', value: uniqueActiveStudents.size, icon: <i className="fas fa-user-graduate"></i>, color: 'bg-blue-500' },
    { label: 'Meus PGs', value: userGroups.length, icon: <i className="fas fa-house-user"></i>, color: 'bg-emerald-500' },
    { label: 'Minhas Ações', value: totalActions, icon: <i className="fas fa-bolt"></i>, color: 'bg-amber-500' },
    { label: 'Minhas Visitas', value: userVisits.length, icon: <i className="fas fa-hands-helping"></i>, color: 'bg-rose-500' },
  ];

  const handleSaveMural = () => {
    onUpdateConfig({ ...config, muralText: muralDraft });
    setIsEditingMural(false);
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 w-full">
          <div className="w-12 h-12 bg-[#005a9c] rounded-2xl flex items-center justify-center text-white text-xl shadow-lg shadow-blue-100">
            {currentUser.profilePic ? (
              <img src={currentUser.profilePic} className="w-full h-full object-cover rounded-2xl" alt="Perfil" />
            ) : (
              <i className="fas fa-user"></i>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-slate-800">
              Olá, {currentUser.name}!
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              {currentUser.role === UserRole.ADMIN ? 'Gestor de Capelania' : 'Capelão Ativo'}
            </p>
          </div>
        </div>
      </header>

      {todaysReturns.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl shadow-amber-100/20 group animate-bounce">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-200">
              <i className="fas fa-calendar-check"></i>
            </div>
            <div>
              <h4 className="font-black text-amber-900 text-lg uppercase tracking-tight">Seus Retornos para Hoje!</h4>
              <p className="text-amber-700 font-bold text-sm">Você tem {todaysReturns.length} retorno(s) agendado(s) para este dia.</p>
            </div>
          </div>
          <button 
            onClick={() => onGoToTab('staffVisit')}
            className="px-6 py-3 bg-white text-amber-600 rounded-xl font-black text-xs uppercase shadow-sm hover:bg-amber-100 transition-colors"
          >
            Ver Agora
          </button>
        </div>
      )}

      {pendingReturns.length > 0 && todaysReturns.length === 0 && (
        <div 
          onClick={() => onGoToTab('staffVisit')}
          className="bg-rose-50 border-2 border-rose-100 p-6 rounded-[2.5rem] flex items-center justify-between cursor-pointer hover:bg-rose-100 transition-all shadow-xl shadow-rose-100/20 group animate-in slide-in-from-top duration-500"
        >
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-rose-200 animate-pulse">
              <i className="fas fa-flag"></i>
            </div>
            <div>
              <h4 className="font-black text-rose-900 text-lg uppercase tracking-tight">Retornos Pendentes!</h4>
              <p className="text-rose-600 font-bold text-sm">Você tem {pendingReturns.length} atendimento(s) aguardando retorno.</p>
            </div>
          </div>
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-sm group-hover:translate-x-1 transition-transform">
            <i className="fas fa-chevron-right"></i>
          </div>
        </div>
      )}

      <section className="bg-[#005a9c] p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-black text-sm uppercase tracking-[0.2em] flex items-center gap-2">
              <i className="fas fa-bullhorn text-amber-400"></i> Mural de Avisos
            </h3>
            {currentUser.role === UserRole.ADMIN && (
              <button onClick={() => setIsEditingMural(!isEditingMural)} className="w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center">
                <i className={`fas ${isEditingMural ? 'fa-times' : 'fa-edit'} text-xs`}></i>
              </button>
            )}
          </div>
          
          {isEditingMural ? (
            <div className="space-y-3">
              <textarea 
                value={muralDraft} 
                onChange={e => setMuralDraft(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-white text-sm focus:ring-2 focus:ring-amber-400 outline-none placeholder-white/40"
                rows={3}
                placeholder="Escreva um comunicado..."
              />
              <button onClick={handleSaveMural} className="px-6 py-2 bg-amber-400 text-slate-900 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-amber-300 transition-colors">
                Publicar
              </button>
            </div>
          ) : (
            <p className="text-white/90 leading-relaxed font-medium text-base italic">
              "{config?.muralText || "Nenhum comunicado oficial registrado."}"
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:scale-[1.02] transition-all">
            <div className={`w-12 h-12 ${stat.color} bg-opacity-10 rounded-2xl flex items-center justify-center text-2xl mb-4 text-${stat.color.split('-')[1]}-600`}>
              {stat.icon}
            </div>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-slate-800">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
          <i className="fas fa-chart-bar text-blue-600"></i> Meu Desempenho (HAB+HABA)
        </h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { name: 'Estudos', val: userStudies.length },
              { name: 'Classes', val: userClasses.length },
              { name: 'PGs', val: userGroups.length },
              { name: 'Visitas', val: userVisits.length },
            ]}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} />
              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '1.5rem', border: 'none'}} />
              <Bar dataKey="val" radius={[10, 10, 0, 0]} barSize={40}>
                { [1,2,3,4].map((_, i) => <Cell key={i} fill={['#3b82f6', '#6366f1', '#10b981', '#f43f5e'][i]} />) }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;