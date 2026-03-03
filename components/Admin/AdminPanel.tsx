
import React, { useState, useEffect } from 'react';
import { Config } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import AdminConfig from './AdminConfig';
import AdminLists from './AdminLists';
import AdminDataTools from './AdminDataTools';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';

const AdminPanel: React.FC = () => {
  const { 
    config, 
    bibleStudies, bibleClasses, smallGroups, staffVisits, users,
    proStaff, proSectors, proGroups, 
    saveToCloud, loadFromCloud, applySystemOverrides, importFromDNA
  } = useApp();
  
  const { currentUser } = useAuth();
  
  const [localConfig, setLocalConfig] = useState(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Função para salvar dados PRO (Moderno)
  const handleSaveProData = async (
    newProStaff: any[], 
    newProSectors: any[], 
    newProGroups: any[]
  ) => {
    setIsSaving(true);
    try {
      // Salvar apenas no Supabase (Tabelas Relacionais)
      await saveToCloud({
        proStaff: newProStaff,
        proSectors: newProSectors,
        proGroups: newProGroups
      });

      showToast("Banco de Dados Profissional atualizado com sucesso!", "success");
      return true;
    } catch (e) {
      showToast("Erro ao salvar dados PRO.", "warning");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try { 
      await loadFromCloud(true); 
      showToast("Banco de dados atualizado!", "success");
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const handleExportFullDNA = () => {
    const fullDNA = {
      meta: { system: "Capelania Hospitalar Pro", version: "V4.0 (Pure DB)", exportDate: new Date().toISOString(), author: currentUser?.name },
      database: { 
        bibleStudies, bibleClasses, smallGroups, staffVisits, users, config: localConfig,
        proStaff, proSectors, proGroups 
      }
    };
    const blob = new Blob([JSON.stringify(fullDNA, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `BACKUP_SISTEMA_${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const finalConfig = { ...localConfig, lastModifiedBy: currentUser?.name || 'Admin', lastModifiedAt: Date.now() };
      await saveToCloud({ config: applySystemOverrides(finalConfig) }, true);
      showToast('Configurações salvas no Supabase!', 'success');
    } catch (error) { 
      showToast('Falha ao salvar configurações.', 'warning'); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const [activeTab, setActiveTab] = useState<'config' | 'identity' | 'lists' | 'tools'>('config');

  if (!currentUser) return null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-32 animate-in fade-in duration-700">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Administração</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle Central do Ecossistema</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleManualRefresh} className={`px-5 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm`}>
            <i className={`fas fa-sync-alt ${isRefreshing ? 'animate-spin' : ''}`}></i> Sincronizar Agora
          </button>
          <button onClick={handleExportFullDNA} className="px-5 py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-black transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-lg">
            <i className="fas fa-download text-amber-400"></i> Backup JSON
          </button>
          <button onClick={handleSaveAll} className="px-10 py-5 text-white font-black rounded-[1.5rem] shadow-2xl hover:brightness-110 transition-all flex items-center gap-3 uppercase text-[10px] tracking-widest active:scale-95" style={{ backgroundColor: localConfig.primaryColor || '#005a9c' }}>
            <i className={`fas ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-save'}`}></i> {isSaving ? 'Gravando...' : 'Aplicar Mudanças'}
          </button>
        </div>
      </header>

      {/* Navegação de Abas Admin */}
      <nav className="flex overflow-x-auto no-scrollbar gap-2 bg-slate-100 p-2 rounded-[2rem] border border-slate-200">
        {[
          { id: 'config', label: 'Configurações', icon: 'fa-cog' },
          { id: 'identity', label: 'Identidade Visual', icon: 'fa-palette' },
          { id: 'lists', label: 'Listas & PGs', icon: 'fa-list-ul' },
          { id: 'tools', label: 'Ferramentas', icon: 'fa-tools' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white text-slate-800 shadow-sm scale-105' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <i className={`fas ${tab.icon}`}></i>
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="animate-in fade-in slide-in-from-top-4 duration-500">
        {activeTab === 'config' && (
          <AdminConfig config={localConfig} setConfig={setLocalConfig} mode="basic" />
        )}

        {activeTab === 'identity' && (
          <AdminConfig config={localConfig} setConfig={setLocalConfig} mode="identity" />
        )}

        {activeTab === 'lists' && (
          <AdminLists 
            proData={{ staff: proStaff, sectors: proSectors, groups: proGroups }}
            onSavePro={handleSaveProData}
          />
        )}

        {activeTab === 'tools' && (
          <AdminDataTools 
            currentUser={currentUser} 
            onRefreshData={() => loadFromCloud(true)} 
            onRestoreFullDNA={importFromDNA} 
            isRefreshing={isRefreshing} 
          />
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
