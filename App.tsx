
import React, { useState, lazy, Suspense, useEffect, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import BibleStudyForm from './components/Forms/BibleStudyForm';
import BibleClassForm from './components/Forms/BibleClassForm';
import SmallGroupForm from './components/Forms/SmallGroupForm';
import StaffVisitForm from './components/Forms/StaffVisitForm';
import Login from './components/Login';
import Profile from './components/Profile';
import ConfirmationModal from './components/Shared/ConfirmationModal';
import { Unit } from './types';
import { useApp } from './contexts/AppContext';
import { useAuth } from './contexts/AuthContext';
import { useAppFlow } from './hooks/useAppFlow';

// Lazy Loading para abas administrativas
const Reports = lazy(() => import('./components/Reports'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const PGManager = lazy(() => import('./components/PGManagement/PGManagerLayout'));

const App: React.FC = () => {
  const {
    users, bibleStudies, bibleClasses, smallGroups, staffVisits,
    proSectors, config, isSyncing, isConnected, loadFromCloud, saveToCloud, saveRecord, deleteRecord
  } = useApp();

  const { isAuthenticated, currentUser, login, logout, updateCurrentUser, loginError } = useAuth();

  const {
    activeTab, isPending, setActiveTab,
    currentUnit, setCurrentUnit,
    editingItem, setEditingItem,
    itemToDelete, setItemToDelete,
    handleSaveItem, confirmDeletion, getVisibleHistory
  } = useAppFlow({ currentUser, saveRecord, deleteRecord });

  // Controle de abas já visitadas (para não carregar tudo de uma vez)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['dashboard']));

  useEffect(() => {
    if (activeTab) {
      setVisitedTabs(prev => new Set(prev).add(activeTab));
    }
  }, [activeTab]);

  useEffect(() => {
    if (['bibleStudy', 'bibleClass', 'smallGroup', 'staffVisit'].includes(activeTab)) {
        setEditingItem(null);
        // O scroll é mantido por aba agora, mas resetamos apenas ao trocar explicitamente
    }
  }, [activeTab, setEditingItem]);

  const unitSectors = useMemo(() => 
    proSectors.filter(s => s.unit === currentUnit).map(s => s.name).sort(), 
  [proSectors, currentUnit]);

  if (!isAuthenticated || !currentUser) {
    return <Login onLogin={login} isSyncing={isSyncing} errorMsg={loginError} isConnected={isConnected} config={config} />;
  }

  // Fallback local para não apagar a tela global
  const TabLoading = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
      <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preparando tela...</p>
    </div>
  );

  const getTabClass = (id: string) => {
    return `transition-opacity duration-300 ${activeTab === id ? 'block opacity-100' : 'hidden opacity-0'}`;
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} userRole={currentUser.role} isSyncing={isSyncing} isConnected={isConnected} config={config} onLogout={logout}>
      <div className="max-w-7xl mx-auto px-2 md:px-0 relative">
        
        {/* Overlay de carregamento suave durante a transição useTransition */}
        {isPending && (
          <div className="fixed top-0 right-0 p-8 z-[200] animate-pulse">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
          </div>
        )}

        <ConfirmationModal 
          isOpen={!!itemToDelete}
          title="Excluir Registro?"
          message="Esta ação é permanente e não pode ser desfeita."
          onConfirm={confirmDeletion}
          onCancel={() => setItemToDelete(null)}
        />

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
        
        {/* MECANISMO DE PERSISTÊNCIA (KEEP-ALIVE) */}
        <div id="main-content-wrapper" className="relative min-h-[70vh]">
          
          {/* Dashboard - Sempre montado para velocidade máxima */}
          <div className={getTabClass('dashboard')}>
            <Dashboard 
              studies={bibleStudies} 
              classes={bibleClasses} 
              groups={smallGroups} 
              visits={staffVisits} 
              currentUser={currentUser} 
              config={config} 
              onGoToTab={setActiveTab} 
              onUpdateConfig={c => saveToCloud({config: c}, false)} 
              onUpdateUser={u => saveRecord('users', u)} 
            />
          </div>

          {/* Formulários Principais - Montados sob demanda e mantidos na memória */}
          {visitedTabs.has('bibleStudy') && (
            <div className={getTabClass('bibleStudy')}>
              <BibleStudyForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} history={getVisibleHistory(bibleStudies)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} />
            </div>
          )}

          {visitedTabs.has('bibleClass') && (
            <div className={getTabClass('bibleClass')}>
              <BibleClassForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={unitSectors} history={getVisibleHistory(bibleClasses)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} />
            </div>
          )}

          {visitedTabs.has('smallGroup') && (
            <div className={getTabClass('smallGroup')}>
              <SmallGroupForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(smallGroups)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />
            </div>
          )}

          {visitedTabs.has('staffVisit') && (
            <div className={getTabClass('staffVisit')}>
              <StaffVisitForm currentUser={currentUser} users={users} onToggleReturn={id => { const item = staffVisits.find(v=>v.id===id); if(item) saveRecord('staffVisits', {...item, returnCompleted: !item.returnCompleted}); }} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(staffVisits)} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />
            </div>
          )}

          {/* Abas Administrativas (Lazy) - Cada uma com seu Suspense individual para não travar a UI */}
          {visitedTabs.has('reports') && (
            <div className={getTabClass('reports')}>
              <Suspense fallback={<TabLoading />}>
                <Reports studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} users={users} currentUser={currentUser} config={config} onRefresh={() => loadFromCloud(true)} />
              </Suspense>
            </div>
          )}

          {visitedTabs.has('pgManagement') && (
            <div className={getTabClass('pgManagement')}>
              <Suspense fallback={<TabLoading />}>
                <PGManager />
              </Suspense>
            </div>
          )}

          {visitedTabs.has('users') && (
            <div className={getTabClass('users')}>
              <Suspense fallback={<TabLoading />}>
                <UserManagement users={users} currentUser={currentUser} onUpdateUsers={async u => { await saveToCloud({ users: u }, true); }} />
              </Suspense>
            </div>
          )}

          {visitedTabs.has('profile') && (
            <div className={getTabClass('profile')}>
              <Suspense fallback={<TabLoading />}>
                {currentUser && <Profile user={currentUser} isSyncing={isSyncing} onUpdateUser={u => { updateCurrentUser(u); saveRecord('users', u); }} />}
              </Suspense>
            </div>
          )}

          {visitedTabs.has('admin') && (
            <div className={getTabClass('admin')}>
              <Suspense fallback={<TabLoading />}>
                <AdminPanel />
              </Suspense>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
};

export default App;
