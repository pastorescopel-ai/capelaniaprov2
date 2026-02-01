
import React, { useState, useRef } from 'react';
import { User } from '../../types';

interface AdminDataToolsProps {
  currentUser: User;
  onRefreshData: () => Promise<any>;
  onRestoreFullDNA: (dna: any) => Promise<{ success: boolean; message: string }>;
  isRefreshing: boolean;
}

const AdminDataTools: React.FC<AdminDataToolsProps> = ({ currentUser, onRefreshData, onRestoreFullDNA, isRefreshing }) => {
  const [showDNAConfirm, setShowDNAConfirm] = useState(false);
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
        alert("Erro ao ler JSON: " + (err as Error).message);
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
        alert(`SUCESSO: ${result.message}`);
        setShowDNAConfirm(false);
        setPendingDNA(null);
      } else {
        alert(`FALHA NA IMPORTAÇÃO: ${result.message}`);
      }
    } catch (err) {
      alert("Falha crítica no processo: " + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {showDNAConfirm && (
        <div className="fixed inset-0 z-[7000]">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md" />
          
          {/* Modal Box - Real Center */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center space-y-8 animate-in zoom-in duration-300 border-4 border-slate-100">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto shadow-inner">
               <i className={`fas ${isProcessing ? 'fa-sync fa-spin' : 'fa-database'}`}></i>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                {isProcessing ? 'Migrando Dados...' : 'Confirmar Migração?'}
              </h3>
              <p className="text-slate-500 font-bold text-xs leading-relaxed uppercase tracking-wider px-4">
                {isProcessing 
                  ? 'Por favor, não feche o app. Estamos transferindo todos os registros para o Supabase Cloud...' 
                  : 'Isso irá substituir ou mesclar os dados atuais pelos dados do arquivo de backup (DNA). Essa ação enviará tudo para o banco de dados.'}
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

      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 shadow-sm mb-8 hover:border-blue-300 transition-all group">
        <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white text-3xl shadow-xl group-hover:scale-110 transition-transform duration-300">
          <i className="fas fa-file-import text-blue-400"></i>
        </div>
        
        <div className="flex-1 text-center md:text-left space-y-2">
          <h3 className="text-slate-800 font-black uppercase text-xl tracking-tight">Importar Backup (DNA)</h3>
          <p className="text-slate-500 font-medium text-xs leading-relaxed">
            Utilize esta ferramenta para migrar dados de planilhas antigas ou restaurar backups anteriores.
            <br/><span className="text-blue-600 font-bold uppercase text-[10px] tracking-wider">Compatível com a nova estrutura Supabase.</span>
          </p>
        </div>
        
        <div className="relative">
          <button 
            onClick={handleTriggerFileSelect}
            className="px-8 py-5 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-sm hover:bg-slate-200 hover:text-slate-800 transition-all active:scale-95 flex items-center gap-3"
          >
            <i className="fas fa-upload"></i> Selecionar Arquivo
          </button>
          <input 
            ref={fileInputRef}
            type="file" 
            onChange={handleFileSelected} 
            accept=".json" 
            className="hidden" 
          />
        </div>
      </div>
    </>
  );
};

export default AdminDataTools;
