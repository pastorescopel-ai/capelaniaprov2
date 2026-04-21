import React, { lazy, Suspense, useMemo } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { Unit, User } from '../types';
import { useAppOperations } from '../hooks/useAppOperations';
import { useApp } from '../contexts/AppContext';
import { useBible } from '../contexts/BibleContext';
import { usePro } from '../contexts/ProContext';

// Lazy Imports
const Dashboard = lazy(() => import('./Dashboard'));
const Reports = lazy(() => import('./Reports'));
const PGManager = lazy(() => import('./PGManagement/PGManagerLayout'));
const AmbassadorsManager = lazy(() => import('./Ambassadors/AmbassadorsManager'));
const DataHealer = lazy(() => import('./DataHealer'));
const ActivityManager = lazy(() => import('./Activities/ActivityManager'));

// Modular Components
const StaffModule = lazy(() => import('../modules/staff/StaffModule'));
const PGModule = lazy(() => import('../modules/pg/PGModule'));
const BibleModule = lazy(() => import('../modules/bible/BibleModule'));
const CoreModule = lazy(() => import('../modules/core/CoreModule'));

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
  onEditVisitRequest?: (request: any) => void;
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
    updateCurrentUser, handleSaveItem, onRegisterMission, onEditVisitRequest, onGoToReturnHistory, getVisibleHistory
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
            onEditRequest={onEditVisitRequest}
            onGoToReturnHistory={onGoToReturnHistory}
            onUpdateConfig={c => saveToCloud({config: c}, false)} 
            onUpdateUser={u => saveRecord('users', u)} 
          />
        );
      case 'bibleStudy':
        return (
          <BibleModule 
            type="study" 
            currentUser={currentUser} 
            users={users} 
            editingItem={editingItem} 
            isLoading={isLoading} 
            onCancelEdit={() => setEditingItem(null)} 
            allHistory={bibleStudies} 
            unit={currentUnit} 
            history={getVisibleHistory(bibleStudies)} 
            setItemToDelete={setItemToDelete} 
            onEdit={setEditingItem} 
            handleTransfer={handleTransfer} 
          />
        );
      case 'bibleClass':
        return (
          <BibleModule 
            type="class" 
            currentUser={currentUser} 
            users={users} 
            editingItem={editingItem} 
            isLoading={isLoading} 
            onCancelEdit={() => setEditingItem(null)} 
            allHistory={bibleClasses} 
            unit={currentUnit} 
            sectors={unitSectors} 
            history={getVisibleHistory(bibleClasses)} 
            setItemToDelete={setItemToDelete} 
            onEdit={setEditingItem} 
            handleTransfer={handleTransfer} 
          />
        );
      case 'smallGroup':
        return (
          <PGModule 
            currentUser={currentUser} 
            users={users} 
            editingItem={editingItem} 
            isLoading={isLoading} 
            onCancelEdit={() => setEditingItem(null)} 
            allHistory={smallGroups} 
            unit={currentUnit} 
            history={getVisibleHistory(smallGroups)} 
            setItemToDelete={setItemToDelete} 
            onEdit={setEditingItem} 
            handleTransfer={handleTransfer} 
          />
        );
      case 'ambassadors':
        return <AmbassadorsManager />;
      case 'staffVisit':
        return (
          <StaffModule 
            currentUser={currentUser} 
            users={users} 
            editingItem={editingItem} 
            isLoading={isLoading} 
            onCancelEdit={() => setEditingItem(null)} 
            unit={currentUnit} 
            history={getVisibleHistory(staffVisits)} 
            allHistory={staffVisits} 
            setItemToDelete={setItemToDelete} 
            onEdit={setEditingItem} 
            handleTransfer={handleTransfer}
            saveRecord={saveRecord}
          />
        );
      case 'reports':
        return <Reports studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} users={users} currentUser={currentUser} config={config} onRefresh={() => loadFromCloud(true)} />;
      case 'pgManagement':
        return <PGManager editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} />;
      case 'users':
        return <CoreModule type="users" currentUser={currentUser} users={users} isLoading={isLoading} onUpdateUsers={async u => { await saveToCloud({ users: u }, true); }} />;
      case 'profile':
        return <CoreModule type="profile" currentUser={currentUser} users={users} isLoading={isLoading} onUpdateUser={updateCurrentUser} />;
      case 'admin':
        return <CoreModule type="admin" currentUser={currentUser} users={users} isLoading={isLoading} />;
      case 'dataHealing':
        return <CoreModule type="dataHealing" currentUser={currentUser} users={users} isLoading={isLoading} />;
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
            <ErrorBoundary>
              <Suspense fallback={<TabLoading />}>
                {renderTab(tabId)}
              </Suspense>
            </ErrorBoundary>
          </div>
        );
      })}
    </div>
  );
};

export default MainContent;
