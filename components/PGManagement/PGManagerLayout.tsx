
import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { Unit } from '../../types';
import { useApp } from '../../contexts/AppProvider';
import PGDashboard from './PGDashboard';
import PGMembership from './PGMembership';
import PGReports from './PGReports';
import PGOps from './PGOps';
import PGLeaders from './PGLeaders';

const PGManagerLayout: React.FC = () => {
  const { config } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'membership' | 'ops' | 'reports' | 'leaders'>('dashboard');
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  const [isPending, startTransition] = useTransition();

  // Estado centralizado do mês de competência selecionado
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return config.activeCompetenceMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  });

  const isMonthClosed = useMemo(() => {
    if (!config.activeCompetenceMonth) return false;
    return selectedMonth < config.activeCompetenceMonth;
  }, [selectedMonth, config.activeCompetenceMonth]);

  // Sincronizar com o mês ativo quando ele mudar (ex: após fechamento de mês)
  useEffect(() => {
    if (config.activeCompetenceMonth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMonth(config.activeCompetenceMonth);
    }
  }, [config.activeCompetenceMonth]);

  useEffect(() => {
    const container = document.getElementById('main-scroll-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeSubTab, currentUnit]);

  const handleTabChange = (tabId: 'dashboard' | 'membership' | 'ops' | 'reports' | 'leaders') => {
    startTransition(() => {
      setActiveSubTab(tabId);
    });
  };

  const handleUnitChange = (u: Unit) => {
    startTransition(() => {
      setCurrentUnit(u);
    });
  };

  const tabs = [
    { id: 'dashboard', label: 'Visão Geral', icon: 'fas fa-chart-pie' },
    { id: 'membership', label: 'Matrícula', icon: 'fas fa-user-plus' },
    { id: 'leaders', label: 'Líderes', icon: 'fas fa-users' },
    { id: 'ops', label: 'Agenda PG', icon: 'fas fa-calendar-check' },
    { id: 'reports', label: 'Relatórios', icon: 'fas fa-print' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
      
      <div className="sticky top-[-1rem] md:top-[-2rem] z-[100] -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-[#f1f5f9]/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {isMonthClosed && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-amber-900/20">
                  <i className="fas fa-lock"></i>
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-amber-800 uppercase tracking-tighter leading-none">
                    Mês de Competência Encerrado
                  </h3>
                  <p className="text-amber-600 text-[9px] font-bold uppercase tracking-widest mt-1">
                    Snapshot histórico (Somente Leitura)
                  </p>
                </div>
              </div>
              <div className="hidden md:block px-4 py-2 bg-amber-500/20 rounded-xl border border-amber-500/30">
                <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">
                  Integridade de Dados Preservada
                </span>
              </div>
            </div>
          )}

          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#005a9c] rounded-xl md:rounded-2xl flex items-center justify-center text-white text-lg md:text-xl shadow-lg shadow-blue-900/20">
                <i className="fas fa-project-diagram"></i>
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">
                  Gestão Estratégica
                </h1>
                <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mt-1 hidden sm:block">
                  Discipulado e Pequenos Grupos
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl md:rounded-2xl border border-slate-200">
                <button 
                  onClick={() => {
                    const d = new Date(selectedMonth + 'T12:00:00');
                    d.setMonth(d.getMonth() - 1);
                    setSelectedMonth(d.toISOString().split('T')[0]);
                  }}
                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-slate-500 hover:text-[#005a9c] hover:bg-white rounded-lg md:rounded-xl transition-all"
                >
                  <i className="fas fa-chevron-left text-[10px]"></i>
                </button>
                <div className="px-4 flex items-center justify-center min-w-[120px] md:min-w-[160px]">
                  <span className="text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-tighter">
                    {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(selectedMonth + 'T12:00:00'))}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    const d = new Date(selectedMonth + 'T12:00:00');
                    d.setMonth(d.getMonth() + 1);
                    setSelectedMonth(d.toISOString().split('T')[0]);
                  }}
                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-slate-500 hover:text-[#005a9c] hover:bg-white rounded-lg md:rounded-xl transition-all"
                >
                  <i className="fas fa-chevron-right text-[10px]"></i>
                </button>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl md:rounded-2xl border border-slate-200">
                {[Unit.HAB, Unit.HABA].map(u => (
                  <button 
                    key={u} 
                    onClick={() => handleUnitChange(u)} 
                    className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-black text-[9px] md:text-[10px] uppercase transition-all ${
                      currentUnit === u 
                        ? 'bg-[#005a9c] text-white shadow-lg scale-105' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Unidade {u}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <nav className="flex overflow-x-auto no-scrollbar gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as any)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border-2 transition-all whitespace-nowrap ${
                  activeSubTab === tab.id 
                    ? 'bg-white border-[#005a9c] text-[#005a9c] shadow-md scale-105' 
                    : 'bg-white/50 border-transparent text-slate-400 hover:bg-white hover:text-slate-600'
                }`}
              >
                <i className={`${tab.icon} text-xs md:text-sm`}></i>
                <span className="text-[9px] md:text-xs font-black uppercase tracking-wider">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className={`max-w-7xl mx-auto min-h-[500px] transition-opacity duration-200 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
        <main className="animate-in fade-in slide-in-from-top-2 duration-500">
          {activeSubTab === 'dashboard' && <PGDashboard unit={currentUnit} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />}
          {activeSubTab === 'membership' && <PGMembership unit={currentUnit} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />}
          {activeSubTab === 'ops' && <PGOps unit={currentUnit} />}
          {activeSubTab === 'reports' && <PGReports unit={currentUnit} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />}
          {activeSubTab === 'leaders' && <PGLeaders unit={currentUnit} />}
        </main>
      </div>
    </div>
  );
};

export default PGManagerLayout;
