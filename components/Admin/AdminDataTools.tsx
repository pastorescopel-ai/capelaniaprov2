
import React, { useState, useRef, useEffect } from 'react';
import { User, ProStaff, ProSector, ProGroup, ProGroupMember, ProGroupProviderMember, Ambassador, Unit, ProMonthlyStats, ProHistoryRecord } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
import { supabase } from '../../services/supabaseClient';
import ForceSyncModal from './ForceSyncModal';
import SyncModal from '../Shared/SyncModal';
import GlobalCloseMonthModal from './GlobalCloseMonthModal';
import GlobalReopenMonthModal from './GlobalReopenMonthModal';

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
  const [isForceSyncModalOpen, setIsForceSyncModalOpen] = useState(false);
  const [isCloseConfirmModalOpen, setIsCloseConfirmModalOpen] = useState(false);
  const [isReopenConfirmModalOpen, setIsReopenConfirmModalOpen] = useState(false);
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
    setIsCloseConfirmModalOpen(true);
  };

  const confirmCloseMonth = async () => {
    setIsCloseConfirmModalOpen(false);
    const isAlreadyClosed = proData.stats?.some(s => s.month === selectedCloseMonth);
    const actionText = isAlreadyClosed ? 'ATUALIZAR' : 'FECHAR';
    
    setSyncState({ isOpen: true, status: 'processing', title: `${actionText === 'FECHAR' ? 'Fechamento' : 'Atualização'} Global`, message: 'Processando HAB e HABA. Aguarde...' });

    try {
        // 1. LIMPAR REGISTROS ANTIGOS (Se for atualização)
        if (isAlreadyClosed) {
            await deleteRecordsByFilter('proMonthlyStats', { month: selectedCloseMonth });
            await deleteRecordsByFilter('proHistoryRecords', { month: selectedCloseMonth });
        }

        const snapshots: ProMonthlyStats[] = [];
        const historyRecords: any[] = [];
        const units = [Unit.HAB, Unit.HABA];
        const targetDate = new Date(selectedCloseMonth + 'T12:00:00');

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

        // 3. GERAR HISTÓRICO INDIVIDUAL COMPLETO (proHistoryRecords)
        // Captura TODOS os colaboradores da unidade, matriculados ou não
        unitStaff.forEach(staff => {
            const staffId = String(staff.id);
            
            // Buscar matrícula ativa (CLT ou Prestador)
            const membership = proGroupMembers.find(m => String(m.staffId) === staffId && !m.leftAt) || 
                               proGroupProviderMembers.find(m => String(m.staffId) === staffId && !m.leftAt);
            
            const sector = proData.sectors.find(s => String(s.id) === String(staff.sectorId || membership?.sectorId));
            const group = membership ? proData.groups.find(g => String(g.id) === String(membership.groupId)) : null;

            historyRecords.push({
                month: selectedCloseMonth,
                unit,
                staffId: staff.id,
                staffName: staff.name,
                registrationId: staff.registrationId || '',
                sectorId: staff.sectorId || membership?.sectorId || 'unassigned',
                sectorName: sector?.name || 'Sem Setor',
                groupId: membership?.groupId || '',
                groupName: group?.name || '',
                leaderName: group?.currentLeader || null,
                role: membership ? (proGroupMembers.some(m => String(m.staffId) === staffId) ? 'CLT' : 'PRESTADOR') : 'N/A',
                isEnrolled: !!membership,
                joinedAt: membership?.joinedAt ? (typeof membership.joinedAt === 'string' ? new Date(membership.joinedAt).getTime() : membership.joinedAt) : null,
                leftAt: membership?.leftAt ? (typeof membership.leftAt === 'string' ? new Date(membership.leftAt).getTime() : membership.leftAt) : null,
                createdAt: Date.now()
            });
        });
    }

    // 3.5 GERAR SNAPSHOT DE SUMÁRIO GLOBAL (Para Relatórios Travados)
    for (const unit of units) {
        const targetMonth = selectedCloseMonth.substring(0, 7); // YYYY-MM
        
        // Filtrar dados da capelania para o mês
        const monthStudies = chaplaincyData.bibleStudies.filter(s => s.unit === unit && s.date?.startsWith(targetMonth));
        const monthClasses = chaplaincyData.bibleClasses.filter(c => c.unit === unit && c.date?.startsWith(targetMonth));
        const monthGroups = chaplaincyData.smallGroups.filter(g => g.unit === unit && g.date?.startsWith(targetMonth));
        const monthVisits = chaplaincyData.staffVisits.filter(v => v.unit === unit && v.date?.startsWith(targetMonth));

        // Calcular alunos únicos nas classes
        const uniqueStudents = new Set();
        monthClasses.forEach(c => {
            if (Array.isArray(c.students)) {
                c.students.forEach((s: string) => uniqueStudents.add(s));
            }
        });

        // Calcular estatísticas por capelão para este sumário
        const unitChaplainStats = users.map(user => {
            const uS = monthStudies.filter(s => s.userId === user.id);
            const uC = monthClasses.filter(c => c.userId === user.id);
            const uG = monthGroups.filter(g => g.userId === user.id);
            const uV = monthVisits.filter(v => v.userId === user.id);
            
            const names = new Set<string>();
            uS.forEach(s => s.name && names.add(s.name.toLowerCase().trim()));
            uC.forEach(c => c.students?.forEach((n: string) => n && names.add(n.toLowerCase().trim())));

            return {
                userId: user.id,
                userName: user.name,
                studies: uS.length,
                classes: uC.length,
                groups: uG.length,
                visits: uV.length,
                students: names.size,
                total: uS.length + uC.length + uG.length + uV.length
            };
        }).filter(s => s.total > 0 || s.students > 0);

        // Calcular métricas PRO para o sumário baseadas no snapshot que acabamos de criar
        const unitHistory = historyRecords.filter(r => r.unit === unit);
        const enrolledStaffCount = unitHistory.filter(r => r.isEnrolled).length;
        const totalStaffCount = unitHistory.length;
        
        const pgPercentage = totalStaffCount > 0 ? (enrolledStaffCount / totalStaffCount) * 100 : 0;
        const activeGroupsCount = new Set(unitHistory.filter(r => r.isEnrolled).map(r => r.groupId)).size;

        snapshots.push({
            month: selectedCloseMonth,
            unit,
            type: 'pg',
            targetId: 'all',
            totalStaff: totalStaffCount,
            totalParticipants: enrolledStaffCount,
            activeGroups: activeGroupsCount,
            percentage: pgPercentage,
            goal: 80,
            snapshotData: {
                totalColaboradores: totalStaffCount,
                performanceMetrics: {
                    pgPercentage,
                    totalBibleStudies: monthStudies.length,
                    totalBibleClasses: monthClasses.length,
                    totalSmallGroups: monthGroups.length,
                    totalStaffVisits: monthVisits.length,
                    totalUniqueStudents: uniqueStudents.size,
                    chaplainStats: unitChaplainStats
                }
            }
        });
    }

        // 4. SALVAR TUDO
        if (historyRecords.length > 0) {
            await saveRecord('proHistoryRecords', historyRecords);
        }
        
        await saveRecord('proMonthlyStats', snapshots);

        setSyncState({ isOpen: true, status: 'success', title: 'Mês Atualizado', message: `Sucesso! ${snapshots.length} estatísticas e ${historyRecords.length} registros de histórico gravados para ${formatMonthLabel(selectedCloseMonth)} (HAB + HABA).` });
        await onRefreshData();
    } catch (e: any) {
        setSyncState({ isOpen: true, status: 'error', title: 'Erro no Processo', message: "Falha ao gravar dados globais.", error: e.message });
    }
  };

  const handleReopenMonth = async () => {
    setIsReopenConfirmModalOpen(true);
  };

  const confirmReopenMonth = async () => {
    setIsReopenConfirmModalOpen(false);
    setSyncState({ isOpen: true, status: 'processing', title: 'Reabrindo Mês', message: 'Removendo registros do histórico...' });

    try {
        await deleteRecordsByFilter('proMonthlyStats', { month: selectedCloseMonth });
        await deleteRecordsByFilter('proHistoryRecords', { month: selectedCloseMonth });

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
      <GlobalCloseMonthModal 
        isOpen={isCloseConfirmModalOpen}
        onCancel={() => setIsCloseConfirmModalOpen(false)}
        onConfirm={confirmCloseMonth}
        selectedMonth={selectedCloseMonth}
        isProcessing={isProcessing}
        isAlreadyClosed={isMonthClosed}
      />
      <GlobalReopenMonthModal 
        isOpen={isReopenConfirmModalOpen}
        onCancel={() => setIsReopenConfirmModalOpen(false)}
        onConfirm={confirmReopenMonth}
        selectedMonth={selectedCloseMonth}
        isProcessing={isProcessing}
      />
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
