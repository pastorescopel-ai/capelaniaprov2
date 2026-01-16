
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import { BibleStudyForm, BibleClassForm, StaffVisitForm, SmallGroupForm } from './components/Forms';
import AdminPanel from './components/AdminPanel';
import Reports from './components/Reports';
import Login from './components/Login';
import Profile from './components/Profile';
import UserManagement from './components/UserManagement';
import { User, UserRole, Unit } from './types';
import { useAppData } from './hooks/useAppData';
import { ToastProvider, useToast } from './contexts/ToastContext';

const AppContent: React.FC = () => {
  const {
    users, setUsers, bibleStudies, setBibleStudies, bibleClasses, setBibleClasses,
    smallGroups, setSmallGroups, staffVisits, setStaffVisits, masterLists, setMasterLists,
    config, setConfig, isSyncing, isConnected, loadFromCloud, saveToCloud, applySystemOverrides
  } = useAppData();

  const { showToast } = useToast();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{type: string, id: string} | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (email: string, pass: string) => {
    setLoginError(null);
    const lowerEmail = email.toLowerCase().trim();
    let existingUser = users.find(u => u.email.toLowerCase().trim() === lowerEmail && u.password === pass);
    
    if (!existingUser && lowerEmail === 'pastorescopel@gmail.com' && pass === 'admin') {
      existingUser = { id: 'admin-root', name: 'Administrador Geral', email: lowerEmail, role: UserRole.ADMIN, password: 'admin' };
      const updatedUsers = [...users, existingUser];
      await saveToCloud({ users: updatedUsers }, true);
    }

    if (existingUser) {
      setCurrentUser(existingUser);
      setIsAuthenticated(true);
    } else {
      setLoginError('E-mail ou senha incorretos!');
    }
  };

  const handleSaveItem = (type: string, data: any) => {
    let updatedStudies = [...bibleStudies], updatedClasses = [...bibleClasses], updatedVisits = [...staffVisits], updatedGroups = [...smallGroups];
    const targetId = data.id || editingItem?.id;
    const now = Date.now();
    
    if (targetId) {
      if (type === 'study') updatedStudies = bibleStudies.map(s => s.id === targetId ? { ...data, id: targetId, createdAt: s.createdAt, updatedAt: now } : s);
      if (type === 'class') updatedClasses = bibleClasses.map(c => c.id === targetId ? { ...data, id: targetId, createdAt: c.createdAt, updatedAt: now } : c);
      if (type === 'visit') updatedVisits = staffVisits.map(v => v.id === targetId ? { ...data, id: targetId, createdAt: v.createdAt, updatedAt: now } : v);
      if (type === 'pg') updatedGroups = smallGroups.map(g => g.id === targetId ? { ...data, id: targetId, createdAt: g.createdAt, updatedAt: now } : g);
    } else {
      const newItem = { ...data, userId: currentUser?.id, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      if (type === 'study') updatedStudies = [newItem, ...bibleStudies];
      if (type === 'class') updatedClasses = [newItem, ...bibleClasses];
      if (type === 'visit') updatedVisits = [newItem, ...staffVisits];
      if (type === 'pg') updatedGroups = [newItem, ...smallGroups];
    }

    setEditingItem(null);
    showToast("Registro realizado com sucesso!", "success");
    
    // Otimização: Update local imediato e sync silencioso
    saveToCloud({ 
      bibleStudies: updatedStudies, 
      bibleClasses: updatedClasses, 
      staffVisits: updatedVisits, 
      smallGroups: updatedGroups 
    }, false);
  };

  const handleTransferItem = (type: string, id: string, newUserId: string) => {
    let payload: any = {};
    const now = Date.now();
    if (type === 'study') payload.bibleStudies = bibleStudies.map(s => s.id === id ? { ...s, userId: newUserId, updatedAt: now } : s);
    if (type === 'class') payload.bibleClasses = bibleClasses.map(c => c.id === id ? { ...c, userId: newUserId, updatedAt: now } : c);
    if (type === 'pg') payload.smallGroups = smallGroups.map(g => g.id === id ? { ...g, userId: newUserId, updatedAt: now } : g);
    if (type === 'visit') payload.staffVisits = staffVisits.map(v => v.id === id ? { ...v, userId: newUserId, updatedAt: now } : v);
    
    showToast("Registro transferido com sucesso!", "success");
    saveToCloud(payload, false);
  };

  useEffect(() => {
    if (itemToDelete) {
      if (confirm("Tem certeza que deseja excluir este registro?")) {
        let payload: any = {};
        if (itemToDelete.type === 'study') payload.bibleStudies = bibleStudies.filter(s => s.id !== itemToDelete.id);
        if (itemToDelete.type === 'class') payload.bibleClasses = bibleClasses.filter(c => c.id !== itemToDelete.id);
        if (itemToDelete.type === 'pg') payload.smallGroups = smallGroups.filter(g => g.id !== itemToDelete.id);
        if (itemToDelete.type === 'visit') payload.staffVisits = staffVisits.filter(v => v.id !== itemToDelete.id);
        saveToCloud(payload, false);
      }
      setItemToDelete(null);
    }
  }, [itemToDelete, bibleStudies, bibleClasses, smallGroups, staffVisits, saveToCloud]);

  const getVisibleHistory = (list: any[]) => {
    if (!currentUser) return [];
    const matchUnit = (item: any) => (item.unit || Unit.HAB) === currentUnit;
    if (currentUser.role === UserRole.ADMIN) return list.filter(matchUnit);
    return list.filter(item => item && matchUnit(item) && item.userId === currentUser.id);
  };

  if (!isAuthenticated || !currentUser) {
    return <Login onLogin={handleLogin} isSyncing={isSyncing} errorMsg={loginError} isConnected={isConnected} />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} userRole={currentUser.role} isSyncing={isSyncing} isConnected={isConnected} config={config} onLogout={() => setIsAuthenticated(false)}>
      <div className="max-w-7xl mx-auto px-4 md:px-0">
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-start md:items-center">
          {['bibleStudy', 'bibleClass', 'smallGroup', 'staffVisit'].includes(activeTab) && (
            <div className="flex bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 max-w-fit">
              <button onClick={() => setCurrentUnit(Unit.HAB)} className={`px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase transition-all ${currentUnit === Unit.HAB ? 'text-white shadow-lg' : 'text-slate-400'}`} style={{ backgroundColor: currentUnit === Unit.HAB ? (config.primaryColor || '#005a9c') : undefined }}>Unidade HAB</button>
              <button onClick={() => setCurrentUnit(Unit.HABA)} className={`px-8 py-3 rounded-[1.5rem] font-black text-xs uppercase transition-all ${currentUnit === Unit.HABA ? 'text-white shadow-lg' : 'text-slate-400'}`} style={{ backgroundColor: currentUnit === Unit.HABA ? (config.primaryColor || '#005a9c') : undefined }}>Unidade HABA</button>
            </div>
          )}
        </div>
        
        {activeTab === 'dashboard' && <Dashboard studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} currentUser={currentUser} config={config} onGoToTab={setActiveTab} onUpdateConfig={c => saveToCloud({config: c}, false)} onUpdateUser={u => { setCurrentUser(u); saveToCloud({users: users.map(usr => usr.id === u.id ? u : usr)}, false); }} />}
        {activeTab === 'bibleStudy' && <BibleStudyForm currentUser={currentUser} users={users} masterLists={masterLists} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleStudies)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} onTransfer={handleTransferItem} />}
        {activeTab === 'bibleClass' && <BibleClassForm currentUser={currentUser} users={users} masterLists={masterLists} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleClasses)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} onTransfer={handleTransferItem} />}
        {activeTab === 'smallGroup' && <SmallGroupForm currentUser={currentUser} users={users} masterLists={masterLists} groupsList={currentUnit === Unit.HAB ? masterLists.groupsHAB : masterLists.groupsHABA} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(smallGroups)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />}
        {activeTab === 'staffVisit' && <StaffVisitForm currentUser={currentUser} users={users} masterLists={masterLists} onToggleReturn={id => { const up = staffVisits.map(x=>x.id===id?{...x, returnCompleted: !x.returnCompleted, updatedAt: Date.now()}:x); saveToCloud({staffVisits: up}, false); }} staffList={currentUnit === Unit.HAB ? masterLists.staffHAB : masterLists.staffHABA} editingItem={editingItem} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(staffVisits)} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />}
        {activeTab === 'reports' && <Reports studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} users={users} currentUser={currentUser} masterLists={masterLists} config={config} onRefresh={() => loadFromCloud(true)} />}
        {activeTab === 'users' && <UserManagement users={users} currentUser={currentUser} onUpdateUsers={async u => { await saveToCloud({ users: u }, true); }} />}
        {activeTab === 'profile' && currentUser && <Profile user={currentUser} isSyncing={isSyncing} onUpdateUser={u => { setCurrentUser(u); saveToCloud({users: users.map(usr => usr.id === u.id ? u : usr)}, true); }} />}
        {activeTab === 'admin' && <AdminPanel config={config} masterLists={masterLists} users={users} currentUser={currentUser} bibleStudies={bibleStudies} bibleClasses={bibleClasses} smallGroups={smallGroups} staffVisits={staffVisits} onSaveAllData={async (c, l) => { await saveToCloud({ config: applySystemOverrides(c), masterLists: l }, true); }} onRestoreFullDNA={async (db) => { await saveToCloud({ ...db, config: applySystemOverrides(db.config) }, true); }} onRefreshData={() => loadFromCloud(true)} />}
      </div>

      {isSyncing && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[9999] flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-8 max-sm w-full text-center border-4 border-white animate-in zoom-in duration-300">
            <div className="relative">
              <div className="w-20 h-20 border-8 border-slate-100 border-t-[#005a9c] rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-cloud-upload-alt text-[#005a9c] text-2xl animate-bounce"></i>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Sincronizando</h3>
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest leading-relaxed">Estamos salvando seus dados com segurança na nuvem.</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
