
import React, { useState, useRef } from 'react';
import { User, ProStaff, ProSector, ProGroup, ProGroupMember, Ambassador, Unit, ProMonthlyStats } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
import { supabase } from '../../services/supabaseClient';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';

interface AdminDataToolsProps {
  currentUser: User;
  onRefreshData: () => Promise<any>;
  onRestoreFullDNA: (dna: any) => Promise<{ success: boolean; message: string }>;
  isRefreshing: boolean;
  proData: {
    staff: ProStaff[];
    sectors: ProSector[];
    groups: ProGroup[];
  };
  ambassadors: Ambassador[];
  proGroupMembers: ProGroupMember[];
  saveRecord: (collection: string, item: any) => Promise<any>;
}

const AdminDataTools: React.FC<AdminDataToolsProps> = ({ 
  currentUser, onRefreshData, onRestoreFullDNA, isRefreshing,
  proData, ambassadors, proGroupMembers, saveRecord
}) => {
  const { showToast } = useToast();
  const [showDNAConfirm, setShowDNAConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [pendingDNA, setPendingDNA] = useState<any>(null);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ isOpen: false, status: 'idle', title: '', message: '' });
  const [selectedCloseMonth, setSelectedCloseMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
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

  const handleGenerateSnapshot = async () => {
    if (!supabase) {
        showToast("Erro de conexão com o banco.", "warning");
        return;
    }
    setIsSnapshotting(true);
    try {
        const { error } = await supabase.rpc('capture_daily_snapshot');
        if (error) {
            console.error("Erro RPC:", error);
            showToast("Erro ao processar snapshot.", "warning");
        } else {
            showToast("Snapshot BI processado com sucesso!", "success");
            await onRefreshData(); 
        }
    } catch (e: any) {
        showToast("Exceção: " + e.message, "warning");
    } finally {
        setIsSnapshotting(false);
    }
  };

  const handleCloseMonth = async () => {
    const confirm = window.confirm(`Deseja fechar o mês de ${formatMonthLabel(selectedCloseMonth)} para TODAS as unidades (HAB e HABA)? Isso gravará os percentuais como definitivos.`);
    if (!confirm) return;

    setSyncState({ isOpen: true, status: 'processing', title: 'Fechamento Global', message: 'Processando HAB e HABA. Aguarde...' });

    try {
        const snapshots: ProMonthlyStats[] = [];
        const units = [Unit.HAB, Unit.HABA];

        for (const unit of units) {
            // 1. Snapshots de Setores (Embaixadores)
            proData.sectors.filter(s => s.unit === unit && s.active !== false).forEach(sector => {
                const staffInSector = proData.staff.filter(s => s.sectorId === sector.id && s.unit === unit && s.active !== false);
                const ambassadorsInSector = ambassadors.filter(a => a.sectorId === sector.id && a.unit === unit && a.cycleMonth === selectedCloseMonth);
                
                const totalStaff = staffInSector.length;
                const totalParticipants = ambassadorsInSector.length;
                const percentage = totalStaff > 0 ? (totalParticipants / totalStaff) * 100 : 0;

                snapshots.push({
                    month: selectedCloseMonth,
                    type: 'sector',
                    targetId: sector.id,
                    totalStaff,
                    totalParticipants,
                    percentage,
                    goal: 5,
                    unit
                });
            });

            // 2. Snapshots de PGs
            proData.groups.filter(g => g.unit === unit && g.active !== false).forEach(group => {
                const members = proGroupMembers.filter(m => m.groupId === group.id && !m.leftAt);
                const sector = proData.sectors.find(s => s.id === group.sectorId);
                const staffInSector = sector ? proData.staff.filter(s => s.sectorId === sector.id && s.unit === unit && s.active !== false) : [];
                
                const totalS = staffInSector.length;
                const totalP = members.length;
                const percentage = totalS > 0 ? (totalP / totalS) * 100 : 0;

                snapshots.push({
                    month: selectedCloseMonth,
                    type: 'pg',
                    targetId: group.id,
                    totalStaff: totalS,
                    totalParticipants: totalP,
                    percentage,
                    goal: 80,
                    unit
                });
            });
        }

        for (const snap of snapshots) {
            await saveRecord('proMonthlyStats', snap);
        }

        setSyncState({ isOpen: true, status: 'success', title: 'Mês Fechado', message: `Sucesso! ${snapshots.length} registros de histórico gravados para ${formatMonthLabel(selectedCloseMonth)} (HAB + HABA).` });
    } catch (e: any) {
        setSyncState({ isOpen: true, status: 'error', title: 'Erro no Fechamento', message: "Falha ao gravar estatísticas globais.", error: e.message });
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

      <div className="flex justify-center mb-8">
        <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-6 shadow-sm hover:border-blue-300 transition-all group w-full max-w-md">
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
      </div>

      {/* FERRAMENTAS DE DADOS - BARRA SUPERIOR */}
      <div className="flex flex-wrap gap-4 justify-center md:justify-end mb-8 items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <label className="text-[9px] font-black text-slate-400 uppercase px-2">Mês de Fechamento:</label>
            <input 
              type="month" 
              value={selectedCloseMonth.substring(0, 7)} 
              onChange={(e) => setSelectedCloseMonth(e.target.value + '-01')}
              className="bg-white border-none rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:ring-0 shadow-sm"
            />
          </div>

          <button 
            onClick={handleCloseMonth} 
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[9px] uppercase shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-3 tracking-widest active:scale-95"
            title="Grava os percentuais atuais como definitivos para o histórico"
          >
            <i className="fas fa-archive"></i> Fechar Mês ({formatMonthLabel(selectedCloseMonth)})
          </button>

          <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

          <button 
            onClick={handleGenerateSnapshot} 
            disabled={isSnapshotting}
            className="px-6 py-4 bg-indigo-50 text-indigo-600 font-black rounded-2xl hover:bg-indigo-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-indigo-100"
          >
            <i className={`fas ${isSnapshotting ? 'fa-circle-notch fa-spin' : 'fa-camera'}`}></i>
            <span>{isSnapshotting ? 'Processando...' : 'Atualizar Dados BI'}</span>
          </button>

          <button onClick={onRefreshData} className={`px-6 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-emerald-100`}>
            <i className={`fas fa-sync-alt ${isRefreshing ? 'animate-spin' : ''}`}></i> Sincronizar Agora
          </button>
      </div>
    </>
  );
};

export default AdminDataTools;
