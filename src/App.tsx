
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Layout from './components/Layout';
import Login from './components/Login';
import ConfirmationModal from './components/Shared/ConfirmationModal';
import MainContent from './components/MainContent';
import ErrorBoundary from './components/ErrorBoundary';
import { Unit } from './types/enums';
import { useApp } from './hooks/useApp';
import { useBible } from './contexts/BibleContext';
import { usePro } from './contexts/ProContext';
import { useAuth } from './contexts/AuthContext';
import { useAppFlow } from './hooks/useAppFlow';

import { ensureISODate } from './utils/formatters';

const App: React.FC = () => {
  const {
    users, smallGroups, staffVisits,
    config, isSyncing, isConnected, loadFromCloud, saveToCloud, saveRecord, deleteRecord,
    activitySchedules, dailyActivityReports, editAuthorizations
  } = useApp();

  const { bibleStudies, bibleClasses } = useBible();
  const { proSectors } = usePro();

  const { isAuthenticated, currentUser, login, logout, updateCurrentUser, loginError, isAuthLoading } = useAuth();

  const {
    activeTab, isPending, setActiveTab,
    currentUnit, setCurrentUnit,
    editingItem, setEditingItem,
    itemToDelete, setItemToDelete,
    handleSaveItem, confirmDeletion, getVisibleHistory
  } = useAppFlow({ currentUser, saveRecord, deleteRecord, editAuthorizations });

  const [isTabTransitionPending, startTabTransition] = React.useTransition();

  // Controle de abas visitadas para renderização sob demanda (Performance)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['dashboard']));
  const [activitiesSubTab, setActivitiesSubTab] = useState<'analysis' | 'checklist' | 'scheduler' | 'reports' | undefined>(undefined);
  const skipClearRef = React.useRef(false);

  const handleTabChange = (tab: string, subTab?: any) => {
    startTabTransition(() => {
      setActiveTab(tab);
      setVisitedTabs(prev => new Set(prev).add(tab));
      if (tab === 'activities' && subTab) {
        setActivitiesSubTab(subTab);
      } else if (tab !== 'activities') {
        setActivitiesSubTab(undefined);
      }
    });
  };

  const handleRegisterMission = (visit: any) => {
    skipClearRef.current = true;
    // Definir o item de edição com uma flag especial de missão
    setEditingItem({
      ...visit,
      isMission: true,
      groupName: visit.pgName,
      leader: visit.leaderName,
      leaderPhone: visit.leaderPhone || '',
      unit: visit.unit,
      date: ensureISODate(visit.date) || new Date().toLocaleDateString('en-CA'),
      scheduledTime: visit.scheduledTime,
      sectorId: visit.sectorId,
      sectorName: visit.sectorName
    });
    
    // Mudar a unidade se necessário
    if (visit.unit !== currentUnit) {
      setCurrentUnit(visit.unit);
    }
    
    // Mudar para a aba de Pequenos Grupos
    handleTabChange('smallGroup');
  };

  const handleEditVisitRequest = (request: any) => {
    // Definir como item de edição com flag de agendamento
    setEditingItem({
      ...request,
      isVisitRequest: true
    });
    
    // Mudar fuso se necessário
    if (request.unit !== currentUnit) {
      setCurrentUnit(request.unit);
    }
    
    // Mudar para Gestão de PGs (onde fica a escala)
    handleTabChange('pgManagement');
  };

  const handleGoToReturnHistory = (visit?: any) => {
    if (visit && visit.unit && visit.unit !== currentUnit) {
      setCurrentUnit(visit.unit);
    }
    
    handleTabChange('staffVisit');
    
    setTimeout(() => {
      const historyHeader = document.getElementById('return-history-header');
      if (historyHeader) {
        historyHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const historySection = document.getElementById('history-section');
        if (historySection) {
            historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 300);
  };

  useEffect(() => {
    if (['bibleStudy', 'bibleClass', 'smallGroup', 'staffVisit', 'ambassadors'].includes(activeTab)) {
        if (skipClearRef.current) {
            skipClearRef.current = false;
        } else {
            setEditingItem(null);
        }
    }
  }, [activeTab, setEditingItem]);

  const unitSectors = useMemo(() => 
    proSectors.filter(s => s.unit === currentUnit).map(s => s.name).sort(), 
  [proSectors, currentUnit]);

  // Splash Screen enquanto verifica a sessão
  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Iniciando Sessão</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Login onLogin={login} isSyncing={isSyncing} errorMsg={loginError} isConnected={isConnected} config={config} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={handleTabChange} 
      currentUser={currentUser} 
      isSyncing={isSyncing} 
      isConnected={isConnected} 
      config={config} 
      onLogout={logout}
      onGoToReturnHistory={handleGoToReturnHistory}
    >
      <ErrorBoundary>
        <div className="max-w-7xl mx-auto px-2 md:px-0 relative">
          
          {/* Loader de Transição Suave (Top Progress Bar) */}
          <AnimatePresence>
            {isPending && (
              <motion.div 
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="fixed top-0 left-0 right-0 h-1 bg-blue-500 z-[200] origin-left"
              />
            )}
          </AnimatePresence>
          
          {isPending && (
            <div className="fixed top-4 right-4 md:top-8 md:right-8 z-[200] animate-in fade-in zoom-in duration-300">
              <div className="bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest pr-2">Sincronizando</span>
              </div>
            </div>
          )}

          <ConfirmationModal 
            isOpen={!!itemToDelete}
            title="Excluir Registro?"
            message="Esta ação é permanente e não pode ser desfeita."
            onConfirm={confirmDeletion}
            onCancel={() => setItemToDelete(null)}
          />

          {/* Seletor de Unidade (Fixo no Topo para Formulários) */}
          {['bibleStudy', 'bibleClass', 'smallGroup', 'staffVisit'].includes(activeTab) && (
            <div className="mb-8 flex bg-white p-1.5 rounded-full shadow-sm border border-slate-100 max-w-fit mx-auto md:mx-0 animate-in slide-in-from-left duration-300">
              {[Unit.HAB, Unit.HABA].map(u => (
                <button 
                  key={u} 
                  onClick={() => setCurrentUnit(u)} 
                  className={`px-8 py-2.5 rounded-full font-black text-[10px] uppercase transition-all ${currentUnit === u ? 'text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`} 
                  style={{ backgroundColor: currentUnit === u ? (config.primaryColor || '#005a9c') : undefined }}
                >
                  Unidade {u}
                </button>
              ))}
            </div>
          )}
          
          {/* Conteúdo Principal Modularizado */}
          <MainContent 
            activeTab={activeTab}
            activitiesSubTab={activitiesSubTab}
            visitedTabs={visitedTabs}
            currentUser={currentUser}
            currentUnit={currentUnit}
            unitSectors={unitSectors}
            editingItem={editingItem}
            isLoading={isSyncing}
            setActiveTab={handleTabChange}
            setCurrentUnit={setCurrentUnit}
            setEditingItem={setEditingItem}
            setItemToDelete={setItemToDelete}
            updateCurrentUser={updateCurrentUser}
            handleSaveItem={handleSaveItem}
            onRegisterMission={handleRegisterMission}
            onEditVisitRequest={handleEditVisitRequest}
            onGoToReturnHistory={handleGoToReturnHistory}
            getVisibleHistory={getVisibleHistory}
          />

        </div>
      </ErrorBoundary>
    </Layout>
  );
};

export default App;
