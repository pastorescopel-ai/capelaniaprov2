
import React, { useState, useEffect, useCallback } from 'react';
import { Config } from '../types';
import { useToast } from '../contexts/ToastContext';
import AdminConfig from './Admin/AdminConfig';
import AdminLists from './Admin/AdminLists';
import AdminDataTools from './Admin/AdminDataTools';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';

// No props required anymore, data is pulled from Context
const AdminPanel: React.FC = () => {
  const { 
    config, 
    bibleStudies, bibleClasses, smallGroups, staffVisits, users,
    proStaff, proSectors, proGroups, 
    saveToCloud, loadFromCloud, applySystemOverrides, importFromDNA, migrateLegacyStructure 
  } = useApp();
  
  const { currentUser } = useAuth();
  
  const [localConfig, setLocalConfig] = useState(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSaveProData = async (
    newProStaff: any[], 
    newProSectors: any[], 
    newProGroups: any[]
  ) => {
    setIsSaving(true);
    try {
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
      meta: { system: "Capelania Hospitalar Pro", version: "V3.2.0 (Hybrid)", exportDate: new Date().toISOString(), author: currentUser?.name },
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

  if (!currentUser) return null;

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-32 animate-in fade-in duration-700">
      
      <AdminDataTools 
        currentUser={currentUser} 
        onRefreshData={() => loadFromCloud(true)} 
        onRestoreFullDNA={importFromDNA} 
        onMigrateLegacy={migrateLegacyStructure}
        isRefreshing={isRefreshing} 
      />

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
            <i className="fas fa-download text-amber-400"></i> Baixar Backup JSON
          </button>
          <button onClick={handleSaveAll} className="px-10 py-5 text-white font-black rounded-[1.5rem] shadow-2xl hover:brightness-110 transition-all flex items-center gap-3 uppercase text-[10px] tracking-widest active:scale-95" style={{ backgroundColor: localConfig.primaryColor || '#005a9c' }}>
            <i className={`fas ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-save'}`}></i> {isSaving ? 'Gravando...' : 'Aplicar Mudanças'}
          </button>
        </div>
      </header>

      <AdminConfig config={localConfig} setConfig={setLocalConfig} />
      
      <AdminLists 
        proData={{ staff: proStaff, sectors: proSectors, groups: proGroups }}
        onSavePro={handleSaveProData}
      />
    </div>
  );
};

export default AdminPanel;
