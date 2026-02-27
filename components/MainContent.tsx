
import React, { lazy, Suspense } from 'react';
import { Unit, User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config } from '../types';
import { useAppOperations } from '../hooks/useAppOperations';

// Lazy Imports
const Dashboard = lazy(() => import('./Dashboard'));
const BibleStudyForm = lazy(() => import('./Forms/BibleStudyForm'));
const BibleClassForm = lazy(() => import('./Forms/BibleClassForm'));
const SmallGroupForm = lazy(() => import('./Forms/SmallGroupForm'));
const StaffVisitForm = lazy(() => import('./Forms/StaffVisitForm'));
const Profile = lazy(() => import('./Profile'));
const Reports = lazy(() => import('./Reports'));
const UserManagement = lazy(() => import('./UserManagement'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const PGManager = lazy(() => import('./PGManagement/PGManagerLayout'));
const AmbassadorsManager = lazy(() => import('./Ambassadors/AmbassadorsManager'));
const DataHealer = lazy(() => import('./DataHealer'));

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

const TabLoading = () => (
  <div className="flex flex-col space-y-6 animate-pulse p-4 md:p-8">
    {/* Skeleton Header */}
    <div className="flex items-center gap-4 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
      <div className="w-12 h-12 bg-slate-200 rounded-2xl"></div>
      <div className="flex-1 space-y-2">
        <div className="h-6 bg-slate-200 rounded-lg w-1/3"></div>
        <div className="h-3 bg-slate-100 rounded-lg w-1/4"></div>
      </div>
    </div>
    
    {/* Skeleton Content Blocks */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="h-40 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm"></div>
      <div className="h-40 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm"></div>
    </div>
    <div className="h-64 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm"></div>
  </div>
);

const MainContent: React.FC<MainContentProps> = ({
  activeTab, visitedTabs, currentUser, users, bibleStudies, bibleClasses, smallGroups, staffVisits,
  config, currentUnit, unitSectors, editingItem, isLoading,
  setActiveTab, setCurrentUnit, setEditingItem, setItemToDelete, saveToCloud, saveRecord,
  updateCurrentUser, handleSaveItem, getVisibleHistory, loadFromCloud
}) => {
  const { handleTransfer, getTabClass } = useAppOperations({
    bibleStudies,
    bibleClasses,
    users,
    saveRecord,
    activeTab
  });

  return (
    <div id="main-content-wrapper" className="relative min-h-[70vh]">
      
      {/* Dashboard (Mantém Cache para Performance) */}
      <div className={getTabClass('dashboard')}>
        <Suspense fallback={<TabLoading />}>
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
        </Suspense>
      </div>

      {/* Formulários: RESETAM AO SAIR (Unmount) */}
      {activeTab === 'bibleStudy' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Suspense fallback={<TabLoading />}>
            <BibleStudyForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} history={getVisibleHistory(bibleStudies)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} onTransfer={handleTransfer} />
          </Suspense>
        </div>
      )}

      {activeTab === 'bibleClass' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Suspense fallback={<TabLoading />}>
            <BibleClassForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={unitSectors} history={getVisibleHistory(bibleClasses)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} onTransfer={handleTransfer} />
          </Suspense>
        </div>
      )}

      {activeTab === 'smallGroup' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Suspense fallback={<TabLoading />}>
            <SmallGroupForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(smallGroups)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />
          </Suspense>
        </div>
      )}

      {activeTab === 'staffVisit' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Suspense fallback={<TabLoading />}>
            <StaffVisitForm currentUser={currentUser} users={users} onToggleReturn={id => { const item = staffVisits.find(v=>v.id===id); if(item) saveRecord('staffVisits', {...item, returnCompleted: !item.returnCompleted}); }} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(staffVisits)} allHistory={staffVisits} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />
          </Suspense>
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

      {visitedTabs.has('ambassadors') && (
        <div className={getTabClass('ambassadors')}>
          <Suspense fallback={<TabLoading />}>
            <AmbassadorsManager />
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
