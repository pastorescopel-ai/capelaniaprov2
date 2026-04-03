
import React, { useState, useRef, useMemo } from 'react';
import { User, ProStaff, ProSector, ProGroup, ProGroupMember, ProGroupProviderMember, ProProvider, Ambassador, ProMonthlyStats, ProHistoryRecord } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import { cleanID } from '../../utils/formatters';
import { Unit } from '../../types';

interface AdminDataToolsProps {
  currentUser: User;
  users: User[];
  onRefreshData: () => Promise<any>;
  onRestoreFullDNA: (dna: any) => Promise<{ success: boolean; message: string }>;
  isRefreshing: boolean;
  proData: {
    staff: ProStaff[];
    sectors: ProSector[];
    groups: ProGroup[];
    stats?: ProMonthlyStats[];
    history?: ProHistoryRecord[];
    providers?: ProProvider[];
  };
  chaplaincyData: {
    bibleStudies: any[];
    bibleClasses: any[];
    smallGroups: any[];
    staffVisits: any[];
  };
  ambassadors: Ambassador[];
  proGroupMembers: ProGroupMember[];
  proGroupProviderMembers: ProGroupProviderMember[];
  saveRecord: (collection: string, item: any) => Promise<any>;
  deleteRecord: (collection: string, id: string) => Promise<any>;
  deleteRecordsByFilter: (collection: string, filters: Record<string, any>) => Promise<any>;
}

const AdminDataTools: React.FC<AdminDataToolsProps> = ({ 
  currentUser, users, onRefreshData, onRestoreFullDNA, isRefreshing,
  proData, chaplaincyData, ambassadors, proGroupMembers, proGroupProviderMembers, saveRecord, deleteRecord, deleteRecordsByFilter
}) => {
  const { showToast } = useToast();
  const [showDNAConfirm, setShowDNAConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingDNA, setPendingDNA] = useState<any>(null);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ isOpen: false, status: 'idle', title: '', message: '' });
  const [activeAuditUnit, setActiveAuditUnit] = useState<Unit>(Unit.HAB);
  const [isAuditing, setIsAuditing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatMonthLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

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

  // LÓGICA DE AUDITORIA SQL VIRTUAL
  const auditResults = useMemo(() => {
    const staff = proData.staff.filter(s => s.unit === activeAuditUnit);
    const groups = new Map<string, ProStaff[]>();
    
    staff.forEach(s => {
      const cid = cleanID(s.id);
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid)?.push(s);
    });

    const duplicates: { id: string, records: ProStaff[] }[] = [];
    groups.forEach((records, id) => {
      if (records.length > 1) {
        duplicates.push({ id, records });
      }
    });

    return duplicates;
  }, [proData.staff, activeAuditUnit]);

  const handleFixDuplicate = async (records: ProStaff[]) => {
    setIsAuditing(true);
    try {
      // Mantemos o registro que for 'active' ou o que tiver cycleMonth mais recente
      const sorted = [...records].sort((a, b) => {
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return (b.cycleMonth || '').localeCompare(a.cycleMonth || '');
      });

      const winner = sorted[0];
      const losers = sorted.slice(1);

      // Desativar os perdedores permanentemente
      for (const loser of losers) {
        await saveRecord('proStaff', { 
          ...loser, 
          active: false, 
          leftAt: Date.now(), 
          updatedAt: Date.now(),
          notes: (loser.notes || '') + ' [AUDITORIA: Desativado por duplicidade]'
        });
      }

      showToast(`Sucesso! ${losers.length} duplicata(s) desativada(s) para o ID ${winner.id}.`, "success");
      await onRefreshData();
    } catch (err) {
      showToast("Erro na auditoria: " + (err as Error).message, "warning");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <>
      <SyncModal isOpen={syncState.isOpen} status={syncState.status} title={syncState.title} message={syncState.message} errorDetails={syncState.error} onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} />
      
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

      {/* RESTAURAR BACKUP */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-6 shadow-sm hover:border-blue-300 transition-all group w-full">
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

        {/* AUDITORIA DE INTEGRIDADE */}
        <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-6 shadow-sm hover:border-rose-300 transition-all group w-full">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
              <i className="fas fa-search-plus"></i>
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-slate-800 font-black uppercase text-sm tracking-tight">Auditoria de IDs (SQL Virtual)</h3>
              <p className="text-slate-500 font-medium text-[10px] leading-relaxed">
                  Detecta e resolve duplicatas de IDs que causam erros de contagem (ex: 1701 vs 1700).
              </p>
            </div>

            <div className="flex bg-slate-50 p-1 rounded-xl gap-1 w-full">
              {['HAB', 'HABA'].map(u => (
                <button 
                  key={u} 
                  onClick={() => setActiveAuditUnit(u as any)}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${activeAuditUnit === u ? 'bg-white shadow text-rose-600' : 'text-slate-400'}`}
                >
                  Unidade {u}
                </button>
              ))}
            </div>

            <div className="w-full space-y-3">
              {auditResults.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar pr-2">
                  {auditResults.map((dup, idx) => (
                    <div key={idx} className="bg-rose-50 p-3 rounded-xl border border-rose-100 flex items-center justify-between gap-3">
                      <div className="text-left">
                        <span className="block text-[10px] font-black text-rose-600 uppercase tracking-widest">ID: {dup.id}</span>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">{dup.records.length} registros encontrados</span>
                      </div>
                      <button 
                        onClick={() => handleFixDuplicate(dup.records)}
                        disabled={isAuditing}
                        className="px-3 py-2 bg-rose-600 text-white rounded-lg text-[8px] font-black uppercase shadow-sm hover:bg-rose-700 transition-all disabled:opacity-50"
                      >
                        {isAuditing ? '...' : 'Corrigir'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 text-[9px] font-black uppercase tracking-widest">
                  <i className="fas fa-check-circle mr-2"></i> Nenhuma duplicata detectada
                </div>
              )}
            </div>
        </div>
      </div>
    </>
  );
};

export default AdminDataTools;
