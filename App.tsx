
import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import { BibleStudyForm, BibleClassForm, StaffVisitForm, SmallGroupForm } from './components/Forms';
import AdminPanel from './components/AdminPanel';
import Reports from './components/Reports';
import Login from './components/Login';
import Profile from './components/Profile';
import UserManagement from './components/UserManagement';
import { User, UserRole, Unit, BibleStudy, BibleClass, SmallGroup, StaffVisit, MasterLists, Config } from './types';
import { syncService } from './services/syncService';
import { INITIAL_CONFIG, GOOGLE_SCRIPT_URL, APP_LOGO_BASE64, REPORT_LOGO_BASE64 } from './constants';

const App: React.FC = () => {
  // Estados de Autenticação
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Estados de Sincronização
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{type: string, id: string} | null>(null);
  
  // Dados do Sistema com Fallback Seguro
  const [users, setUsers] = useState<User[]>(() => {
    try {
      return syncService.getLocal<User[]>('users') || [];
    } catch {
      return [];
    }
  });

  const [bibleStudies, setBibleStudies] = useState<BibleStudy[]>(() => syncService.getLocal('bibleStudies') || []);
  const [bibleClasses, setBibleClasses] = useState<BibleClass[]>(() => syncService.getLocal('bibleClasses') || []);
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>(() => syncService.getLocal('smallGroups') || []);
  const [staffVisits, setStaffVisits] = useState<StaffVisit[]>(() => syncService.getLocal('staffVisits') || []);
  const [masterLists, setMasterLists] = useState<MasterLists>(() => syncService.getLocal('masterLists') || {
    sectorsHAB: [], sectorsHABA: [], staffHAB: [], staffHABA: [], groupsHAB: [], groupsHABA: []
  });

  const applySystemOverrides = (baseConfig: Config): Config => ({
    ...baseConfig,
    googleSheetUrl: GOOGLE_SCRIPT_URL,
    appLogo: APP_LOGO_BASE64,
    reportLogo: REPORT_LOGO_BASE64
  });

  const [config, setConfig] = useState<Config>(() => {
    const local = syncService.getLocal<Config>('config');
    return applySystemOverrides(local || INITIAL_CONFIG);
  });

  // Funções de Sincronização
  const loadFromCloud = useCallback(async () => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('URL_EXEMPLO')) return;
    setIsSyncing(true);
    try {
      syncService.setScriptUrl(GOOGLE_SCRIPT_URL);
      const cloudData = await syncService.syncFromCloud();
      if (cloudData) {
        if (cloudData.users && cloudData.users.length > 0) setUsers(cloudData.users);
        if (cloudData.bibleStudies) setBibleStudies(cloudData.bibleStudies);
        if (cloudData.bibleClasses) setBibleClasses(cloudData.bibleClasses);
        if (cloudData.smallGroups) setSmallGroups(cloudData.smallGroups);
        if (cloudData.staffVisits) setStaffVisits(cloudData.staffVisits);
        if (cloudData.masterLists) setMasterLists(cloudData.masterLists);
        if (cloudData.config) setConfig(applySystemOverrides(cloudData.config));
        setIsConnected(true);
      }
    } catch (e) {
      console.error("Sync failure (Offline mode enabled):", e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const saveToCloud = useCallback(async (overrides?: any) => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('URL_EXEMPLO')) return;
    setIsSyncing(true);
    syncService.setScriptUrl(GOOGLE_SCRIPT_URL);
    
    const payload = {
      users: overrides?.users || users,
      bibleStudies: overrides?.bibleStudies || bibleStudies,
      bibleClasses: overrides?.bibleClasses || bibleClasses,
      smallGroups: overrides?.smallGroups || smallGroups,
      staffVisits: overrides?.staffVisits || staffVisits,
      masterLists: overrides?.masterLists || masterLists,
      config: overrides?.config || config,
    };

    const success = await syncService.saveToCloud(payload);
    setIsConnected(success);
    setIsSyncing(false);
    return success;
  }, [config, users, bibleStudies, bibleClasses, smallGroups, staffVisits, masterLists]);

  useEffect(() => { loadFromCloud(); }, [loadFromCloud]);

  useEffect(() => {
    syncService.setLocal('users', users);
    syncService.setLocal('bibleStudies', bibleStudies);
    syncService.setLocal('bibleClasses', bibleClasses);
    syncService.setLocal('smallGroups', smallGroups);
    syncService.setLocal('staffVisits', staffVisits);
    syncService.setLocal('masterLists', masterLists);
    syncService.setLocal('config', config);
  }, [users, bibleStudies, bibleClasses, smallGroups, staffVisits, masterLists, config]);

  const handleLogin = async (email: string, pass: string) => {
    setLoginError(null);
    const lowerEmail = email.toLowerCase();
    
    let existingUser = users.find(u => u.email.toLowerCase() === lowerEmail && u.password === pass);
    
    // Login Mestre de Emergência (Admin)
    if (!existingUser && lowerEmail === 'pastorescopel@gmail.com' && pass === 'admin') {
      existingUser = { id: 'admin-root', name: 'Administrador Geral', email: lowerEmail, role: UserRole.ADMIN, password: 'admin' };
      if (!users.find(u => u.email.toLowerCase() === lowerEmail)) {
        const updatedUsers = [...users, existingUser];
        setUsers(updatedUsers);
      }
    }

    if (existingUser) {
      setCurrentUser(existingUser);
      setIsAuthenticated(true);
    } else {
      setLoginError('E-mail ou senha incorretos!');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Utilitário para ID Único (Resiliência para contextos não-HTTPS)
  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  };

  const handleSaveItem = async (type: string, data: any) => {
    let update: any = {};
    if (editingItem) {
      if (type === 'study') { update.bibleStudies = bibleStudies.map(s => s.id === editingItem.id ? { ...data, id: editingItem.id } : s); setBibleStudies(update.bibleStudies); }
      if (type === 'class') { update.bibleClasses = bibleClasses.map(c => c.id === editingItem.id ? { ...data, id: editingItem.id } : c); setBibleClasses(update.bibleClasses); }
      if (type === 'visit') { update.staffVisits = staffVisits.map(v => v.id === editingItem.id ? { ...data, id: editingItem.id } : v); setStaffVisits(update.staffVisits); }
      if (type === 'pg') { update.smallGroups = smallGroups.map(g => g.id === editingItem.id ? { ...data, id: editingItem.id } : g); setSmallGroups(update.smallGroups); }
    } else {
      const newItem = { ...data, userId: currentUser?.id, id: generateId(), createdAt: Date.now() };
      if (type === 'study') { update.bibleStudies = [newItem, ...bibleStudies]; setBibleStudies(update.bibleStudies); }
      if (type === 'class') { update.bibleClasses = [newItem, ...bibleClasses]; setBibleClasses(update.bibleClasses); }
      if (type === 'visit') { update.staffVisits = [newItem, ...staffVisits]; setStaffVisits(update.staffVisits); }
      if (type === 'pg') { update.smallGroups = [newItem, ...smallGroups]; setSmallGroups(update.smallGroups); }
    }
    await saveToCloud(update);
    setEditingItem(null);
  };

  const getVisibleHistory = (list: any[]) => {
    if (!currentUser) return [];
    if (currentUser.role === UserRole.ADMIN) return list.filter(item => item.unit === currentUnit);
    return list.filter(item => item.unit === currentUnit && item.userId === currentUser.id);
  };

  // --- RENDERIZAÇÃO PRIORITÁRIA DA TELA DE LOGIN ---
  if (!isAuthenticated || !currentUser) {
    return (
      <Login 
        logo={config.appLogo} 
        onLogin={handleLogin} 
        isSyncing={isSyncing} 
        errorMsg={loginError} 
        isConnected={isConnected} 
      />
    );
  }

  // --- RENDERIZAÇÃO DO SISTEMA PÓS-LOGIN ---
  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      userRole={currentUser.role} 
      isSyncing={isSyncing} 
      isConnected={isConnected} 
      config={config} 
      onLogout={handleLogout}
    >
      {/* Overlay Global de Sincronização */}
      {isSyncing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center border border-white/20 animate-in zoom-in duration-300">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-cloud-upload-alt text-blue-600 text-2xl animate-pulse"></i>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Sincronizando</h3>
              <p className="text-slate-500 text-sm font-medium">Aguarde um momento...</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[510] flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full animate-in zoom-in duration-200 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6"><i className="fas fa-trash-alt"></i></div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Excluir Registro?</h3>
            <p className="text-slate-500 mb-8 font-medium">Esta ação não poderá ser desfeita na nuvem.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setItemToDelete(null)} className="py-4 rounded-2xl bg-slate-50 text-slate-400 font-bold uppercase text-xs">Voltar</button>
              <button onClick={async () => {
                const { type, id } = itemToDelete;
                let update: any = {};
                if (type === 'study') { update.bibleStudies = bibleStudies.filter(s => s.id !== id); setBibleStudies(update.bibleStudies); }
                if (type === 'class') { update.bibleClasses = bibleClasses.filter(c => c.id !== id); setBibleClasses(update.bibleClasses); }
                if (type === 'visit') { update.staffVisits = staffVisits.filter(v => v.id !== id); setStaffVisits(update.staffVisits); }
                if (type === 'pg') { update.smallGroups = smallGroups.filter(g => g.id !== id); setSmallGroups(update.smallGroups); }
                await saveToCloud(update);
                setItemToDelete(null);
              }} className="py-4 rounded-2xl bg-rose-500 text-white font-bold uppercase text-xs shadow-lg shadow-rose-100">Excluir</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-0">
        {/* Seletor de Unidade */}
        <div className="mb-8">
          {['bibleStudy', 'bibleClass', 'smallGroup', 'staffVisit'].includes(activeTab) && (
            <div className="flex bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 max-w-fit">
              <button onClick={() => setCurrentUnit(Unit.HAB)} className={`px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase transition-all ${currentUnit === Unit.HAB ? 'bg-[#005a9c] text-white shadow-lg' : 'text-slate-400'}`}>Unidade HAB</button>
              <button onClick={() => setCurrentUnit(Unit.HABA)} className={`px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase transition-all ${currentUnit === Unit.HABA ? 'bg-[#005a9c] text-white shadow-lg' : 'text-slate-400'}`}>Unidade HABA</button>
            </div>
          )}
        </div>

        {/* Mapeamento de Abas */}
        {activeTab === 'dashboard' && <Dashboard studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} currentUser={currentUser} config={config} onGoToTab={setActiveTab} onUpdateConfig={c => {setConfig(c); saveToCloud({config: c});}} onUpdateUser={u => { setCurrentUser(u); const updated = users.map(usr => usr.id === u.id ? u : usr); setUsers(updated); saveToCloud({users: updated}); }} />}
        {activeTab === 'bibleStudy' && <BibleStudyForm editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleStudies).slice(0, 10)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} />}
        {activeTab === 'bibleClass' && <BibleClassForm editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleClasses).slice(0, 10)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} />}
        {activeTab === 'smallGroup' && <SmallGroupForm groupsList={currentUnit === Unit.HAB ? masterLists.groupsHAB : masterLists.groupsHABA} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(smallGroups).slice(0, 10)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />}
        {activeTab === 'staffVisit' && <StaffVisitForm onToggleReturn={id => { const v = staffVisits.find(x=>x.id===id); if(v) { const up = staffVisits.map(x=>x.id===id?{...x, returnCompleted: !x.returnCompleted}:x); setStaffVisits(up); saveToCloud({staffVisits: up}); } }} staffList={currentUnit === Unit.HAB ? masterLists.staffHAB : masterLists.staffHABA} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(staffVisits).slice(0, 10)} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />}
        {activeTab === 'reports' && <Reports studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} users={users} config={config} onRefresh={loadFromCloud} />}
        {activeTab === 'users' && <UserManagement users={users} onUpdateUsers={async u => { setUsers(u); await saveToCloud({ users: u }); }} />}
        {activeTab === 'profile' && <Profile user={currentUser} onUpdateUser={u => { setCurrentUser(u); const updated = users.map(usr => usr.id === u.id ? u : usr); setUsers(updated); saveToCloud({users: updated}); }} />}
        {activeTab === 'admin' && <AdminPanel config={config} masterLists={masterLists} users={users} onUpdateConfig={async c => { setConfig(c); await saveToCloud({ config: c }); }} onUpdateLists={async l => { setMasterLists(l); await saveToCloud({ masterLists: l }); }} onUpdateUsers={async u => { setUsers(u); await saveToCloud({ users: u }); }} />}
      </div>
    </Layout>
  );
};

export default App;
