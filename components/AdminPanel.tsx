
import React, { useState, useEffect, useCallback } from 'react';
import { Config, Unit } from '../types';
import { useToast } from '../contexts/ToastProvider';
import AdminConfig from './Admin/AdminConfig';
import AdminLists from './Admin/AdminLists';
import AdminDataTools from './Admin/AdminDataTools';
import AdminEditAuthorizations from './Admin/AdminEditAuthorizations';
import { useApp } from '../hooks/useApp';
import { useAuth } from '../contexts/AuthProvider';

const AdminPanel: React.FC = () => {
  const { 
    config, 
    bibleStudies, bibleClasses, smallGroups, staffVisits, users,
    proStaff, proSectors, proGroups, proGroupMembers, proGroupProviderMembers, proMonthlyStats, proHistoryRecords, ambassadors,
    editAuthorizations,
    saveToCloud, loadFromCloud, applySystemOverrides, importFromDNA, saveRecord, deleteRecord, deleteRecordsByFilter
  } = useApp();
  
  const { currentUser } = useAuth();
  
  const [localConfig, setLocalConfig] = useState(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeUnit, setActiveUnit] = useState<Unit>(Unit.HAB);
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

  const [activeTab, setActiveTab] = useState<'config' | 'identity' | 'lists' | 'tools' | 'permissions'>('config');

  // Lógica para notificação de fechamento de mês
  const previousMonthClosed = useCallback(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevISO = prev.toISOString().split('T')[0];
    return proMonthlyStats.some(s => s.month === prevISO);
  }, [proMonthlyStats]);

  const getPreviousMonthLabel = () => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return prev.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-32 animate-in fade-in duration-700">
      
      {/* Notificação de Fechamento Pendente */}
      {!previousMonthClosed() && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4 animate-bounce-subtle">
          <div className="flex items-center gap-3 text-amber-800">
            <i className="fas fa-exclamation-triangle text-xl"></i>
            <div>
              <p className="text-[11px] font-black uppercase tracking-tight">Fechamento Pendente</p>
              <p className="text-[10px] font-bold opacity-80">O mês de <span className="uppercase">{getPreviousMonthLabel()}</span> ainda não foi encerrado oficialmente.</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('tools')}
            className="px-4 py-2 bg-amber-600 text-white text-[9px] font-black uppercase rounded-xl hover:bg-amber-700 transition-all shadow-sm"
          >
            Resolver Agora
          </button>
        </div>
      )}

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
          { id: 'permissions', label: 'Permissões', icon: 'fa-user-shield' },
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
            proData={{ 
              staff: proStaff, 
              sectors: proSectors, 
              groups: proGroups,
              memberships: proGroupMembers,
              providerMemberships: proGroupProviderMembers,
              stats: proMonthlyStats
            }}
            onSavePro={handleSaveProData}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
        )}

        {activeTab === 'permissions' && (
          <AdminEditAuthorizations 
            users={users}
            authorizations={editAuthorizations}
            onSave={(auth) => saveRecord('editAuthorizations', auth)}
            onDelete={(id) => deleteRecord('editAuthorizations', id)}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'tools' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AdminDataTools 
              currentUser={currentUser} 
              users={users}
              onRefreshData={() => loadFromCloud(true)} 
              onRestoreFullDNA={importFromDNA} 
              isRefreshing={isRefreshing} 
              proData={{ 
                staff: proStaff, 
                sectors: proSectors, 
                groups: proGroups, 
                stats: proMonthlyStats,
                history: proHistoryRecords,
                providers: proProviders
              }}
              chaplaincyData={{
                bibleStudies,
                bibleClasses,
                smallGroups,
                staffVisits
              }}
              ambassadors={ambassadors}
              proGroupMembers={proGroupMembers}
              proGroupProviderMembers={proGroupProviderMembers}
              saveRecord={saveRecord}
              deleteRecord={deleteRecord}
              deleteRecordsByFilter={deleteRecordsByFilter}
            />

            {/* Cards de Ação Secundária */}
            <div className="grid md:grid-cols-2 gap-6">
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
