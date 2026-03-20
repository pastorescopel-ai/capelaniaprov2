
import React, { useState } from 'react';
import { User, EditAuthorization, Unit } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
import Button from '../Shared/Button';

interface AdminEditAuthorizationsProps {
  users: User[];
  authorizations: EditAuthorization[];
  onSave: (auth: Partial<EditAuthorization>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currentUser: User;
}

const TABS_OPTIONS = [
  { id: 'bibleStudies', label: 'Estudo Bíblico' },
  { id: 'bibleClasses', label: 'Classe Bíblica' },
  { id: 'smallGroups', label: 'Pequeno Grupo' },
  { id: 'staffVisits', label: 'Visita Pastoral' },
];

const AdminEditAuthorizations: React.FC<AdminEditAuthorizationsProps> = ({ 
  users, 
  authorizations, 
  onSave, 
  onDelete,
  currentUser 
}) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    allowedTabs: [] as string[],
    monthToUnlock: new Date().toISOString().split('T')[0].substring(0, 7), // YYYY-MM
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
  });

  const handleToggleTab = (tabId: string) => {
    setFormData(prev => ({
      ...prev,
      allowedTabs: prev.allowedTabs.includes(tabId)
        ? prev.allowedTabs.filter(id => id !== tabId)
        : [...prev.allowedTabs, tabId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId) { showToast("Selecione um capelão.", "warning"); return; }
    if (formData.allowedTabs.length === 0) { showToast("Selecione ao menos uma aba.", "warning"); return; }
    if (!formData.monthToUnlock) { showToast("Selecione o mês a desbloquear.", "warning"); return; }
    if (!formData.expiryDate) { showToast("Selecione a data de expiração.", "warning"); return; }

    setIsSubmitting(true);
    try {
      const selectedUser = users.find(u => u.id === formData.userId);
      
      // Ensure monthToUnlock is a valid DATE (YYYY-MM-DD) for Supabase
      const monthToUnlock = formData.monthToUnlock.length === 7 
        ? `${formData.monthToUnlock}-01` 
        : formData.monthToUnlock;

      await onSave({
        ...formData,
        monthToUnlock,
        userName: selectedUser?.name || 'Desconhecido',
        createdBy: currentUser.id,
        createdAt: Date.now()
      });
      showToast("Autorização concedida com sucesso!", "success");
      setFormData({
        userId: '',
        allowedTabs: [],
        monthToUnlock: new Date().toISOString().split('T')[0].substring(0, 7),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    } catch (error) {
      showToast("Erro ao salvar autorização.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeAuths = authorizations.filter(a => new Date(a.expiryDate).getTime() > Date.now());

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">
            <i className="fas fa-user-shield"></i>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Nova Autorização Especial</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Liberação temporária para registros retroativos</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Capelão</label>
            <select 
              value={formData.userId} 
              onChange={e => setFormData({...formData, userId: e.target.value})}
              className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value="">Selecione o capelão...</option>
              {users.filter(u => u.role !== 'ADMIN').sort((a,b) => a.name.localeCompare(b.name)).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Mês a Desbloquear</label>
            <input 
              type="month" 
              value={formData.monthToUnlock}
              onChange={e => setFormData({...formData, monthToUnlock: e.target.value})}
              className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Expira em (Data Final)</label>
            <input 
              type="date" 
              value={formData.expiryDate}
              onChange={e => setFormData({...formData, expiryDate: e.target.value})}
              className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest block mb-2">Abas Autorizadas</label>
            <div className="flex flex-wrap gap-2">
              {TABS_OPTIONS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleToggleTab(tab.id)}
                  className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                    formData.allowedTabs.includes(tab.id)
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm'
                      : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 pt-4">
            <Button 
              type="submit" 
              variant="dark" 
              isLoading={isSubmitting}
              className="w-full py-5 text-[10px] tracking-[0.2em]"
            >
              Conceder Autorização
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Autorizações Ativas</h3>
        </div>

        <div className="grid gap-4">
          {activeAuths.length === 0 ? (
            <div className="bg-slate-50 p-12 rounded-[2.5rem] text-center border-2 border-dashed border-slate-200">
              <i className="fas fa-shield-alt text-4xl text-slate-200 mb-4"></i>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma autorização ativa no momento</p>
            </div>
          ) : (
            activeAuths.map(auth => (
              <div key={auth.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl">
                    <i className="fas fa-user-check"></i>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-tight">{auth.userName}</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {auth.allowedTabs.map(t => (
                        <span key={t} className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                          {TABS_OPTIONS.find(opt => opt.id === t)?.label || t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-center md:text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mês Liberado</p>
                    <p className="text-xs font-black text-indigo-600 uppercase">
                      {(() => {
                        const d = new Date(auth.monthToUnlock);
                        if (isNaN(d.getTime())) return auth.monthToUnlock;
                        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                        const year = d.getUTCFullYear();
                        return `${month}/${year}`;
                      })()}
                    </p>
                  </div>
                  <div className="text-center md:text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Expira em</p>
                    <p className="text-xs font-black text-rose-600 uppercase">{new Date(auth.expiryDate).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <button 
                    onClick={() => onDelete(auth.id!)}
                    className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminEditAuthorizations;
