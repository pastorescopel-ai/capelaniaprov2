
import React, { useState, useRef } from 'react';
import { User } from '../../types';
import { useToast } from '../../contexts/ToastContext';

interface AdminDataToolsProps {
  currentUser: User;
  onRefreshData: () => Promise<any>;
  onRestoreFullDNA: (dna: any) => Promise<{ success: boolean; message: string }>;
  onMigrateLegacy: () => Promise<{ success: boolean; message: string; details?: string }>;
  onUnifyIds?: () => Promise<{ success: boolean; message: string }>;
  isRefreshing: boolean;
}

const AdminDataTools: React.FC<AdminDataToolsProps> = ({ currentUser, onRefreshData, onRestoreFullDNA, onMigrateLegacy, onUnifyIds, isRefreshing }) => {
  const { showToast } = useToast();
  const [showDNAConfirm, setShowDNAConfirm] = useState(false);
  const [showMigrationConfirm, setShowMigrationConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingDNA, setPendingDNA] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setIsProcessing(true);
    try {
      const result = await onRestoreFullDNA(pendingDNA);
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
      setIsProcessing(false);
    }
  };

  const confirmMigration = async () => {
    setIsProcessing(true);
    try {
        const result = await onMigrateLegacy();
        if (result.success) {
            showToast(`MIGRAÇÃO SUCESSO! ${result.details || ''}`, "success");
            setShowMigrationConfirm(false);
        } else {
            showToast(`ERRO: ${result.message}`, "warning");
            setShowMigrationConfirm(false);
        }
    } catch (e: any) {
        showToast("Erro técnico: " + e.message, "warning");
        setShowMigrationConfirm(false);
    } finally {
        setIsProcessing(false);
    }
  };

  const confirmUnification = async () => {
    if (!onUnifyIds) return;
    setIsProcessing(true);
    try {
        const result = await onUnifyIds();
        if (result.success) {
            showToast(result.message, "success");
            setShowResetConfirm(false);
        } else {
            showToast(result.message, "warning");
        }
    } catch (e: any) {
        showToast("Falha: " + e.message, "warning");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <>
      {/* MODAL RESTAURAR DNA */}
      {showDNAConfirm && (
        <div className="fixed inset-0 z-[7000]">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => !isProcessing && setShowDNAConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center space-y-8 animate-in zoom-in duration-300 border-4 border-slate-100">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto shadow-inner">
               <i className={`fas ${isProcessing ? 'fa-sync fa-spin' : 'fa-database'}`}></i>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                {isProcessing ? 'Restaurando...' : 'Confirmar Restauração?'}
              </h3>
              <p className="text-slate-500 font-bold text-xs leading-relaxed uppercase tracking-wider px-4">
                {isProcessing 
                  ? 'Processando arquivo de backup. Aguarde...' 
                  : 'Isso irá substituir os dados atuais pelos do backup. Essa ação é irreversível.'}
              </p>
            </div>
            {!isProcessing && (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setShowDNAConfirm(false); setPendingDNA(null); }} className="py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                <button onClick={confirmDNARestore} className="py-4 bg-[#005a9c] text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl hover:brightness-110 transition-all">
                  <i className="fas fa-cloud-upload-alt mr-2"></i> Iniciar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL MIGRAR LEGADO */}
      {showMigrationConfirm && (
        <div className="fixed inset-0 z-[7000]">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => !isProcessing && setShowMigrationConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center space-y-8 animate-in zoom-in duration-300 border-4 border-emerald-50">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto shadow-inner">
               <i className={`fas ${isProcessing ? 'fa-magic fa-spin' : 'fa-bolt'}`}></i>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                {isProcessing ? 'Migrando...' : 'Migrar Estrutura?'}
              </h3>
              <p className="text-slate-500 font-bold text-xs leading-relaxed uppercase tracking-wider px-4">
                {isProcessing 
                  ? 'Lendo listas antigas e convertendo para banco relacional...' 
                  : 'Isso irá ler as listas de texto (Setores) e criar os registros no novo banco de dados. Ideal para corrigir problemas de importação.'}
              </p>
            </div>
            {!isProcessing && (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowMigrationConfirm(false)} className="py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                <button onClick={confirmMigration} className="py-4 bg-emerald-500 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-600 transition-all">
                  <i className="fas fa-check-circle mr-2"></i> Confirmar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL FAXINA E UNIFICAR IDS */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[7000]">
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl" onClick={() => !isProcessing && setShowResetConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center space-y-8 animate-in zoom-in duration-300 border-4 border-rose-100">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto shadow-inner">
               <i className={`fas ${isProcessing ? 'fa-broom fa-spin' : 'fa-magic'}`}></i>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-rose-600 uppercase tracking-tighter">Faxina Total e Unificação</h3>
              <p className="text-slate-500 font-bold text-[10px] leading-relaxed uppercase tracking-widest px-4">
                ATENÇÃO: Colaboradores que nunca foram usados em nenhum registro serão REMOVIDOS. Os ativos serão vinculados a IDs puramente numéricos e os prefixos HAB/HABA serão apagados.
              </p>
            </div>
            {!isProcessing && (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowResetConfirm(false)} className="py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-[10px] tracking-widest">Cancelar</button>
                <button onClick={confirmUnification} className="py-4 bg-rose-600 text-white font-black rounded-2xl uppercase text-[10px] shadow-xl">Iniciar Faxina</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* IMPORTAR JSON */}
        <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-6 shadow-sm hover:border-blue-300 transition-all group">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl group-hover:scale-110 transition-transform">
            <i className="fas fa-file-import text-blue-400"></i>
            </div>
            <div className="flex-1 space-y-2">
            <h3 className="text-slate-800 font-black uppercase text-sm tracking-tight">Restaurar Backup (DNA)</h3>
            <p className="text-slate-500 font-medium text-[10px] leading-relaxed">
                Carregue um arquivo .JSON completo para restaurar o sistema.
            </p>
            </div>
            <div className="relative w-full">
            <button 
                onClick={handleTriggerFileSelect}
                disabled={isProcessing}
                className="w-full py-4 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[9px] tracking-widest shadow-sm hover:bg-slate-200 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
                <i className="fas fa-upload"></i> Selecionar Arquivo
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileSelected} accept=".json" className="hidden" />
            </div>
        </div>

        {/* MIGRAR LEGADO */}
        <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-6 shadow-sm hover:border-emerald-300 transition-all group">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-emerald-200 group-hover:scale-110 transition-transform">
            <i className="fas fa-magic"></i>
            </div>
            <div className="flex-1 space-y-2">
            <h3 className="text-emerald-900 font-black uppercase text-sm tracking-tight">Sincronizar Listas</h3>
            <p className="text-emerald-700/70 font-medium text-[10px] leading-relaxed">
                Converte nomes da Master List para registros no Banco Relacional.
            </p>
            </div>
            <button 
                onClick={() => setShowMigrationConfirm(true)}
                disabled={isProcessing}
                className="w-full py-4 bg-white text-emerald-600 font-black rounded-xl uppercase text-[9px] tracking-widest shadow-sm hover:bg-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2 border border-emerald-200"
            >
                {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>}
                Executar Migração
            </button>
        </div>

        {/* UNIFICAR IDS (Faxina Total) */}
        <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-6 shadow-sm hover:border-rose-300 transition-all group">
            <div className="w-16 h-16 bg-rose-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-rose-200 group-hover:scale-110 transition-transform">
            <i className="fas fa-broom"></i>
            </div>
            <div className="flex-1 space-y-2">
            <h3 className="text-rose-900 font-black uppercase text-sm tracking-tight">Faxina Total</h3>
            <p className="text-rose-700/70 font-medium text-[10px] leading-relaxed">
                Apaga colaboradores não usados e unifica setores por número puro.
            </p>
            </div>
            <button 
                onClick={() => setShowResetConfirm(true)}
                disabled={isProcessing}
                className="w-full py-4 bg-white text-rose-600 font-black rounded-xl uppercase text-[9px] tracking-widest shadow-sm hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2 border border-rose-200"
            >
                {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                Faxina e Limpeza
            </button>
        </div>
      </div>
    </>
  );
};

export default AdminDataTools;
