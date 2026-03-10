
import React, { useState, useEffect, useCallback } from 'react';
import { Config } from '../types';
import { useToast } from '../contexts/ToastContext';
import AdminConfig from './Admin/AdminConfig';
import AdminLists from './Admin/AdminLists';
import AdminDataTools from './Admin/AdminDataTools';
import { useApp } from '../hooks/useApp';
import { useAuth } from '../contexts/AuthContext';

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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Cards de Ação Rápida em Ferramentas */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center gap-4 hover:shadow-md transition-all">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl">
                  <i className="fas fa-key"></i>
                </div>
                <h3 className="font-black uppercase text-xs tracking-widest text-slate-800">Chave API Pro</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">Configuração de acesso aos recursos avançados de IA e BI.</p>
                <button 
                  onClick={async () => {
                    try {
                      if (window.aistudio && window.aistudio.openSelectKey) {
                        await window.aistudio.openSelectKey();
                        window.location.reload();
                      } else {
                        showToast("Recurso indisponível neste ambiente.", "warning");
                      }
                    } catch (e) {
                      showToast("Erro ao abrir seletor de chave.", "error");
                    }
                  }}
                  className="mt-2 px-8 py-3 bg-indigo-600 text-white font-black rounded-xl uppercase text-[9px] tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                >
                  Configurar Agora
                </button>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center gap-4 hover:shadow-md transition-all">
                <div className="w-16 h-16 bg-slate-800 text-amber-400 rounded-2xl flex items-center justify-center text-2xl">
                  <i className="fas fa-download"></i>
                </div>
                <h3 className="font-black uppercase text-xs tracking-widest text-slate-800">Backup Completo</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">Baixe uma cópia de segurança de todo o banco de dados em formato JSON.</p>
                <button 
                  onClick={handleExportFullDNA}
                  className="mt-2 px-8 py-3 bg-slate-800 text-white font-black rounded-xl uppercase text-[9px] tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg"
                >
                  Baixar Backup
                </button>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center gap-4 hover:shadow-md transition-all">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-2xl">
                  <i className="fas fa-database"></i>
                </div>
                <h3 className="font-black uppercase text-xs tracking-widest text-slate-800">Correção de Banco (SQL)</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">Se o editor de cabeçalhos não estiver salvando, execute este comando no SQL Editor do Supabase.</p>
                <button 
                  onClick={() => {
                    const sql = `ALTER TABLE app_config ADD COLUMN IF NOT EXISTS header_profiles JSONB;`;
                    navigator.clipboard.writeText(sql);
                    showToast("Comando SQL copiado!", "success");
                  }}
                  className="mt-2 px-8 py-3 bg-amber-600 text-white font-black rounded-xl uppercase text-[9px] tracking-widest hover:bg-amber-700 transition-all active:scale-95 shadow-lg shadow-amber-200"
                >
                  Copiar Comando SQL
                </button>
              </div>
            </div>

            <AdminDataTools 
              currentUser={currentUser} 
              onRefreshData={() => loadFromCloud(true)} 
              onRestoreFullDNA={importFromDNA} 
              isRefreshing={isRefreshing} 
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
