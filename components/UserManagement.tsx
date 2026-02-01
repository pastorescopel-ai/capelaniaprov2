import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { useToast } from '../contexts/ToastContext';
import { hashPassword } from '../utils/crypto';

interface UserManagementProps {
  users: User[];
  currentUser: User;
  onUpdateUsers: (newUsers: User[]) => Promise<void>;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, currentUser, onUpdateUsers }) => {
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: UserRole.CHAPLAIN });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showToast } = useToast();

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      showToast('Preencha os dados do usuário', 'warning');
      return;
    }
    
    setIsProcessing(true);
    try {
      const securePassword = await hashPassword(newUser.password.trim());
      
      const userToAdd: User = {
        id: crypto.randomUUID(),
        name: newUser.name,
        email: newUser.email.toLowerCase().trim(),
        password: securePassword,
        role: newUser.role,
        profilePic: ''
      };

      await onUpdateUsers([...users, userToAdd]);
      setNewUser({ name: '', email: '', password: '', role: UserRole.CHAPLAIN });
      showToast('Usuário cadastrado com sucesso!', 'success');
    } catch (e) {
      showToast('Erro ao cadastrar.', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    setIsProcessing(true);
    try {
      let finalPassword = editingUser.password;
      
      if (editingUser.password && editingUser.password.length !== 64) {
        finalPassword = await hashPassword(editingUser.password.trim());
      }

      const updatedUsers = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...editingUser,
            email: editingUser.email.toLowerCase().trim(),
            password: finalPassword
          };
        }
        return u;
      });

      await onUpdateUsers(updatedUsers);
      setEditingUser(null);
      showToast('Dados atualizados!', 'success');
    } catch (e) {
      showToast('Erro ao atualizar.', 'warning');
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
      showToast('Usuário removido.', 'success');
    } catch (e) {
      showToast('Erro ao remover.', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-24 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Gestão de Equipe</h1>
        <p className="text-slate-500 font-medium italic">As senhas são protegidas automaticamente com SHA-256</p>
      </header>

      {/* MODAL: PROCESSAMENTO - CENTRALIZADO NO VIEWPORT */}
      {isProcessing && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" />
          <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-300">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-800 font-black uppercase text-[10px] tracking-widest">Sincronizando Nuvem...</p>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSÃO - CENTRALIZADO NO VIEWPORT */}
      {userToDelete && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUserToDelete(null)} />
          <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full text-center space-y-6 animate-in zoom-in duration-300 border-4 border-slate-50">
            <h3 className="text-2xl font-black text-slate-800 uppercase">Remover {userToDelete.name}?</h3>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setUserToDelete(null)} className="py-4 rounded-2xl bg-slate-100 font-black uppercase text-xs hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={confirmDelete} className="py-4 rounded-2xl bg-rose-500 text-white font-black uppercase text-xs hover:bg-rose-600 transition-colors">Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIÇÃO - CENTRALIZADO NO VIEWPORT */}
      {editingUser && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in duration-300 border-4 border-slate-50">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Editar Usuário</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome</label>
                <input value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" placeholder="Nome" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">E-mail</label>
                <input value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" placeholder="E-mail" />
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <label className="text-[10px] font-black text-amber-600 uppercase mb-2 block">Nova Senha (opcional)</label>
                <input 
                  type="text"
                  placeholder="Digite para resetar a senha"
                  onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                  className="w-full p-3 rounded-xl bg-white border-none font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Cargo / Role</label>
                <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold">
                  <option value={UserRole.CHAPLAIN}>Capelão</option>
                  <option value={UserRole.ADMIN}>Administrador</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <button onClick={() => setEditingUser(null)} className="py-4 rounded-2xl bg-slate-100 font-black uppercase text-xs hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={handleSaveEdit} className="py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs hover:bg-blue-700 transition-colors">Salvar</button>
            </div>
          </div>
        </div>
      )}

      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Novo Cadastro</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="p-4 rounded-2xl bg-slate-50 border-none font-bold text-xs" placeholder="Nome" />
          <input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="p-4 rounded-2xl bg-slate-50 border-none font-bold text-xs" placeholder="E-mail" />
          <input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="p-4 rounded-2xl bg-slate-50 border-none font-bold text-xs" placeholder="Senha Inicial" />
          <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="p-4 rounded-2xl bg-slate-50 border-none font-bold text-xs">
            <option value={UserRole.CHAPLAIN}>Capelão</option>
            <option value={UserRole.ADMIN}>Administrador</option>
          </select>
          <button onClick={handleAddUser} className="lg:col-span-4 py-5 bg-emerald-600 text-white font-black uppercase text-xs rounded-2xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all">Cadastrar Capelão</button>
        </div>
      </section>

      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Equipe Ativa</h2>
        <div className="grid gap-4">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 group hover:border-blue-200 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 font-black shadow-sm group-hover:scale-105 transition-transform">
                  {u.name[0]}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase text-sm leading-tight">{u.name}</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{u.email} • {u.role}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingUser(u)} className="w-10 h-10 bg-white text-blue-600 rounded-lg shadow-sm flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"><i className="fas fa-edit text-xs"></i></button>
                {u.id !== currentUser.id && (
                  <button onClick={() => setUserToDelete(u)} className="w-10 h-10 bg-white text-rose-500 rounded-lg shadow-sm flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-trash text-xs"></i></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default UserManagement;