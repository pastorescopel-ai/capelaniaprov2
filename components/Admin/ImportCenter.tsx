
import React, { useState, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import AdminLists from './AdminLists';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';

const ImportCenter: React.FC = () => {
  const { 
    saveToCloud, importFromDNA, proStaff, proSectors, proGroups, users, loadFromCloud 
  } = useApp();
  
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ 
    isOpen: false, 
    status: 'idle', 
    title: '', 
    message: '' 
  });

  // Restore States
  const [showDNAConfirm, setShowDNAConfirm] = useState(false);
  const [pendingDNA, setPendingDNA] = useState<any>(null);
  const [isRestoring, setIsRestoring] = useState(false);

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

  // --- RESTORE LOGIC ---
  const handleTriggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const dna = JSON.parse(event.target?.result as string);
        setPendingDNA(dna.database || dna);
        setShowDNAConfirm(true);
      } catch (err) {
        toast.showToast("Erro ao ler JSON: " + (err as Error).message, "warning");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; 
  };

  const confirmDNARestore = async () => {
    if (!pendingDNA) return;
    setIsRestoring(true);
    try {
      const result = await importFromDNA(pendingDNA);
      if (result.success) {
        toast.showToast(`SUCESSO: ${result.message}`, "success");
        setShowDNAConfirm(false);
        setPendingDNA(null);
      } else {
        toast.showToast(`FALHA: ${result.message}`, "warning");
      }
    } catch (err) {
      toast.showToast("Falha crítica: " + (err as Error).message, "warning");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      
      {/* RESTORE CONFIRM MODAL */}
      {showDNAConfirm && (
        <div className="fixed inset-0 z-[7000]">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => !isRestoring && setShowDNAConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center space-y-8 animate-in zoom-in duration-300 border-4 border-slate-100">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto shadow-inner">
               <i className={`fas ${isRestoring ? 'fa-sync fa-spin' : 'fa-database'}`}></i>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                {isRestoring ? 'Restaurando...' : 'Confirmar Restauração?'}
              </h3>
              <p className="text-slate-500 font-bold text-xs leading-relaxed uppercase tracking-wider px-4">
                {isRestoring 
                  ? 'Processando arquivo de backup. Aguarde...' 
                  : 'Isso irá substituir os dados atuais pelos do backup. Essa ação é irreversível.'}
              </p>
            </div>
            {!isRestoring && (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setShowDNAConfirm(false); setPendingDNA(null); }} className="py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                <button onClick={confirmDNARestore} className="py-4 bg-amber-500 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl hover:bg-amber-600 transition-all">
                  <i className="fas fa-check-circle mr-2"></i> Confirmar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" onChange={handleFileSelected} accept=".json" className="hidden" />

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
          
          <div className="flex gap-3">
            <button 
                onClick={handleTriggerFileSelect}
                className="px-8 py-5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-[1.5rem] flex items-center gap-3 transition-all shadow-xl active:scale-95 border border-slate-700"
            >
                <i className="fas fa-upload text-xl"></i>
                <div className="text-left hidden sm:block">
                    <span className="block text-[8px] font-black uppercase tracking-widest opacity-70 leading-none">Restauração</span>
                    <span className="text-xs font-black uppercase">Importar Backup</span>
                </div>
            </button>

            <button 
                onClick={handleExportFullDNA}
                className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] flex items-center gap-4 transition-all shadow-xl shadow-blue-900/50 group active:scale-95"
            >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <i className="fas fa-shield-alt text-xl"></i>
                </div>
                <div className="text-left">
                    <span className="block text-[10px] font-black uppercase tracking-widest opacity-70 leading-none">Cofre de Dados</span>
                    <span className="text-sm font-black uppercase">Exportar Backup</span>
                </div>
            </button>
          </div>
        </div>
      </header>

      <AdminLists 
         proData={{ staff: proStaff, sectors: proSectors, groups: proGroups }}
         onSavePro={handleSaveProData}
      />
    </div>
  );
};

export default ImportCenter;
