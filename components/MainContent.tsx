
import React, { lazy, Suspense } from 'react';
import { Unit, User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config } from '../types';
import Dashboard from './Dashboard';
import BibleStudyForm from './Forms/BibleStudyForm';
import BibleClassForm from './Forms/BibleClassForm';
import SmallGroupForm from './Forms/SmallGroupForm';
import StaffVisitForm from './Forms/StaffVisitForm';
import Profile from './Profile';
import { useToast } from '../contexts/ToastContext';

// Lazy Imports
const Reports = lazy(() => import('./Reports'));
const UserManagement = lazy(() => import('./UserManagement'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const PGManager = lazy(() => import('./PGManagement/PGManagerLayout'));
const DataHealer = lazy(() => import('./DataHealer')); // Importação Lazy

interface MainContentProps {
  activeTab: string;
  visitedTabs: Set<string>;
  currentUser: User;
  users: User[];
  bibleStudies: BibleStudy[];
  bibleClasses: BibleClass[];
  smallGroups: SmallGroup[];
  staffVisits: StaffVisit[];
  config: Config;
  currentUnit: Unit;
  unitSectors: string[];
  editingItem: any;
  isLoading: boolean;
  
  // Actions
  setActiveTab: (tab: string) => void;
  setCurrentUnit: (unit: Unit) => void;
  setEditingItem: (item: any) => void;
  setItemToDelete: (data: {type: string, id: string}) => void;
  saveToCloud: (overrides?: any, showLoader?: boolean) => Promise<boolean>;
  saveRecord: (collection: string, item: any) => Promise<boolean>;
  updateCurrentUser: (user: User) => void;
  handleSaveItem: (type: string, data: any) => void;
  getVisibleHistory: (list: any[]) => any[];
  loadFromCloud: (showLoader?: boolean) => Promise<void>;
}

const MainContent: React.FC<MainContentProps> = ({
  activeTab, visitedTabs, currentUser, users, bibleStudies, bibleClasses, smallGroups, staffVisits,
  config, currentUnit, unitSectors, editingItem, isLoading,
  setActiveTab, setCurrentUnit, setEditingItem, setItemToDelete, saveToCloud, saveRecord,
  updateCurrentUser, handleSaveItem, getVisibleHistory, loadFromCloud
}) => {
  const { showToast } = useToast();

  const TabLoading = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
      <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preparando tela...</p>
    </div>
  );

  const handleTransfer = async (type: string, id: string, newUserId: string) => {
    let collectionName = '';
    let itemToUpdate: any = null;

    if (type === 'study') {
      collectionName = 'bibleStudies';
      itemToUpdate = bibleStudies.find(i => i.id === id);
    } else if (type === 'class') {
      collectionName = 'bibleClasses';
      itemToUpdate = bibleClasses.find(i => i.id === id);
    }

    if (collectionName && itemToUpdate) {
      const updatedItem = { ...itemToUpdate, userId: newUserId, updatedAt: Date.now() };
      const success = await saveRecord(collectionName, updatedItem);
      
      const targetUser = users.find(u => u.id === newUserId)?.name || "Outro Capelão";
      
      if (success) {
        showToast(`Registro transferido para ${targetUser}`, "success");
      } else {
        showToast("Erro ao transferir registro.", "warning");
      }
    }
  };

  // Mantém cache visual apenas para Dashboard e telas pesadas
  const getTabClass = (id: string) => 
    `transition-opacity duration-300 ${activeTab === id ? 'block opacity-100' : 'hidden opacity-0'}`;

  return (
    <div id="main-content-wrapper" className="relative min-h-[70vh]">
      
      {/* Dashboard (Mantém Cache para Performance) */}
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

      {/* Formulários: RESETAM AO SAIR (Unmount) */}
      {activeTab === 'bibleStudy' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <BibleStudyForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} history={getVisibleHistory(bibleStudies)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} onTransfer={handleTransfer} />
        </div>
      )}

      {activeTab === 'bibleClass' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <BibleClassForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={unitSectors} history={getVisibleHistory(bibleClasses)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} onTransfer={handleTransfer} />
        </div>
      )}

      {activeTab === 'smallGroup' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <SmallGroupForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(smallGroups)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />
        </div>
      )}

      {activeTab === 'staffVisit' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <StaffVisitForm currentUser={currentUser} users={users} onToggleReturn={id => { const item = staffVisits.find(v=>v.id===id); if(item) saveRecord('staffVisits', {...item, returnCompleted: !item.returnCompleted}); }} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(staffVisits)} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />
        </div>
      )}

      {/* Lazy Routes (Mantém Cache se visitado, mas oculta) */}
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
            {currentUser && <Profile user={currentUser} isSyncing={isLoading} onUpdateUser={u => { updateCurrentUser(u); saveRecord('users', u); }} />}
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

      {/* Rota para Cura de Dados (NOVO) */}
      {visitedTabs.has('dataHealing') && (
        <div className={getTabClass('dataHealing')}>
          <Suspense fallback={<TabLoading />}>
            <DataHealer />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default MainContent;
