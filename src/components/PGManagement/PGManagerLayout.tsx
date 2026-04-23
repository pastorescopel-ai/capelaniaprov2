
import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { Unit } from '../../types';
import PGDashboard from './PGDashboard';
import PGMembership from './PGMembership';
import PGReports from './PGReports';
import PGOps from './PGOps';
import PGLeaders from './PGLeaders';
import PGClosing from './PGClosing';
import PGTools from './PGTools';
import { useApp } from '../../hooks/useApp';

interface PGManagerLayoutProps {
  editingItem?: any;
  onCancelEdit?: () => void;
}

const PGManagerLayout: React.FC<PGManagerLayoutProps> = ({ editingItem, onCancelEdit }) => {
  const { proMonthlyStats, config } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'membership' | 'ops' | 'reports' | 'leaders' | 'fechamento' | 'tools'>(() => {
    return editingItem?.isVisitRequest ? 'ops' : 'dashboard';
  });

  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  const [isPending, startTransition] = useTransition();

  // Lógica para notificação de fechamento de mês
  const previousMonthClosed = useCallback(() => {
    // Normaliza a competência ativa para garantir o formato YYYY-MM-01
    const rawActive = config.activeCompetenceMonth || new Date().toLocaleDateString('en-CA');
    const activeComp = rawActive.substring(0, 7) + '-01';
    
    // Mes "esperado" para estar fechado (mês anterior ao atual real)
    const now = new Date();
    const expectedPrevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const expectedPrevISO = expectedPrevDate.toLocaleDateString('en-CA');
    
    // 1. Verifica se já existe snapshot no banco para o mês que deveria estar fechado
    // Considera tanto o fechamento global (all) quanto o específico da unidade
    const hasSnapshot = proMonthlyStats.some(s => 
      s.month === expectedPrevISO && (s.unit === currentUnit || s.targetId === 'all')
    );
    
    // 2. Verifica se a competência ativa já avançou (se activeComp >= hoje, está em dia)
    const currentMonthISO = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
    const competenceIsCurrent = activeComp >= currentMonthISO;

    return hasSnapshot && competenceIsCurrent;
  }, [proMonthlyStats, config.activeCompetenceMonth, currentUnit]);

  const getPendingMonthLabel = () => {
    const now = new Date();
    const currentMonthISO = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
    const rawActive = config.activeCompetenceMonth || currentMonthISO;
    const activeComp = rawActive.substring(0, 7) + '-01';

    let targetDate: Date;
    if (activeComp < currentMonthISO) {
        // Se a competência está atrasada, o foco é a própria competência
        targetDate = new Date(activeComp + 'T12:00:00');
    } else {
        // Caso contrário, o foco é o mês anterior que pode não ter snapshot ainda
        targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }
    return targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  useEffect(() => {
    const container = document.getElementById('main-scroll-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeSubTab, currentUnit]);

  const handleTabChange = (tabId: 'dashboard' | 'membership' | 'ops' | 'reports' | 'leaders' | 'fechamento' | 'tools') => {
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
    { id: 'tools', label: 'Ferramentas', icon: 'fas fa-tools' },
    { id: 'fechamento', label: 'Fechamento', icon: 'fas fa-lock' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
      
      {/* Notificação de Fechamento Pendente */}
      {!previousMonthClosed() && activeSubTab !== 'fechamento' && (
        <div className="max-w-7xl mx-auto bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4 animate-bounce-subtle shadow-sm">
          <div className="flex items-center gap-3 text-amber-800">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-lg"></i>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-tight">Fechamento Pendente</p>
              <p className="text-[10px] font-bold opacity-80">O mês de <span className="uppercase">{getPendingMonthLabel()}</span> ainda não foi encerrado oficialmente.</p>
            </div>
          </div>
          <button 
            onClick={() => handleTabChange('fechamento')}
            className="px-4 py-2 bg-amber-600 text-white text-[9px] font-black uppercase rounded-xl hover:bg-amber-700 transition-all shadow-sm"
          >
            Ir para Fechamento
          </button>
        </div>
      )}

      <div className="sticky top-[-1rem] md:top-[-2rem] z-[100] -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-[#f1f5f9]/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto space-y-6">
          
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
            
            <div className="flex bg-slate-100 p-1 rounded-xl md:rounded-2xl border border-slate-200 self-end md:self-auto">
              {[Unit.HAB, Unit.HABA].map(u => (
                <button 
                  key={u} 
                  onClick={() => handleUnitChange(u)} 
                  className={`px-6 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl font-black text-[9px] md:text-[10px] uppercase transition-all ${
                    currentUnit === u 
                      ? 'bg-[#005a9c] text-white shadow-lg scale-105' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Unidade {u}
                </button>
              ))}
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
          {activeSubTab === 'dashboard' && <PGDashboard key={config.activeCompetenceMonth || 'default'} unit={currentUnit} />}
          {activeSubTab === 'membership' && <PGMembership unit={currentUnit} />}
          {activeSubTab === 'ops' && (
            <PGOps 
              unit={currentUnit} 
              editingItem={editingItem?.isVisitRequest ? editingItem : undefined} 
              onCancelEdit={onCancelEdit}
            />
          )}
          {activeSubTab === 'reports' && <PGReports unit={currentUnit} />}
          {activeSubTab === 'leaders' && <PGLeaders unit={currentUnit} />}
          {activeSubTab === 'tools' && <PGTools unit={currentUnit} />}
          {activeSubTab === 'fechamento' && <PGClosing unit={currentUnit} />}
        </main>
      </div>
    </div>
  );
};

export default PGManagerLayout;
