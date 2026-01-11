
import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import { BibleStudyForm, BibleClassForm, StaffVisitForm, SmallGroupForm } from './components/Forms';
import AdminPanel from './components/AdminPanel';
import Reports from './components/Reports';
import Login from './components/Login';
import Profile from './components/Profile';
import UserManagement from './components/UserManagement';
import { User, UserRole, Unit, BibleStudy, BibleClass, SmallGroup, StaffVisit, MasterLists, Config, RecordStatus } from './types';
import { syncService } from './services/syncService';
import { INITIAL_CONFIG, GOOGLE_SCRIPT_URL, APP_LOGO_BASE64, REPORT_LOGO_BASE64 } from './constants';

const encodeData = (str: string) => btoa(unescape(encodeURIComponent(str)));
const decodeData = (str: string) => {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {
    return str;
  }
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  const [selectedChaplainFilter, setSelectedChaplainFilter] = useState<string>('all');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{type: string, id: string} | null>(null);
  
  const [users, setUsers] = useState<User[]>([]);
  const [bibleStudies, setBibleStudies] = useState<BibleStudy[]>([]);
  const [bibleClasses, setBibleClasses] = useState<BibleClass[]>([]);
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([]);
  const [staffVisits, setStaffVisits] = useState<StaffVisit[]>([]);
  const [masterLists, setMasterLists] = useState<MasterLists>({
    sectorsHAB: [], sectorsHABA: [], staffHAB: [], staffHABA: [], groupsHAB: [], groupsHABA: []
  });

  const applySystemOverrides = (baseConfig: Config): Config => {
    if (!baseConfig) return INITIAL_CONFIG;
    return {
      ...baseConfig,
      googleSheetUrl: GOOGLE_SCRIPT_URL,
      appLogo: APP_LOGO_BASE64,
      reportLogo: REPORT_LOGO_BASE64
    };
  };

  const [config, setConfig] = useState<Config>(applySystemOverrides(INITIAL_CONFIG));

  useEffect(() => {
    const initApp = async () => {
      try {
        const localUsers = syncService.getLocal<User[]>('users');
        const localStudies = syncService.getLocal<BibleStudy[]>('bibleStudies');
        const localClasses = syncService.getLocal<BibleClass[]>('bibleClasses');
        const localGroups = syncService.getLocal<SmallGroup[]>('smallGroups');
        const localVisits = syncService.getLocal<StaffVisit[]>('staffVisits');
        const localLists = syncService.getLocal<MasterLists>('masterLists');
        const localConfig = syncService.getLocal<Config>('config');

        if (localUsers && Array.isArray(localUsers)) setUsers(localUsers);
        if (localStudies && Array.isArray(localStudies)) setBibleStudies(localStudies);
        if (localClasses && Array.isArray(localClasses)) setBibleClasses(localClasses);
        if (localGroups && Array.isArray(localGroups)) setSmallGroups(localGroups);
        if (localVisits && Array.isArray(localVisits)) setStaffVisits(localVisits);
        if (localLists) setMasterLists(prev => ({ ...prev, ...localLists }));
        if (localConfig) setConfig(applySystemOverrides(localConfig));

        await loadFromCloud();
      } catch (err) {
        console.error("Erro na inicialização:", err);
      } finally {
        setIsInitialized(true);
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    syncService.setLocal('users', users);
    syncService.setLocal('bibleStudies', bibleStudies);
    syncService.setLocal('bibleClasses', bibleClasses);
    syncService.setLocal('smallGroups', smallGroups);
    syncService.setLocal('staffVisits', staffVisits);
    syncService.setLocal('masterLists', masterLists);
    syncService.setLocal('config', config);
  }, [users, bibleStudies, bibleClasses, smallGroups, staffVisits, masterLists, config, isInitialized]);

  const loadFromCloud = useCallback(async () => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('URL_EXEMPLO')) return;
    setIsSyncing(true);
    try {
      syncService.setScriptUrl(GOOGLE_SCRIPT_URL);
      const cloudData = await syncService.syncFromCloud();
      if (cloudData) {
        if (cloudData.users && Array.isArray(cloudData.users)) {
          const decodedUsers = cloudData.users.map((u: User) => ({
            ...u,
            email: decodeData(u.email),
            password: decodeData(u.password || '')
          }));
          setUsers(decodedUsers);
        }
        if (cloudData.bibleStudies && Array.isArray(cloudData.bibleStudies)) setBibleStudies(cloudData.bibleStudies);
        if (cloudData.bibleClasses && Array.isArray(cloudData.bibleClasses)) setBibleClasses(cloudData.bibleClasses);
        if (cloudData.smallGroups && Array.isArray(cloudData.smallGroups)) setSmallGroups(cloudData.smallGroups);
        if (cloudData.staffVisits && Array.isArray(cloudData.staffVisits)) setStaffVisits(cloudData.staffVisits);
        if (cloudData.masterLists) setMasterLists(prev => ({ ...prev, ...cloudData.masterLists }));
        if (cloudData.config) setConfig(applySystemOverrides(cloudData.config));
        setIsConnected(true);
      }
    } catch (e) {
      console.error("Erro Cloud Sync:", e);
      setIsConnected(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const saveToCloud = useCallback(async (overrides?: any) => {
    if (!isInitialized || !GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('URL_EXEMPLO')) return;
    setIsSyncing(true);
    syncService.setScriptUrl(GOOGLE_SCRIPT_URL);
    
    const targetUsers = overrides?.users !== undefined ? overrides.users : users;
    const securedUsers = targetUsers.map((u: User) => ({
      ...u,
      email: encodeData(u.email),
      password: encodeData(u.password || '')
    }));

    let cloudConfig = overrides?.config !== undefined ? { ...overrides.config } : { ...config };
    // @ts-ignore
    delete cloudConfig.appLogo; delete cloudConfig.reportLogo; delete cloudConfig.googleSheetUrl;

    const payload = {
      users: securedUsers,
      bibleStudies: overrides?.bibleStudies !== undefined ? overrides.bibleStudies : bibleStudies,
      bibleClasses: overrides?.bibleClasses !== undefined ? overrides.bibleClasses : bibleClasses,
      smallGroups: overrides?.smallGroups !== undefined ? overrides.smallGroups : smallGroups,
      staffVisits: overrides?.staffVisits !== undefined ? overrides.staffVisits : staffVisits,
      masterLists: overrides?.masterLists !== undefined ? overrides.masterLists : masterLists,
      config: cloudConfig,
    };

    try {
      const success = await syncService.saveToCloud(payload);
      setIsConnected(success);
      return success;
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setIsConnected(false);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [isInitialized, config, users, bibleStudies, bibleClasses, smallGroups, staffVisits, masterLists]);

  const handleLogin = async (email: string, pass: string) => {
    setLoginError(null);
    const lowerEmail = email.toLowerCase().trim();
    let existingUser = users.find(u => u.email.toLowerCase().trim() === lowerEmail && u.password === pass);
    if (!existingUser && lowerEmail === 'pastorescopel@gmail.com' && pass === 'admin') {
      existingUser = { id: 'admin-root', name: 'Administrador Geral', email: lowerEmail, role: UserRole.ADMIN, password: 'admin' };
      if (!users.find(u => u.email.toLowerCase() === lowerEmail)) {
        const updatedUsers = [...users, existingUser];
        setUsers(updatedUsers);
        await saveToCloud({ users: updatedUsers });
      }
    }
    if (existingUser) {
      setCurrentUser(existingUser);
      setIsAuthenticated(true);
    } else {
      setLoginError('E-mail ou senha incorretos!');
    }
  };

  const handleLogout = () => { setIsAuthenticated(false); setCurrentUser(null); setActiveTab('dashboard'); };

  const handleSaveItem = async (type: string, data: any) => {
    if (!isInitialized) return;
    let updatedStudies = [...bibleStudies], updatedClasses = [...bibleClasses], updatedVisits = [...staffVisits], updatedGroups = [...smallGroups];
    const targetId = data.id || editingItem?.id;
    if (targetId) {
      if (type === 'study') updatedStudies = bibleStudies.map(s => s.id === targetId ? { ...data, id: targetId } : s);
      if (type === 'class') updatedClasses = bibleClasses.map(c => c.id === targetId ? { ...data, id: targetId } : c);
      if (type === 'visit') updatedVisits = staffVisits.map(v => v.id === targetId ? { ...data, id: targetId } : v);
      if (type === 'pg') updatedGroups = smallGroups.map(g => g.id === targetId ? { ...data, id: targetId } : g);
    } else {
      const newItem = { ...data, userId: currentUser?.id, id: crypto.randomUUID(), createdAt: Date.now() };
      if (type === 'study') updatedStudies = [newItem, ...bibleStudies];
      if (type === 'class') updatedClasses = [newItem, ...bibleClasses];
      if (type === 'visit') updatedVisits = [newItem, ...staffVisits];
      if (type === 'pg') updatedGroups = [newItem, ...smallGroups];
    }
    setBibleStudies(updatedStudies); setBibleClasses(updatedClasses); setStaffVisits(updatedVisits); setSmallGroups(updatedGroups);
    await saveToCloud({ bibleStudies: updatedStudies, bibleClasses: updatedClasses, staffVisits: updatedVisits, smallGroups: updatedGroups });
    setEditingItem(null);
  };

  const getVisibleHistory = (list: any[]) => {
    if (!currentUser) return [];
    const matchUnit = (item: any) => (item.unit || Unit.HAB) === currentUnit;
    if (currentUser.role === UserRole.ADMIN) return list.filter(item => matchUnit(item) && (selectedChaplainFilter === 'all' || item.userId === selectedChaplainFilter));
    return list.filter(item => item && matchUnit(item) && item.userId === currentUser.id);
  };

  if (!isAuthenticated || !currentUser) {
    return <Login logo={config.appLogo} onLogin={handleLogin} isSyncing={isSyncing} errorMsg={loginError} isConnected={isConnected} />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} userRole={currentUser.role} isSyncing={isSyncing} isConnected={isConnected} config={config} onLogout={handleLogout}>
      <div className="max-w-7xl mx-auto px-4 md:px-0">
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-start md:items-center">
          {['bibleStudy', 'bibleClass', 'smallGroup', 'staffVisit'].includes(activeTab) && (
            <>
              <div className="flex bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 max-w-fit">
                <button onClick={() => setCurrentUnit(Unit.HAB)} className={`px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase transition-all ${currentUnit === Unit.HAB ? 'text-white shadow-lg' : 'text-slate-400'}`} style={{ backgroundColor: currentUnit === Unit.HAB ? (config.primaryColor || '#005a9c') : undefined }}>Unidade HAB</button>
                <button onClick={() => setCurrentUnit(Unit.HABA)} className={`px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase transition-all ${currentUnit === Unit.HABA ? 'text-white shadow-lg' : 'text-slate-400'}`} style={{ backgroundColor: currentUnit === Unit.HABA ? (config.primaryColor || '#005a9c') : undefined }}>Unidade HABA</button>
              </div>
            </>
          )}
        </div>
        {activeTab === 'dashboard' && currentUser && <Dashboard studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} currentUser={currentUser} config={config} onGoToTab={setActiveTab} onUpdateConfig={c => {setConfig(c); saveToCloud({config: c});}} onUpdateUser={u => { setCurrentUser(u); const updated = users.map(usr => usr.id === u.id ? u : usr); setUsers(updated); saveToCloud({users: updated}); }} />}
        {activeTab === 'bibleStudy' && <BibleStudyForm users={users} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleStudies).slice(0, 15)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} />}
        {activeTab === 'bibleClass' && <BibleClassForm users={users} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleClasses).slice(0, 15)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} />}
        {activeTab === 'smallGroup' && <SmallGroupForm users={users} groupsList={currentUnit === Unit.HAB ? masterLists.groupsHAB : masterLists.groupsHABA} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(smallGroups).slice(0, 15)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />}
        {activeTab === 'staffVisit' && <StaffVisitForm users={users} onToggleReturn={id => { const up = staffVisits.map(x=>x.id===id?{...x, returnCompleted: !x.returnCompleted}:x); setStaffVisits(up); saveToCloud({staffVisits: up}); }} staffList={currentUnit === Unit.HAB ? masterLists.staffHAB : masterLists.staffHABA} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(staffVisits).slice(0, 15)} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />}
        {activeTab === 'reports' && <Reports studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} users={users} config={config} onRefresh={loadFromCloud} />}
        {activeTab === 'users' && <UserManagement users={users} currentUser={currentUser} onUpdateUsers={async u => { setUsers(u); await saveToCloud({ users: u }); }} />}
        {activeTab === 'profile' && currentUser && <Profile user={currentUser} onUpdateUser={u => { setCurrentUser(u); const updated = users.map(usr => usr.id === u.id ? u : usr); setUsers(updated); saveToCloud({users: updated}); }} />}
        {activeTab === 'admin' && (
          <AdminPanel 
            config={config} 
            masterLists={masterLists} 
            users={users} 
            currentUser={currentUser}
            bibleStudies={bibleStudies}
            bibleClasses={bibleClasses}
            smallGroups={smallGroups}
            staffVisits={staffVisits}
            onUpdateConfig={async c => { setConfig(applySystemOverrides(c)); await saveToCloud({ config: c }); }} 
            onUpdateLists={async l => { setMasterLists(l); await saveToCloud({ masterLists: l }); }} 
            onUpdateUsers={async u => { setUsers(u); await saveToCloud({ users: u }); }} 
          />
        )}
      </div>
    </Layout>
  );
};

export default App;
