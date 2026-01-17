
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
    config, setConfig, isSyncing, isConnected, loadFromCloud, saveToCloud, applySystemOverrides, hashPassword
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
    const hashedInput = await hashPassword(pass);
    
    // Busca o usuário na base carregada da planilha pelo e-mail
    const dbUser = users.find(u => u.email.toLowerCase().trim() === lowerEmail);
    
    if (!dbUser) {
      // Fallback emergencial caso a planilha esteja vazia
      if (lowerEmail === 'pastorescopel@gmail.com' && pass === 'admin') {
        const rootAdmin: User = { id: 'admin-root', name: 'Administrador Geral', email: lowerEmail, role: UserRole.ADMIN, password: 'admin' };
        setCurrentUser(rootAdmin);
        setIsAuthenticated(true);
        setActiveTab('dashboard');
        // Apenas neste caso de criação do zero ele tenta salvar
        await saveToCloud({ users: [rootAdmin] }, true);
        return;
      }
      setLoginError('Usuário não localizado na base de dados!');
      return;
    }

    // VALIDAÇÃO HÍBRIDA (PONTE): Texto Simples ou Hash
    const isPlainTextMatch = dbUser.password === pass;
    const isHashMatch = dbUser.password === hashedInput;

    if (isPlainTextMatch || isHashMatch) {
      // ACESSO INSTANTÂNEO: Não grava nada no Google agora para ser rápido
      setCurrentUser(dbUser);
      setIsAuthenticated(true);
      showToast(`Bem-vindo, ${dbUser.name}`, "success");

      // LÓGICA DE REDIRECIONAMENTO:
      // Se logou com senha antiga (texto simples), manda para o perfil para ele atualizar
      if (isPlainTextMatch && pass.length < 50) {
        setActiveTab('profile');
        setTimeout(() => {
          showToast("Acesso via modo de migração. Por favor, confirme seus dados e salve para atualizar sua segurança.", "warning");
        }, 1000);
      } else {
        setActiveTab('dashboard');
      }
    } else {
      setLoginError('Senha incorreta!');
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
    saveToCloud({ bibleStudies: updatedStudies, bibleClasses: updatedClasses, staffVisits: updatedVisits, smallGroups: updatedGroups }, false);
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
        {activeTab === 'bibleStudy' && <BibleStudyForm currentUser={currentUser} users={users} masterLists={masterLists} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} allHistory={bibleStudies} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleStudies)} onDelete={id => setItemToDelete({type: 'study', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('study', d)} onTransfer={handleTransferItem} />}
        {activeTab === 'bibleClass' && <BibleClassForm currentUser={currentUser} users={users} masterLists={masterLists} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} allHistory={bibleClasses} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(bibleClasses)} onDelete={id => setItemToDelete({type: 'class', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('class', d)} onTransfer={handleTransferItem} />}
        {activeTab === 'smallGroup' && <SmallGroupForm currentUser={currentUser} users={users} masterLists={masterLists} groupsList={currentUnit === Unit.HAB ? masterLists.groupsHAB : masterLists.groupsHABA} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(smallGroups)} onDelete={id => setItemToDelete({type: 'pg', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('pg', d)} />}
        {activeTab === 'staffVisit' && <StaffVisitForm currentUser={currentUser} users={users} masterLists={masterLists} onToggleReturn={id => { const up = staffVisits.map(x=>x.id===id?{...x, returnCompleted: !x.returnCompleted, updatedAt: Date.now()}:x); saveToCloud({staffVisits: up}, false); }} staffList={currentUnit === Unit.HAB ? masterLists.staffHAB : masterLists.staffHABA} editingItem={editingItem} isLoading={isSyncing} onCancelEdit={() => setEditingItem(null)} unit={currentUnit} sectors={currentUnit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA} history={getVisibleHistory(staffVisits)} onDelete={id => setItemToDelete({type: 'visit', id})} onEdit={setEditingItem} onSubmit={d => handleSaveItem('visit', d)} />}
        {activeTab === 'reports' && <Reports studies={bibleStudies} classes={bibleClasses} groups={smallGroups} visits={staffVisits} users={users} currentUser={currentUser} masterLists={masterLists} config={config} onRefresh={() => loadFromCloud(true)} />}
        {activeTab === 'users' && <UserManagement users={users} currentUser={currentUser} onUpdateUsers={async u => { 
            const hashedUsers = await Promise.all(u.map(async usr => ({
                ...usr,
                password: (usr.password && usr.password.length < 60) ? await hashPassword(usr.password) : usr.password
            })));
            await saveToCloud({ users: hashedUsers }, true); 
        }} />}
        {activeTab === 'profile' && currentUser && <Profile user={currentUser} isSyncing={isSyncing} onUpdateUser={async u => { 
            const finalUser = { ...u };
            if (u.password && u.password.length < 60) {
                finalUser.password = await hashPassword(u.password);
            }
            setCurrentUser(finalUser); 
            saveToCloud({users: users.map(usr => usr.id === u.id ? finalUser : usr)}, true); 
        }} />}
        {activeTab === 'admin' && <AdminPanel config={config} masterLists={masterLists} users={users} currentUser={currentUser} bibleStudies={bibleStudies} bibleClasses={bibleClasses} smallGroups={smallGroups} staffVisits={staffVisits} onSaveAllData={async (c, l) => { await saveToCloud({ config: applySystemOverrides(c), masterLists: l }, true); }} onRestoreFullDNA={async (db) => { await saveToCloud({ ...db, config: applySystemOverrides(db.config) }, true); }} onRefreshData={() => loadFromCloud(true)} />}
      </div>
    </Layout>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
