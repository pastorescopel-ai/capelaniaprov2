import React, { lazy, Suspense, useMemo } from 'react';
import { Unit, User } from '../types';
import { useAppOperations } from '../hooks/useAppOperations';
import { useApp } from '../contexts/AppProvider';
import { useBible } from '../contexts/BibleContext';
import { usePro } from '../contexts/ProContext';

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
const ActivityManager = lazy(() => import('./Activities/ActivityManager'));

interface MainContentProps {
  activeTab: string;
  activitiesSubTab?: 'analysis' | 'checklist' | 'scheduler' | 'reports';
  visitedTabs: Set<string>;
  currentUser: User;
  currentUnit: Unit;
  unitSectors: string[];
  editingItem: any;
  isLoading: boolean;
  
  // Actions
  setActiveTab: (tab: string) => void;
  setCurrentUnit: (unit: Unit) => void;
  setEditingItem: (item: any) => void;
  setItemToDelete: (data: {type: string, id: string}) => void;
  updateCurrentUser: (user: User) => void;
  handleSaveItem: (type: string, data: any) => void;
  onRegisterMission: (visit: any) => void;
  onGoToReturnHistory: (visit?: any) => void;
  getVisibleHistory: (list: any[]) => any[];
}

const TabLoading = () => (
  <div className="flex flex-col space-y-6 animate-pulse p-4 md:p-8">
    <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-3">
          <div className="h-8 bg-slate-200 rounded-xl w-48"></div>
          <div className="h-3 bg-slate-100 rounded-lg w-32"></div>
        </div>
        <div className="flex gap-2">
          <div className="w-10 h-10 bg-slate-100 rounded-xl"></div>
          <div className="w-10 h-10 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-3 bg-slate-100 rounded-lg w-20 ml-2"></div>
            <div className="h-14 bg-slate-50 rounded-2xl border border-slate-100"></div>
          </div>
        ))}
      </div>
      <div className="h-16 bg-slate-200 rounded-2xl w-full mt-4"></div>
    </div>
    <div className="space-y-4">
      <div className="h-4 bg-slate-100 rounded-lg w-40 ml-2"></div>
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-white rounded-[2rem] border border-slate-100 shadow-sm"></div>
      ))}
    </div>
  </div>
);

const MainContent: React.FC<MainContentProps> = (props) => {
  const {
    activeTab, activitiesSubTab, visitedTabs, currentUser, currentUnit, unitSectors, editingItem, isLoading,
    setActiveTab, setCurrentUnit, setEditingItem, setItemToDelete,
    updateCurrentUser, handleSaveItem, onRegisterMission, onGoToReturnHistory, getVisibleHistory
  } = props;

  const {
    users, config, smallGroups, staffVisits,
    saveToCloud, saveRecord, loadFromCloud 
  } = useApp();

  const { bibleStudies, bibleClasses } = useBible();
  const { proSectors, proGroups, proGroupMembers, proGroupProviderMembers, proStaff, proProviders, proMonthlyStats, ambassadors } = usePro();

  const { handleTransfer, getTabClass } = useAppOperations({
    bibleStudies,
    bibleClasses,
    users,
    saveRecord,
    activeTab
  });

  const renderTab = (tabId: string) => {
    switch (tabId) {
      case 'dashboard':
        return (
          <Dashboard 
            studies={bibleStudies} 
            classes={bibleClasses} 
            groups={smallGroups} 
            visits={staffVisits} 
            currentUser={currentUser} 
            config={config} 
            onGoToTab={setActiveTab} 
            onRegisterMission={onRegisterMission}
            onGoToReturnHistory={onGoToReturnHistory}
            onUpdateConfig={c => saveToCloud({config: c}, false)} 
            onUpdateUser={u => saveRecord('users', u)} 
          />
        );
      case 'bibleStudy':
        return <BibleStudyForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} history={getVisibleHistory(bibleStudies)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} onTransfer={handleTransfer} />;
      case 'bibleClass':
        return <BibleClassForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={unitSectors} history={getVisibleHistory(bibleClasses)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} onTransfer={handleTransfer} />;
      case 'smallGroup':
        return <SmallGroupForm currentUser={currentUser} users={users} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(smallGroups)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />;
      case 'staffVisit':
        return <StaffVisitForm currentUser={currentUser} users={users} onToggleReturn={id => { const item = staffVisits.find(v=>v.id===id); if(item) saveRecord('staffVisits', {...item, returnCompleted: !item.returnCompleted}); }} editingItem={editingItem} isLoading={isLoading} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} history={getVisibleHistory(staffVisits)} allHistory={staffVisits} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />;
      case 'reports':
        return <Reports studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} users={users} currentUser={currentUser} config={config} onRefresh={() => loadFromCloud(true)} />;
      case 'pgManagement':
        return <PGManager />;
      case 'ambassadors':
        return <AmbassadorsManager />;
      case 'users':
        return <UserManagement users={users} currentUser={currentUser} onUpdateUsers={async u => { await saveToCloud({ users: u }, true); }} />;
      case 'profile':
        return currentUser && <Profile user={currentUser} isSyncing={isLoading} onUpdateUser={u => { updateCurrentUser(u); saveRecord('users', u); }} />;
      case 'admin':
        return <AdminPanel />;
      case 'dataHealing':
        return <DataHealer />;
      case 'activities':
        return <ActivityManager isActive={activeTab === 'activities'} initialSubTab={activitiesSubTab} />;
      default:
        return null;
    }
  };

  return (
    <div id="main-content-wrapper" className="relative min-h-[70vh]">
      {Array.from(visitedTabs).map((tabId) => {
        const isVisible = activeTab === tabId;
        
        return (
          <div key={tabId} className={`${getTabClass(tabId)} ${isVisible ? 'block' : 'hidden'} ${isVisible ? 'animate-in fade-in slide-in-from-bottom-4 duration-300' : ''}`}>
            <Suspense fallback={<TabLoading />}>
              {renderTab(tabId)}
            </Suspense>
          </div>
        );
      })}
    </div>
  );
};

export default MainContent;
