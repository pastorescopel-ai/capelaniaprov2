
import React, { useState, useRef, useEffect } from 'react';
import { User, ProStaff, ProSector, ProGroup, ProGroupMember, Ambassador, Unit, ProMonthlyStats } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
import { supabase } from '../../services/supabaseClient';
import ForceSyncModal from './ForceSyncModal';
import SyncModal from '../Shared/SyncModal';

interface AdminDataToolsProps {
  currentUser: User;
  onRefreshData: () => Promise<any>;
  onRestoreFullDNA: (dna: any) => Promise<{ success: boolean; message: string }>;
  isRefreshing: boolean;
  proData: {
    staff: ProStaff[];
    sectors: ProSector[];
    groups: ProGroup[];
    stats?: ProMonthlyStats[];
  };
  ambassadors: Ambassador[];
  proGroupMembers: ProGroupMember[];
  proGroupProviderMembers: ProGroupProviderMember[];
  saveRecord: (collection: string, item: any) => Promise<any>;
  deleteRecord: (collection: string, id: string) => Promise<any>;
}

const AdminDataTools: React.FC<AdminDataToolsProps> = ({ 
  currentUser, onRefreshData, onRestoreFullDNA, isRefreshing,
  proData, ambassadors, proGroupMembers, proGroupProviderMembers, saveRecord, deleteRecord
}) => {
  const { showToast } = useToast();
  const [showDNAConfirm, setShowDNAConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isForceSyncModalOpen, setIsForceSyncModalOpen] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [pendingDNA, setPendingDNA] = useState<any>(null);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ isOpen: false, status: 'idle', title: '', message: '' });
  const [selectedCloseMonth, setSelectedCloseMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });

  // Efeito para sugerir o mês em aberto automaticamente
  useEffect(() => {
    if (!proData.stats) return;

    const now = new Date();
    const currentMonthISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthISO = prevMonth.toISOString().split('T')[0];

    // Verifica se o mês anterior está fechado
    const isPrevClosed = proData.stats.some(s => s.month === prevMonthISO);
    
    // Se o anterior não estiver fechado, sugere ele. 
    // Se estiver, sugere o atual.
    const suggestedMonth = isPrevClosed ? currentMonthISO : prevMonthISO;
    
    // Só atualiza se o usuário ainda não tiver mudado manualmente para algo diferente do "hoje" inicial
    // ou se acabamos de realizar um fechamento (detectado pela mudança no stats)
    setSelectedCloseMonth(suggestedMonth);
  }, [proData.stats]);

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

  const handleCloseMonth = async () => {
    const isAlreadyClosed = proData.stats?.some(s => s.month === selectedCloseMonth);
    const actionText = isAlreadyClosed ? 'ATUALIZAR' : 'FECHAR';
    
    const confirm = window.confirm(`Deseja ${actionText} o mês de ${formatMonthLabel(selectedCloseMonth)} para TODAS as unidades (HAB e HABA)? ${isAlreadyClosed ? 'Os dados anteriores serão sobrescritos pelos atuais.' : 'Isso gravará os percentuais como definitivos.'}`);
    if (!confirm) return;

    setSyncState({ isOpen: true, status: 'processing', title: `${actionText === 'FECHAR' ? 'Fechamento' : 'Atualização'} Global`, message: 'Processando HAB e HABA. Aguarde...' });

    try {
        // Se já estiver fechado, precisamos limpar os registros antigos primeiro para evitar duplicidade
        if (isAlreadyClosed && proData.stats) {
            const recordsToDelete = proData.stats.filter(s => s.month === selectedCloseMonth);
            for (const rec of recordsToDelete) {
                if (rec.id) await deleteRecord('proMonthlyStats', rec.id);
            }
        }

        const snapshots: ProMonthlyStats[] = [];
        const units = [Unit.HAB, Unit.HABA];
        const targetDate = new Date(selectedCloseMonth);

        for (const unit of units) {
            const unitStaff = proData.staff.filter(s => {
                if (s.unit !== unit) return false;
                if (s.active === false) return false;
                const leftDate = s.leftAt ? new Date(s.leftAt) : null;
                return !leftDate || leftDate >= targetDate;
            });

            const staffBySector = new Map<string, ProStaff[]>();
            const unassignedStaff: ProStaff[] = [];

            unitStaff.forEach(s => {
                const sId = String(s.sectorId || '').trim();
                if (sId && proData.sectors.some(sec => String(sec.id) === sId)) {
                    if (!staffBySector.has(sId)) staffBySector.set(sId, []);
                    staffBySector.get(sId)?.push(s);
                } else {
                    unassignedStaff.push(s);
                }
            });

            // 1. Snapshots de Setores
            proData.sectors.filter(s => s.unit === unit && s.active !== false).forEach(sector => {
                const sectorId = String(sector.id);
                const staffInSector = staffBySector.get(sectorId) || [];
                const ambassadorsInSector = ambassadors.filter(a => a.sectorId === sectorId && a.unit === unit && a.cycleMonth === selectedCloseMonth);
                
                const totalStaff = staffInSector.length;
                const totalParticipants = ambassadorsInSector.length;
                const percentage = totalStaff > 0 ? (totalParticipants / totalStaff) * 100 : 0;

                snapshots.push({
                    month: selectedCloseMonth,
                    type: 'sector',
                    targetId: sectorId,
                    totalStaff,
                    totalParticipants,
                    percentage,
                    goal: 5,
                    unit
                });
            });

            // 1.1 Snapshot de "Sem Setor"
            if (unassignedStaff.length > 0) {
                const enrolledUnassigned = unassignedStaff.filter(s => 
                    proGroupMembers.some(m => 
                        String(m.staffId) === String(s.id) && 
                        (!m.cycleMonth || new Date(m.cycleMonth) <= targetDate) && 
                        (!m.leftAt || m.leftAt >= targetDate.getTime())
                    )
                ).length;

                snapshots.push({
                    month: selectedCloseMonth,
                    type: 'sector',
                    targetId: 'unassigned',
                    totalStaff: unassignedStaff.length,
                    totalParticipants: enrolledUnassigned,
                    percentage: (enrolledUnassigned / unassignedStaff.length) * 100,
                    goal: 0,
                    unit
                });
            }

            // 2. Snapshots de PGs
            proData.groups.filter(g => g.unit === unit && g.active !== false).forEach(group => {
                const groupId = String(group.id);
                const members = proGroupMembers.filter(m => String(m.groupId) === groupId && !m.leftAt);
                const sectorId = String(group.sectorId || '');
                const staffInSector = sectorId ? (staffBySector.get(sectorId) || []) : [];
                
                const totalS = staffInSector.length;
                const totalP = members.length;
                const percentage = totalS > 0 ? (totalP / totalS) * 100 : 0;

                snapshots.push({
                    month: selectedCloseMonth,
                    type: 'pg',
                    targetId: groupId,
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

        setSyncState({ isOpen: true, status: 'success', title: 'Mês Atualizado', message: `Sucesso! ${snapshots.length} registros de histórico gravados/atualizados para ${formatMonthLabel(selectedCloseMonth)} (HAB + HABA).` });
        await onRefreshData();
    } catch (e: any) {
        setSyncState({ isOpen: true, status: 'error', title: 'Erro no Processo', message: "Falha ao gravar estatísticas globais.", error: e.message });
    }
  };

  const handleReopenMonth = async () => {
    const confirm = window.confirm(`ATENÇÃO: Deseja REABRIR o mês de ${formatMonthLabel(selectedCloseMonth)}? Isso apagará o histórico definitivo e os relatórios voltarão a calcular os dados "ao vivo".`);
    if (!confirm) return;

    setSyncState({ isOpen: true, status: 'processing', title: 'Reabrindo Mês', message: 'Removendo registros do histórico...' });

    try {
        if (proData.stats) {
            const recordsToDelete = proData.stats.filter(s => s.month === selectedCloseMonth);
            if (recordsToDelete.length === 0) {
                showToast("Não existem dados de fechamento para este mês.", "warning");
                setSyncState(prev => ({ ...prev, isOpen: false }));
                return;
            }

            for (const rec of recordsToDelete) {
                if (rec.id) await deleteRecord('proMonthlyStats', rec.id);
            }
        }

        setSyncState({ isOpen: true, status: 'success', title: 'Mês Reaberto', message: `O mês de ${formatMonthLabel(selectedCloseMonth)} foi reaberto com sucesso. Os dados agora são calculados em tempo real.` });
        await onRefreshData();
    } catch (e: any) {
        setSyncState({ isOpen: true, status: 'error', title: 'Erro ao Reabrir', message: "Falha ao remover registros do histórico.", error: e.message });
    }
  };

  const isMonthClosed = proData.stats?.some(s => s.month === selectedCloseMonth);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });

  const handleForceSync = async () => {
    setIsForceSyncModalOpen(false);
    setIsProcessing(true);
    try {
      let success = true;
      
      if (proGroupMembers.length > 0) {
        const toSyncCLT = proGroupMembers.map(m => ({
            ...m,
            cycleMonth: selectedMonth,
            joinedAt: new Date(selectedMonth + 'T12:00:00').getTime(),
            leftAt: null,
            isError: false
        }));
        const resCLT = await saveRecord('proGroupMembers', toSyncCLT);
        if (!resCLT) success = false;
      }

      if (proGroupProviderMembers.length > 0) {
        const toSyncProv = proGroupProviderMembers.map((m: any) => ({
            ...m,
            cycleMonth: selectedMonth,
            joinedAt: new Date(selectedMonth + 'T12:00:00').getTime(),
            leftAt: null,
            isError: false
        }));
        const resProv = await saveRecord('proGroupProviderMembers', toSyncProv);
        if (!resProv) success = false;
      }

      if (success) {
        showToast(`Sincronização forçada concluída para ${formatMonthLabel(selectedMonth)}!`, "success");
        await onRefreshData();
      } else {
        showToast("Falha parcial ou total na sincronização.", "warning");
      }
    } catch (err) {
      showToast("Erro na sincronização: " + (err as Error).message, "warning");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <SyncModal isOpen={syncState.isOpen} status={syncState.status} title={syncState.title} message={syncState.message} errorDetails={syncState.error} onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} />
      <ForceSyncModal 
        isOpen={isForceSyncModalOpen} 
        onClose={() => setIsForceSyncModalOpen(false)} 
        onConfirm={handleForceSync}
        cltCount={proGroupMembers.length}
        providerCount={proGroupProviderMembers.length}
      />
      
      {/* FERRAMENTA DE FECHAMENTO - DESTAQUE NO TOPO */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${isMonthClosed ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'} rounded-2xl flex items-center justify-center text-xl transition-colors`}>
                <i className={`fas ${isMonthClosed ? 'fa-lock' : 'fa-archive'}`}></i>
              </div>
              <div>
                <h3 className="text-slate-800 font-black uppercase text-sm tracking-tight">
                  {isMonthClosed ? 'Mês Encerrado Oficialmente' : 'Fechamento de Mês Oficial'}
                </h3>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                  {isMonthClosed ? 'Os dados deste período estão congelados no histórico' : 'Grave os indicadores de todas as unidades como definitivos'}
                </p>
              </div>
            </div>
            {isMonthClosed && (
              <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded-full tracking-widest animate-pulse">
                Histórico Ativo
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
              <label className="text-[9px] font-black text-slate-400 uppercase px-2">Período:</label>
              <input 
                type="month" 
                value={selectedCloseMonth.substring(0, 7)} 
                onChange={(e) => setSelectedCloseMonth(e.target.value + '-01')}
                className="bg-transparent border-none rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:ring-0"
              />
            </div>

            <button 
              onClick={handleCloseMonth} 
              className={`flex-1 md:flex-none px-10 py-4 ${isMonthClosed ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} text-white rounded-2xl font-black text-[10px] uppercase shadow-lg transition-all flex items-center justify-center gap-3 tracking-widest active:scale-95`}
            >
              <i className={`fas ${isMonthClosed ? 'fa-sync-alt' : 'fa-check-circle'}`}></i> 
              {isMonthClosed ? 'Atualizar Fechamento' : 'Executar Fechamento'} ({formatMonthLabel(selectedCloseMonth)})
            </button>

            {isMonthClosed && (
              <button 
                onClick={handleReopenMonth} 
                className="px-6 py-4 bg-rose-50 text-rose-600 font-black rounded-2xl hover:bg-rose-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-rose-100"
              >
                <i className="fas fa-lock-open"></i> Reabrir Mês
              </button>
            )}

            <div className="flex-1"></div>

            <button onClick={onRefreshData} className={`px-6 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-emerald-100`}>
              <i className={`fas fa-sync-alt ${isRefreshing ? 'animate-spin' : ''}`}></i> Sincronizar Agora
            </button>
          </div>
      </div>

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
      <div className="flex justify-center">
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
    </>
  );
};

export default AdminDataTools;
