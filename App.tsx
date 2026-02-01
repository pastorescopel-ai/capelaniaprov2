import React, { useState, lazy, Suspense, useEffect } from 'react';
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

const App: React.FC = () => {
  const {
    users, bibleStudies, bibleClasses, smallGroups, staffVisits, masterLists,
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

  // LÓGICA DE NAVEGAÇÃO PROATIVA:
  // Sempre que mudar a aba ativa para um formulário, força o scroll para o topo 
  // e cancela qualquer edição pendente para mostrar o campo de "Novo Registro"
  useEffect(() => {
    if (['bibleStudy', 'bibleClass', 'smallGroup', 'staffVisit'].includes(activeTab)) {
        // Resetar para o formulário de novo registro (evita carregar um histórico antigo no topo)
        setEditingItem(null);
        
        // Pequeno delay para garantir que o DOM renderizou o novo conteúdo
        setTimeout(() => {
          const container = document.getElementById('main-scroll-container');
          if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 100);
    }
  }, [activeTab]);

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
                   // Também rola para o topo ao trocar de unidade
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
            <div className="relative">
              <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <i className="fas fa-hospital-symbol text-blue-500 text-xl animate-pulse"></i>
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">Preparando Ambiente</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Sincronizando com Supabase Cloud</p>
            </div>
          </div>
        }>
          {activeTab === 'dashboard' && <Dashboard studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} currentUser={currentUser} config={config} onGoToTab={setActiveTab} onUpdateConfig={c => saveToCloud({config: c}, false)} onUpdateUser={u => saveRecord('users', u)} />}
          
          {activeTab === 'bibleStudy' && <BibleStudyForm currentUser={currentUser} users={users} masterLists={masterLists} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleStudies)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} onTransfer={(t, id, n) => { saveRecord('bibleStudies', { ...bibleStudies.find(s=>s.id===id), userId: n }); }} />}
          
          {activeTab === 'bibleClass' && <BibleClassForm currentUser={currentUser} users={users} masterLists={masterLists} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleClasses)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} onTransfer={(t, id, n) => { saveRecord('bibleClasses', { ...bibleClasses.find(c=>c.id===id), userId: n }); }} />}
          
          {activeTab === 'smallGroup' && <SmallGroupForm currentUser={currentUser} users={users} masterLists={masterLists} groupsList={currentUnit === Unit.HAB ? masterLists.groupsHAB : masterLists.groupsHABA} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(smallGroups)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />}
          
          {activeTab === 'staffVisit' && <StaffVisitForm currentUser={currentUser} users={users} masterLists={masterLists} onToggleReturn={id => { const item = staffVisits.find(v=>v.id===id); if(item) saveRecord('staffVisits', {...item, returnCompleted: !item.returnCompleted}); }} staffList={currentUnit === Unit.HAB ? masterLists.staffHAB : masterLists.staffHABA} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(staffVisits)} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />}
          
          {activeTab === 'reports' && <Reports studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} users={users} currentUser={currentUser} masterLists={masterLists} config={config} onRefresh={() => loadFromCloud(true)} />}
          
          {activeTab === 'users' && <UserManagement users={users} currentUser={currentUser} onUpdateUsers={async u => { await saveToCloud({ users: u }, true); }} />}
          
          {activeTab === 'profile' && currentUser && <Profile user={currentUser} isSyncing={isSyncing} onUpdateUser={u => { updateCurrentUser(u); saveRecord('users', u); }} />}
          
          {activeTab === 'admin' && <AdminPanel config={config} masterLists={masterLists} users={users} currentUser={currentUser} bibleStudies={bibleStudies} bibleClasses={bibleClasses} smallGroups={smallGroups} staffVisits={staffVisits} onSaveAllData={async (c, l) => { await saveToCloud({ config: applySystemOverrides(c), masterLists: l }, true); }} onRestoreFullDNA={async (db) => { return await importFromDNA(db); }} onRefreshData={() => loadFromCloud(true)} />}
        </Suspense>
      </div>
    </Layout>
  );
};

export default App;