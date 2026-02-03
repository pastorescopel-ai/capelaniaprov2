
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

// Lazy Loading para abas pesadas
const Reports = lazy(() => import('./components/Reports'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const ImportCenter = lazy(() => import('./components/Admin/ImportCenter'));

const App: React.FC = () => {
  const {
    users, bibleStudies, bibleClasses, smallGroups, staffVisits, masterLists,
    proStaff, proSectors, proGroups,
    config, isSyncing, isConnected, loadFromCloud, saveToCloud, saveRecord, deleteRecord, applySystemOverrides, importFromDNA
  } = useApp();

  const { isAuthenticated, currentUser, login, logout, updateCurrentUser, loginError } = useAuth();

  const {
    activeTab, setActiveTab,
    currentUnit, setCurrentUnit,
    editingItem, setEditingItem,
    itemToDelete, setItemToDelete,
    handleSaveItem, confirmDeletion, getVisibleHistory
  } = useAppFlow({ currentUser, saveRecord, deleteRecord });

  useEffect(() => {
    if (['bibleStudy', 'bibleClass', 'smallGroup', 'staffVisit'].includes(activeTab)) {
        setEditingItem(null);
        setTimeout(() => {
          const container = document.getElementById('main-scroll-container');
          if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
    }
  }, [activeTab]);

  // Fontes de Dados Relacionais Filtradas
  const unitSectors = useMemo(() => 
    proSectors.filter(s => s.unit === currentUnit).map(s => s.name).sort(), 
  [proSectors, currentUnit]);

  if (!isAuthenticated || !currentUser) {
    return <Login onLogin={login} isSyncing={isSyncing} errorMsg={loginError} isConnected={isConnected} config={config} />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} userRole={currentUser.role} isSyncing={isSyncing} isConnected={isConnected} config={config} onLogout={logout}>
      <div className="max-w-7xl mx-auto px-2 md:px-0">
        
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
                onClick={() => {
                   setCurrentUnit(u);
                   const container = document.getElementById('main-scroll-container');
                   if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
                }} 
                className={`px-8 py-2.5 rounded-full font-black text-[10px] uppercase transition-all ${currentUnit === u ? 'text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`} 
                style={{ backgroundColor: currentUnit === u ? (config.primaryColor || '#005a9c') : undefined }}
              >
                Unidade {u}
              </button>
            ))}
          </div>
        )}
        
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Dados...</p>
          </div>
        }>
          {activeTab === 'dashboard' && <Dashboard studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} currentUser={currentUser} config={config} onGoToTab={setActiveTab} onUpdateConfig={c => saveToCloud({config: c}, false)} onUpdateUser={u => saveRecord('users', u)} />}
          
          {activeTab === 'bibleStudy' && <BibleStudyForm currentUser={currentUser} users={users} masterLists={masterLists} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} history={getVisibleHistory(bibleStudies)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} />}
          
          {activeTab === 'bibleClass' && <BibleClassForm currentUser={currentUser} users={users} masterLists={masterLists} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={unitSectors} history={getVisibleHistory(bibleClasses)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} />}
          
          {activeTab === 'smallGroup' && <SmallGroupForm currentUser={currentUser} users={users} masterLists={masterLists} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(smallGroups)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />}
          
          {activeTab === 'staffVisit' && <StaffVisitForm currentUser={currentUser} users={users} masterLists={masterLists} onToggleReturn={id => { const item = staffVisits.find(v=>v.id===id); if(item) saveRecord('staffVisits', {...item, returnCompleted: !item.returnCompleted}); }} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(staffVisits)} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />}
          
          {activeTab === 'reports' && <Reports studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} users={users} currentUser={currentUser} masterLists={masterLists} config={config} onRefresh={() => loadFromCloud(true)} />}
          
          {activeTab === 'users' && <UserManagement users={users} currentUser={currentUser} onUpdateUsers={async u => { await saveToCloud({ users: u }, true); }} />}
          
          {activeTab === 'profile' && currentUser && <Profile user={currentUser} isSyncing={isSyncing} onUpdateUser={u => { updateCurrentUser(u); saveRecord('users', u); }} />}
          
          {activeTab === 'admin' && (
            <div className="space-y-12">
                <ImportCenter />
                <AdminPanel config={config} masterLists={masterLists} users={users} currentUser={currentUser} bibleStudies={bibleStudies} bibleClasses={bibleClasses} smallGroups={smallGroups} staffVisits={staffVisits} onSaveAllData={async (c, l) => { await saveToCloud({ config: applySystemOverrides(c), masterLists: l }, true); }} onRestoreFullDNA={async (db) => { return await importFromDNA(db); }} onRefreshData={() => loadFromCloud(true)} />
            </div>
          )}
        </Suspense>
      </div>
    </Layout>
  );
};

export default App;
