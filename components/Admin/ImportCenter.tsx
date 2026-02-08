
import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import AdminLists from './AdminLists';
import AdminDataTools from './AdminDataTools';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';

const ImportCenter: React.FC = () => {
  const { 
    saveToCloud, migrateLegacyStructure, unifyNumericIdsAndCleanPrefixes,
    importFromDNA, proStaff, proSectors, proGroups, users, loadFromCloud 
  } = useApp();
  
  const toast = useToast();
  
  const [activeTool, setActiveTool] = useState<'excel' | 'tools'>('excel');
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ 
    isOpen: false, 
    status: 'idle', 
    title: '', 
    message: '' 
  });

  const handleExportFullDNA = () => {
    const fullDNA = {
      meta: { 
        system: "Capelania Hospitalar Pro", 
        version: "V4.0 (Pure DB)", 
        exportDate: new Date().toISOString(),
        author: "Administrador"
      },
      database: { 
        users, proStaff, proSectors, proGroups 
      }
    };
    const blob = new Blob([JSON.stringify(fullDNA, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BACKUP_SISTEMA_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.showToast("Cópia de segurança gerada com sucesso!", "success");
  };

  const handleSaveProData = async (
    newProStaff: any[], 
    newProSectors: any[], 
    newProGroups: any[]
  ) => {
    try {
      await saveToCloud({
        proStaff: newProStaff,
        proSectors: newProSectors,
        proGroups: newProGroups
      }, true);
      toast.showToast("Base de dados atualizada!", "success");
      return true;
    } catch (e) {
      toast.showToast("Erro ao sincronizar.", "warning");
      return false;
    }
  };

  const handlePrefixCleaning = async () => {
      setSyncState({ 
          isOpen: true, 
          status: 'processing', 
          title: 'Sanitizando IDs', 
          message: 'Removendo prefixos HAB/HABA e unificando registros de colaboradores...' 
      });
      try {
          const res = await unifyNumericIdsAndCleanPrefixes();
          if (res.success) {
              setSyncState({ isOpen: true, status: 'success', title: 'Limpeza Concluída', message: res.message });
          } else {
              setSyncState({ isOpen: true, status: 'error', title: 'Erro na Limpeza', message: res.message });
          }
          return res;
      } catch (e: any) {
          setSyncState({ isOpen: true, status: 'error', title: 'Falha Crítica', message: e.message });
          return { success: false, message: e.message };
      }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <SyncModal 
        isOpen={syncState.isOpen} 
        status={syncState.status} 
        title={syncState.title} 
        message={syncState.message} 
        errorDetails={syncState.error} 
        onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} 
      />

      <header className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] text-white shadow-2xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black uppercase tracking-tighter">Centro de Dados</h1>
            <p className="text-blue-400 text-xs font-black uppercase tracking-widest">Sincronização e Manutenção Preventiva</p>
          </div>
          
          <button 
            onClick={handleExportFullDNA}
            className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] flex items-center gap-4 transition-all shadow-xl shadow-blue-900/50 group active:scale-95"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <i className="fas fa-shield-alt text-xl"></i>
            </div>
            <div className="text-left">
                <span className="block text-[10px] font-black uppercase tracking-widest opacity-70 leading-none">Cofre de Dados</span>
                <span className="text-sm font-black uppercase">Exportar Backup Completo</span>
            </div>
          </button>
        </div>

        <div className="flex bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-md max-w-fit">
          <button onClick={() => setActiveTool('excel')} className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTool === 'excel' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}>Editor Excel</button>
          <button onClick={() => setActiveTool('tools')} className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTool === 'tools' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}>Ferramentas Reset</button>
        </div>
      </header>

      {activeTool === 'excel' ? (
        <AdminLists 
           proData={{ staff: proStaff, sectors: proSectors, groups: proGroups }}
           onSavePro={handleSaveProData}
        />
      ) : (
        <div className="space-y-10">
            <AdminDataTools 
              currentUser={users[0]} 
              onRefreshData={loadFromCloud}
              onRestoreFullDNA={importFromDNA}
              onMigrateLegacy={migrateLegacyStructure}
              onUnifyIds={handlePrefixCleaning}
              isRefreshing={false}
            />
        </div>
      )}
    </div>
  );
};

export default ImportCenter;
