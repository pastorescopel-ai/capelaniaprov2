
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, UserRole, ProMonthlyStats } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { usePro } from '../../contexts/ProContext';
import { useBible } from '../../contexts/BibleContext';
import { getTimestamp, cleanID, getStudentKey, countUniqueClasses, countUniqueStudents } from '../../utils/formatters';
import { getValidSectorId } from '../../utils/sectorValidation';
import { toCamel } from '../../utils/transformers';
import { DataRepository } from '../../services/dataRepository';
import { supabase } from '../../services/supabaseClient';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import GlobalCloseMonthModal from '../Admin/GlobalCloseMonthModal';
import GlobalReopenMonthModal from '../Admin/GlobalReopenMonthModal';
import ForceSyncModal from '../Admin/ForceSyncModal';
import Autocomplete from '../Shared/Autocomplete';

interface PGClosingProps {
  unit: Unit;
}

const PGClosing: React.FC<PGClosingProps> = ({ unit }) => {
  const { 
    users, bibleStudies, bibleClasses, smallGroups, staffVisits, ambassadors,
    saveRecord, deleteRecordsByFilter, loadFromCloud
  } = useApp();
  
  const {
    proStaff, proSectors, proGroups, proGroupMembers, proGroupProviderMembers,
    proMonthlyStats, proProviders, proHistoryRecords
  } = usePro();

  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCloseConfirmModalOpen, setIsCloseConfirmModalOpen] = useState(false);
  const [isReopenConfirmModalOpen, setIsReopenConfirmModalOpen] = useState(false);
  const [isForceSyncModalOpen, setIsForceSyncModalOpen] = useState(false);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ 
    isOpen: false, status: 'idle', title: '', message: '' 
  });
  
  const [selectedCloseMonth, setSelectedCloseMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });

  // --- CORREÇÃO PONTUAL DE COLABORADOR EM MÊS FECHADO (sem reabrir o mês) ---
  const [correctionStaffId, setCorrectionStaffId] = useState('');
  const [correctionNewSectorId, setCorrectionNewSectorId] = useState('');
  const [correctionNewGroupId, setCorrectionNewGroupId] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  const correctionStaffOptions = useMemo(() => {
    return (proHistoryRecords || [])
      .filter(r => r.month === selectedCloseMonth && r.unit === unit && r.isEnrolled)
      .map(r => ({
        value: String(r.staffId),
        label: `${r.staffName} (${r.sectorName || 'Sem Setor'})`,
        subLabel: r.groupName || 'Sem PG',
        category: 'History' as const
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [proHistoryRecords, selectedCloseMonth, unit]);

  const selectedCorrectionRecord = useMemo(() => {
    if (!correctionStaffId) return null;
    return (proHistoryRecords || []).find(r => r.month === selectedCloseMonth && r.unit === unit && String(r.staffId) === correctionStaffId) || null;
  }, [proHistoryRecords, selectedCloseMonth, unit, correctionStaffId]);

  const handleApplyClosedMonthCorrection = async () => {
    if (!correctionStaffId || !correctionNewSectorId) {
      showToast('Selecione o colaborador e o novo setor.', 'warning');
      return;
    }
    if (!supabase) {
      showToast('Sem conexão com o banco.', 'error');
      return;
    }
    setIsCorrecting(true);
    try {
      const { data, error } = await supabase.rpc('admin_correct_closed_month_staff', {
        p_month: selectedCloseMonth,
        p_unit: unit,
        p_staff_id: Number(cleanID(correctionStaffId)),
        p_new_sector_id: Number(correctionNewSectorId),
        p_new_group_id: correctionNewGroupId ? Number(correctionNewGroupId) : null
      });
      if (error) throw new Error(error.message);
      const isError = typeof data === 'string' && data.startsWith('Erro:');
      showToast(data, isError ? 'error' : 'success');
      if (!isError) {
        setCorrectionStaffId('');
        setCorrectionNewSectorId('');
        setCorrectionNewGroupId('');
        await loadFromCloud(true);
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsCorrecting(false);
    }
  };

  useEffect(() => {
    if (!proMonthlyStats || proMonthlyStats.length === 0) return;

    const now = new Date();
    const currentMonthISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthISO = prevMonth.toISOString().split('T')[0];

    const isPrevClosed = proMonthlyStats.some(s => s.month === prevMonthISO);
    const suggestedMonth = isPrevClosed ? currentMonthISO : prevMonthISO;
    
    // Only update if it's different to avoid unnecessary renders
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCloseMonth(prev => prev !== suggestedMonth ? suggestedMonth : prev);
  }, [proMonthlyStats]);

  const formatMonthLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleCloseMonth = async () => {
    setIsCloseConfirmModalOpen(true);
  };

  const confirmCloseMonth = async () => {
    setIsCloseConfirmModalOpen(false);
    // Defesa extra: a aba "Fechamento" já é escondida de quem não é Admin em
    // PGManagerLayout.tsx, e a regra do banco também recusa a escrita -- esta checagem
    // aqui é só uma segunda trava, caso a tela seja alcançada por outro caminho.
    if (currentUser?.role !== UserRole.ADMIN) {
      showToast('Apenas administradores podem fechar o mês.', 'error');
      return;
    }
    const isAlreadyClosed = proMonthlyStats?.some(s => s.month === selectedCloseMonth);
    const actionText = isAlreadyClosed ? 'ATUALIZAR' : 'FECHAR';
    
    setSyncState({ 
      isOpen: true, 
      status: 'processing', 
      title: `${actionText === 'FECHAR' ? 'Fechamento' : 'Atualização'} de PGs`, 
      message: 'Processando indicadores de Pequenos Grupos. Aguarde...' 
    });

    try {
        // 1. LIMPAR REGISTROS ANTIGOS (Se for atualização)
        if (isAlreadyClosed) {
            await deleteRecordsByFilter('proMonthlyStats', { month: selectedCloseMonth });
            await deleteRecordsByFilter('proHistoryRecords', { month: selectedCloseMonth });
        }

        const snapshots: ProMonthlyStats[] = [];
        const historyRecords: any[] = [];
        const units = [Unit.HAB, Unit.HABA];

        for (const u of units) {
            // A planilha enviada ANTES do fechamento sempre prevalece — mesmo que ela só tenha sido
            // importada nos primeiros dias do mês seguinte (fluxo normal: importa a planilha do mês
            // X, depois fecha o mês X). Por isso o universo de colaboradores do mês é simplesmente
            // quem está ATIVO agora, no momento do fechamento — não uma reconstrução por createdAt/
            // leftAt, que tentava adivinhar quem "existia" no mês usando datas que nem sempre refletem
            // o mês de competência real (ex: leftAt fica com a data em que uma planilha foi importada,
            // não com o mês a que ela se refere, e planilhas atrasadas inflavam a contagem de meses
            // já fechados com gente que nunca esteve na planilha daquele mês).
            const unitStaff = proStaff.filter(s => s.unit === u && s.active !== false);

            const staffBySector = new Map<string, any[]>();
            const unassignedStaff: any[] = [];

            unitStaff.forEach(s => {
                const sId = String(s.sectorId || '').trim();
                if (sId && proSectors.some(sec => String(sec.id) === sId)) {
                    if (!staffBySector.has(sId)) staffBySector.set(sId, []);
                    staffBySector.get(sId)?.push(s);
                } else {
                    unassignedStaff.push(s);
                }
            });

            // 1. Snapshots de Setores
            proSectors.filter(s => s.unit === u && s.active !== false).forEach(sector => {
                const sectorId = String(sector.id);
                const staffInSector = staffBySector.get(sectorId) || [];
                const ambassadorsInSector = ambassadors.filter(a => a.sectorId === sectorId && a.unit === u && a.cycleMonth === selectedCloseMonth);
                
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
                    unit: u
                });
            });

            // 1.1 Snapshot de "Sem Setor"
            if (unassignedStaff.length > 0) {
                const enrolledUnassigned = unassignedStaff.filter(s =>
                    proGroupMembers.some(m =>
                        String(m.staffId) === String(s.id) &&
                        !m.leftAt && m.isError !== true
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
                    unit: u
                });
            }

            // 2. Snapshots de PGs
            proGroups.filter(g => g.unit === u && g.active !== false).forEach(group => {
                const groupId = String(group.id);
                const members = proGroupMembers.filter(m =>
                    String(m.groupId) === groupId &&
                    !m.leftAt && m.isError !== true
                );
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
                    unit: u
                });
            });

            // 3. GERAR HISTÓRICO INDIVIDUAL COMPLETO
            // Otimização: Criar um mapa de matrículas ativas para a unidade atual no mês alvo
            const activeMembershipsInUnit = proGroupMembers.filter(m => {
                const group = proGroups.find(g => g.id === m.groupId);
                if (!group || group.unit !== u) return false;
                return !m.leftAt && m.isError !== true;
            });

            const membershipMap = new Map(activeMembershipsInUnit.map(m => [cleanID(m.staffId), m]));

            // 3.1 PROCESSAR COLABORADORES (CLT)
            unitStaff.forEach(staff => {
                const staffIdClean = cleanID(staff.id);
                const membership = membershipMap.get(staffIdClean);
                
                const validSectorId = getValidSectorId(staff.sectorId, u, proSectors);
                const sector = validSectorId ? proSectors.find(s => cleanID(s.id) === cleanID(validSectorId)) : null;
                const group = membership ? proGroups.find(g => cleanID(g.id) === cleanID(membership.groupId)) : null;

                historyRecords.push({
                    month: selectedCloseMonth,
                    unit: u,
                    staffId: staff.id,
                    staffName: staff.name,
                    sectorId: validSectorId || null,
                    sectorName: sector?.name || 'Sem Setor',
                    groupId: membership?.groupId || null,
                    groupName: group?.name || '',
                    leaderName: group?.currentLeader || null,
                    role: 'CLT',
                    isEnrolled: !!membership,
                    joinedAt: getTimestamp(membership?.joinedAt),
                    leftAt: getTimestamp(membership?.leftAt),
                    createdAt: Date.now()
                });
            });

            // 3.5 SNAPSHOT DE SUMÁRIO GLOBAL (Para Relatórios)
            const targetMonth = selectedCloseMonth.substring(0, 7);
            const monthStudies = bibleStudies.filter(s => s.unit === u && s.date?.startsWith(targetMonth));
            const monthClasses = bibleClasses.filter(c => c.unit === u && c.date?.startsWith(targetMonth));
            const monthGroups = smallGroups.filter(g => g.unit === u && g.date?.startsWith(targetMonth));
            const monthVisits = staffVisits.filter(v => v.unit === u && v.date?.startsWith(targetMonth));

            // Mesma lógica de deduplicação usada no relatório ao vivo (useReportLogic.ts):
            // inclui Estudos Bíblicos individuais (não só Classes) e usa staffId/participantId
            // reais como chave quando disponíveis, em vez do nome puro — evita que pessoas
            // diferentes com nome igual/genérico (comum em Pacientes/Prestadores) sejam
            // contadas como uma só.
            const uniqueStudents = new Set<string>();
            monthStudies.forEach(s => {
                const key = getStudentKey(s.name, (s as any).staffId || (s as any).participantId);
                if (key) uniqueStudents.add(key);
            });
            monthClasses.forEach(c => {
                if (Array.isArray(c.students)) {
                    c.students.forEach((s: string) => {
                        const key = getStudentKey(s);
                        if (key) uniqueStudents.add(key);
                    });
                }
            });

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
                    // "studies" nesse breakdown por capelão conta alunos únicos, não sessões --
                    // mesma regra usada em todo o app agora (dar 3 estudos pro mesmo aluno conta
                    // como 1). "total" continua somando sessões brutas (volume de trabalho).
                    studies: countUniqueStudents(uS),
                    classes: uC.length,
                    groups: uG.length,
                    visits: uV.length,
                    students: names.size,
                    total: uS.length + uC.length + uG.length + uV.length
                };
            }).filter(s => s.total > 0 || s.students > 0);

            const unitHistory = historyRecords.filter(r => r.unit === u);
            const enrolledStaffCount = unitHistory.filter(r => r.isEnrolled).length;
            const totalStaffCount = unitHistory.length;
            const pgPercentage = totalStaffCount > 0 ? (enrolledStaffCount / totalStaffCount) * 100 : 0;
            const activeGroupsCount = new Set(unitHistory.filter(r => r.isEnrolled).map(r => r.groupId)).size;

            snapshots.push({
                month: selectedCloseMonth,
                unit: u,
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
                        // Deduplicado por turma (mesmo grupo de alunos = 1 turma), igual ao
                        // relatório ao vivo (useReportLogic.ts) — antes contava linha por linha,
                        // o que diverge do relatório assim que uma turma se reunir 2x no mês.
                        totalBibleClasses: countUniqueClasses(monthClasses),
                        totalSmallGroups: monthGroups.length,
                        totalStaffVisits: monthVisits.length,
                        totalUniqueStudents: uniqueStudents.size,
                        chaplainStats: unitChaplainStats
                    }
                }
            } as any);
        }

        // 4. SALVAR TUDO
        if (historyRecords.length > 0) {
            await saveRecord('proHistoryRecords', historyRecords);
        }
        await saveRecord('proMonthlyStats', snapshots);

        setSyncState({ 
          isOpen: true, 
          status: 'success', 
          title: 'Mês Encerrado', 
          message: `Sucesso! O fechamento de ${formatMonthLabel(selectedCloseMonth)} foi concluído para Gestão de PGs.` 
        });
        await loadFromCloud(true);
    } catch (e: any) {
        setSyncState({ 
          isOpen: true, 
          status: 'error', 
          title: 'Erro no Fechamento', 
          message: "Falha ao gravar indicadores de fechamento.", 
          error: e.message 
        });
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

        setSyncState({ 
          isOpen: true, 
          status: 'success', 
          title: 'Mês Reaberto', 
          message: `O mês de ${formatMonthLabel(selectedCloseMonth)} foi reaberto com sucesso.` 
        });
        await loadFromCloud(true);
    } catch (e: any) {
        setSyncState({ 
          isOpen: true, 
          status: 'error', 
          title: 'Erro ao Reabrir', 
          message: "Falha ao remover registros do histórico.", 
          error: e.message 
        });
    }
  };

  const handleForceSync = async () => {
    setIsForceSyncModalOpen(false);
    setSyncState({ isOpen: true, status: 'processing', title: 'Sincronizando Matrículas', message: 'Carregando dados mais recentes e processando rematrículas...' });
    
    try {
      // Garantir dados atualizados antes de processar
      await loadFromCloud(true);
      
      const now = new Date(selectedCloseMonth + 'T12:00:00');
      const prevMonthDate = new Date(now);
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const prevMonthISO = prevMonthDate.toISOString().split('T')[0];

      // BUSCAR HISTÓRICO DO MÊS ANTERIOR DIRETAMENTE DO SUPABASE
      const historyRes = await DataRepository.fetchFullTable('pro_history_records', 199999);
      const prevMonthHistory = toCamel(historyRes.data || []).filter((h: any) => h.month === prevMonthISO && h.isEnrolled === true);
      
      // Considera "já matriculado" tanto quem já tem registro no mês sendo fechado quanto quem
      // já tem uma matrícula viva (sem leftAt) em QUALQUER outro mês que nunca foi migrada para
      // cá — sem essa segunda checagem, a rematrícula automática criava uma segunda matrícula
      // ativa duplicada para quem já estava vivo num ciclo anterior.
      const currentStaffIdsInPGs = new Set(
        proGroupMembers
          .filter(m => (m.cycleMonth === selectedCloseMonth) || (!m.leftAt && m.isError !== true))
          .map(m => cleanID(m.staffId))
      );

      const newMembershipsToSync: any[] = [];
      
      prevMonthHistory.forEach(oldRecord => {
          const sid = cleanID(oldRecord.staffId);
          // Só sincroniza se ele NÃO estiver já matriculado neste mês atual
          if (!currentStaffIdsInPGs.has(sid)) {
             // Verificar se ainda é colaborador ativo (assumindo que o proStaff está atualizado)
             const isStillActive = proStaff.some(s => cleanID(s.id) === sid && s.active !== false && s.unit === unit);
             if (isStillActive) {
                newMembershipsToSync.push({
                    id: crypto.randomUUID(),
                    groupId: oldRecord.groupId,
                    staffId: oldRecord.staffId,
                    cycleMonth: selectedCloseMonth,
                    isLeader: false, // Não conseguimos garantir isLeader do histórico
                    joinedAt: Date.now(),
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
                currentStaffIdsInPGs.add(sid);
             }
          }
      });

      let success = true;
      if (newMembershipsToSync.length > 0) {
        success = await saveRecord('proGroupMembers', newMembershipsToSync);
      }

      if (success) {
        setSyncState({ 
            isOpen: true, 
            status: 'success', 
            title: 'Sincronização Concluída', 
            message: newMembershipsToSync.length > 0 
                ? `${newMembershipsToSync.length} colaboradores foram automaticamente rematriculados conforme histórico.` 
                : "Todas as matrículas ativas já estão sincronizadas." 
        });
        await loadFromCloud(true);
      } else {
        setSyncState({ 
            isOpen: true, 
            status: 'error', 
            title: 'Falha na Sincronização', 
            message: "Ocorreu um erro ao tentar sincronizar as matrículas." 
        });
      }
    } catch (err: any) {
        setSyncState({ 
            isOpen: true, 
            status: 'error', 
            title: 'Erro Crítico', 
            message: "Erro ao processar sincronização forçada.",
            error: err.message
        });
    }
  };

  const isMonthClosed = proMonthlyStats?.some(s => s.month === selectedCloseMonth);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right duration-500">
      <SyncModal 
        isOpen={syncState.isOpen} 
        status={syncState.status} 
        title={syncState.title} 
        message={syncState.message} 
        errorDetails={syncState.error} 
        onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} 
      />
      
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
        cltCount={proGroupMembers.filter(m => !m.leftAt).length}
        providerCount={proGroupProviderMembers.filter(m => !m.leftAt).length}
      />

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

            {!isMonthClosed && (
              <button 
                onClick={() => setIsForceSyncModalOpen(true)} 
                className="px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-slate-200"
              >
                <i className="fas fa-sync-alt"></i> Sincronizar Matrículas
              </button>
            )}

            <div className="flex-1"></div>

            <button onClick={() => loadFromCloud(true)} className={`px-6 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-emerald-100`}>
              <i className={`fas fa-sync-alt`}></i> Sincronizar Agora
            </button>
          </div>

      </div>

      {isMonthClosed && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">
                <i className="fas fa-user-edit"></i>
              </div>
              <div>
                <h3 className="text-slate-800 font-black uppercase text-sm tracking-tight">Corrigir Colaborador em Mês Fechado</h3>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                  Ajusta setor/PG de UM colaborador em {formatMonthLabel(selectedCloseMonth)} sem reabrir o mês — os demais registros ficam intactos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-sm">
              <label className="text-[9px] font-black text-slate-400 uppercase px-2">Mês a corrigir:</label>
              <input
                type="month"
                value={selectedCloseMonth.substring(0, 7)}
                onChange={(e) => setSelectedCloseMonth(e.target.value + '-01')}
                className="bg-transparent border-none rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:ring-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase px-2">Colaborador (matriculado no mês)</label>
              <Autocomplete
                options={correctionStaffOptions}
                value={correctionStaffId}
                onChange={setCorrectionStaffId}
                onSelectOption={() => {}}
                placeholder="Buscar colaborador..."
                isStrict
              />
              {selectedCorrectionRecord && (
                <p className="text-[9px] font-bold text-slate-400 px-2">
                  Atual: {selectedCorrectionRecord.sectorName || 'Sem Setor'} {selectedCorrectionRecord.groupName ? `• ${selectedCorrectionRecord.groupName}` : ''}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase px-2">Novo Setor</label>
              <select
                value={correctionNewSectorId}
                onChange={e => setCorrectionNewSectorId(e.target.value)}
                className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium text-sm text-slate-800"
              >
                <option value="">Selecione...</option>
                {proSectors.filter(s => s.unit === unit && s.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase px-2">Novo PG (opcional)</label>
              <select
                value={correctionNewGroupId}
                onChange={e => setCorrectionNewGroupId(e.target.value)}
                className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium text-sm text-slate-800"
              >
                <option value="">Manter PG atual</option>
                {proGroups.filter(g => g.unit === unit && g.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleApplyClosedMonthCorrection}
            disabled={isCorrecting || !correctionStaffId || !correctionNewSectorId}
            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 tracking-widest active:scale-95"
          >
            <i className={`fas ${isCorrecting ? 'fa-circle-notch fa-spin' : 'fa-check'}`}></i>
            Aplicar Correção
          </button>
        </div>
      )}
    </div>
  );
};

export default PGClosing;
