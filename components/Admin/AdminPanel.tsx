
import React, { useState, useEffect, useRef } from 'react';
import { Config } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import AdminConfig from './Admin/AdminConfig';
import AdminLists from './Admin/AdminLists';
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
  
  // --- RESTORE STATES (Integrated) ---
  const [showDNAConfirm, setShowDNAConfirm] = useState(false);
  const [pendingDNA, setPendingDNA] = useState<any>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // --- RESTORE LOGIC (Integrated) ---
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
        showToast("Erro ao ler JSON: " + (err as Error).message, "warning");
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
        showToast(`SUCESSO: ${result.message}`, "success");
        setShowDNAConfirm(false);
        setPendingDNA(null);
      } else {
        showToast(`FALHA: ${result.message}`, "warning");
      }
    } catch (err) {
      showToast("Falha crítica: " + (err as Error).message, "warning");
    } finally {
      setIsRestoring(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-32 animate-in fade-in duration-700">
      
      {/* MODAL RESTAURAR DNA (Confirmation Overlay) */}
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

      {/* Hidden File Input */}
      <input ref={fileInputRef} type="file" onChange={handleFileSelected} accept=".json" className="hidden" />

      {/* HEADER WITH INTEGRATED BUTTONS */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Administração</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle Central do Ecossistema</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleManualRefresh} className={`px-5 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm`}>
            <i className={`fas fa-sync-alt ${isRefreshing ? 'animate-spin' : ''}`}></i> Sincronizar Agora
          </button>
          
          <button onClick={handleTriggerFileSelect} className="px-5 py-4 bg-amber-50 text-amber-700 font-black rounded-2xl hover:bg-amber-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-amber-100">
            <i className="fas fa-file-import"></i> Restaurar Backup
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
