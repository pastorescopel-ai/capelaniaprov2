
import React, { useState } from 'react';
import { User, UserRole } from '../types';

interface UserManagementProps {
  users: User[];
  onUpdateUsers: (newUsers: User[]) => Promise<void>;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, onUpdateUsers }) => {
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: UserRole.CHAPLAIN });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) return alert('Preencha os dados do usuário');
    
    setIsProcessing(true);
    try {
      await onUpdateUsers([...users, { ...newUser, id: crypto.randomUUID() }]);
      setNewUser({ name: '', email: '', password: '', role: UserRole.CHAPLAIN });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    if (!editingUser.name || !editingUser.email) return alert('Nome e e-mail são obrigatórios');
    
    setIsProcessing(true);
    try {
      const updatedUsers = users.map(u => u.id === editingUser.id ? editingUser : u);
      await onUpdateUsers(updatedUsers);
      setEditingUser(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    setIsProcessing(true);
    try {
      await onUpdateUsers(users.filter(usr => usr.id !== userToDelete.id));
      setUserToDelete(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-24 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-black text-slate-800">Gestão de Usuários</h1>
        <p className="text-slate-500 font-medium">Controle de acessos e permissões da equipe</p>
      </header>

      {/* Overlay de Sincronização Interno para Ações de Usuário */}
      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[700] flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Sincronizando Banco</h3>
              <p className="text-slate-500 text-sm font-bold">Salvando alterações na nuvem...</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full animate-in zoom-in duration-200 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center text-3xl mx-auto">
              <i className="fas fa-user-times"></i>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800">Remover Capelão?</h3>
              <p className="text-slate-500 font-medium italic">"{userToDelete.name}" não terá mais acesso ao sistema.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <button 
                onClick={() => setUserToDelete(null)} 
                className="py-4 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
              >
                Manter
              </button>
              <button 
                onClick={confirmDelete} 
                className="py-4 rounded-2xl bg-rose-500 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-100 hover:bg-rose-600 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl max-w-lg w-full animate-in zoom-in duration-200 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Editar Usuário</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome do Usuário</label>
                <input 
                  value={editingUser.name} 
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">E-mail de Acesso</label>
                <input 
                  value={editingUser.email} 
                  onChange={e => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nova Senha (opcional)</label>
                <input 
                  type="password"
                  placeholder="Deixe em branco para manter"
                  value={editingUser.password || ''} 
                  onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Cargo / Permissão</label>
                <select 
                  value={editingUser.role} 
                  onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value={UserRole.CHAPLAIN}>Capelão</option>
                  <option value={UserRole.ADMIN}>Administrador</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <button onClick={() => setEditingUser(null)} className="py-4 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleSaveEdit} className="py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs shadow-xl hover:bg-blue-700">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <h2 className="text-2xl font-bold text-emerald-600 flex items-center gap-3">
          <i className="fas fa-user-plus"></i> Novo Cadastro
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-[2rem]">
          <input placeholder="Nome" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="p-4 rounded-2xl border-none shadow-sm font-bold" />
          <input placeholder="E-mail" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="p-4 rounded-2xl border-none shadow-sm font-bold" />
          <input placeholder="Senha" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="p-4 rounded-2xl border-none shadow-sm font-bold" />
          <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="p-4 rounded-2xl border-none shadow-sm font-bold">
            <option value={UserRole.CHAPLAIN}>Capelão</option>
            <option value={UserRole.ADMIN}>Administrador</option>
          </select>
          <button onClick={handleAddUser} className="lg:col-span-4 py-5 bg-emerald-600 text-white font-black uppercase text-xs tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all">
            Cadastrar e Sincronizar
          </button>
        </div>
      </section>

      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Equipe Cadastrada</h2>
        <div className="grid gap-4">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 group transition-all hover:border-blue-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 font-black text-2xl shadow-sm border border-slate-100">
                  {u.name[0]}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{u.name}</h4>
                  <p className="text-xs text-slate-500 font-medium">{u.email} • <span className="font-black text-blue-600 uppercase text-[9px] tracking-widest">{u.role}</span></p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditingUser(u)} title="Editar" className="w-12 h-12 bg-white text-blue-500 rounded-xl shadow-sm hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center border border-slate-100"><i className="fas fa-edit"></i></button>
                <button onClick={() => setUserToDelete(u)} title="Excluir" className="w-12 h-12 bg-white text-rose-500 rounded-xl shadow-sm hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-slate-100"><i className="fas fa-trash-alt"></i></button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default UserManagement;
