
import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import AdminLists from './AdminLists';
import AdminDataTools from './AdminDataTools';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import ConfirmationModal from '../Shared/ConfirmationModal';

const ImportCenter: React.FC = () => {
  const { 
    masterLists, saveToCloud, migrateLegacyStructure, nuclearReset, unifyNumericIdsAndCleanPrefixes,
    importFromDNA, proStaff, proSectors, proGroups, users, 
    bibleStudies, bibleClasses, smallGroups, staffVisits, loadFromCloud 
  } = useApp();
  
  // Removed redundant and erroneous showToast declaration to fix circular reference error
  const toast = useToast();
  
  const [activeTool, setActiveTool] = useState<'excel' | 'tools'>('excel');
  const [isNuclearConfirmOpen, setIsNuclearConfirmOpen] = useState(false);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ 
    isOpen: false, 
    status: 'idle', 
    title: '', 
    message: '' 
  });

  const safeJoin = (data: any) => Array.isArray(data) ? data.join('\n') : "";

  const [lists, setLists] = useState({
    sectorsHAB: safeJoin(masterLists?.sectorsHAB),
    sectorsHABA: safeJoin(masterLists?.sectorsHABA),
    groupsHAB: safeJoin(masterLists?.groupsHAB),
    groupsHABA: safeJoin(masterLists?.groupsHABA),
    staffHAB: safeJoin(masterLists?.staffHAB),
    staffHABA: safeJoin(masterLists?.staffHABA),
  });

  const handleExportFullDNA = () => {
    const fullDNA = {
      meta: { 
        system: "Capelania Hospitalar Pro", 
        version: "V3.5.1 (Fixed)", 
        exportDate: new Date().toISOString(),
        author: "Administrador"
      },
      database: { 
        bibleStudies, bibleClasses, smallGroups, staffVisits, users, 
        masterLists, proStaff, proSectors, proGroups 
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
    newProGroups: any[],
    updatedMasterLists: any
  ) => {
    try {
      await saveToCloud({
        proStaff: newProStaff,
        proSectors: newProSectors,
        proGroups: newProGroups,
        masterLists: updatedMasterLists
      }, true);
      toast.showToast("Base de dados atualizada!", "success");
    } catch (e) {
      toast.showToast("Erro ao sincronizar.", "warning");
    }
  };

  const handleNuclearReset = async () => {
    setIsNuclearConfirmOpen(false);
    setSyncState({ 
      isOpen: true, 
      status: 'processing', 
      title: 'Reset Nuclear', 
      message: 'Verificando listas e reconstruindo banco...' 
    });
    try {
        const res = await nuclearReset();
        if(res.success) {
            setSyncState({ isOpen: true, status: 'success', title: 'Sucesso!', message: res.message });
        } else {
            setSyncState({ isOpen: true, status: 'error', title: 'Falha na Reconstrução', message: res.message });
        }
    } catch(e: any) {
        setSyncState({ isOpen: true, status: 'error', title: 'Erro de Sistema', message: e.message });
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

      <ConfirmationModal 
        isOpen={isNuclearConfirmOpen}
        title="Deseja Limpar e Reconstruir?"
        message="Atenção: Os setores atuais serão apagados e recriados a partir das listas do Excel, limpando duplicatas e prefixos. Registros de visitas serão mantidos."
        confirmLabel="Sim, Executar Limpeza"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleNuclearReset}
        onCancel={() => setIsNuclearConfirmOpen(false)}
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
           lists={lists} 
           setLists={setLists} 
           proData={{ staff: proStaff, sectors: proSectors, groups: proGroups }}
           onSavePro={handleSaveProData}
        />
      ) : (
        <div className="space-y-10">
            <section className="bg-rose-50 border-4 border-rose-100 p-10 rounded-[3rem] space-y-6">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center text-3xl shadow-xl">
                        <i className="fas fa-radiation"></i>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-rose-900 uppercase tracking-tighter">Limpeza Nuclear</h2>
                        <p className="text-rose-700/70 text-xs font-bold uppercase">Normalização de IDs e Expurgos de Duplicatas</p>
                    </div>
                </div>
                <div className="bg-white/70 p-6 rounded-2xl border border-rose-200 text-[10px] font-bold text-rose-800 uppercase tracking-widest leading-relaxed">
                    Importante: Esta ação utiliza as listas de texto atuais para reconstruir as tabelas relacionais. Se as listas do Excel estiverem vazias, o processo falhará para proteger a integridade dos dados.
                </div>
                <button 
                    onClick={() => setIsNuclearConfirmOpen(true)}
                    className="w-full py-6 bg-rose-600 text-white font-black rounded-2xl uppercase text-xs shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95"
                >
                    Executar Limpeza e Reconstrução Total
                </button>
            </section>

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
