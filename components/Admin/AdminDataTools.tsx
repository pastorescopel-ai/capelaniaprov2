
import React, { useState, useRef, useMemo } from 'react';
import { User, ProStaff, ProSector, ProGroup, ProGroupMember, ProGroupProviderMember, ProProvider, Ambassador, ProMonthlyStats, ProHistoryRecord } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import { cleanID } from '../../utils/formatters';
import { Unit } from '../../types';
import { TABLE_SCHEMAS } from '../../utils/transformers';
import { supabase } from '../../services/supabaseClient';

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
    visitRequests: any[];
    bibleClassAttendees: any[];
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

  const [healthCheckState, setHealthCheckState] = useState<{
    isOpen: boolean;
    isChecking: boolean;
    report: any | null;
  }>({ isOpen: false, isChecking: false, report: null });

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

  const runHealthCheck = async () => {
    setHealthCheckState({ isOpen: true, isChecking: true, report: null });
    const report: any = {
      timestamp: new Date().toISOString(),
      schemaSync: [],
      dataIntegrity: [],
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        totalOk: 0
      }
    };

    try {
      // 1. Schema Sync Check & Timestamp Check
      for (const [table, columns] of Object.entries(TABLE_SCHEMAS)) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          report.schemaSync.push({ table, status: 'error', message: error.message });
          report.summary.totalErrors++;
        } else {
          // Check if created_at and updated_at are mapped
          const hasCreatedAt = columns.includes('created_at');
          const hasUpdatedAt = columns.includes('updated_at');
          if (!hasCreatedAt || !hasUpdatedAt) {
            report.schemaSync.push({ table, status: 'warning', message: `Faltam colunas de data: ${!hasCreatedAt ? 'created_at ' : ''}${!hasUpdatedAt ? 'updated_at' : ''}` });
            report.summary.totalWarnings++;
          } else {
            report.schemaSync.push({ table, status: 'ok', message: 'Tabela acessível e com datas mapeadas.' });
            report.summary.totalOk++;
          }
        }
      }

      // 2. Data Integrity Check (Orphans & Missing IDs)
      
      // Staff sem setor
      const staffWithoutSector = proData.staff.filter(s => s.sectorId && !proData.sectors.find(sec => sec.id === s.sectorId));
      if (staffWithoutSector.length > 0) {
        report.dataIntegrity.push({ type: 'error', message: `${staffWithoutSector.length} colaboradores com Setor ID inexistente.` });
        report.summary.totalErrors++;
      } else {
        report.dataIntegrity.push({ type: 'ok', message: 'Todos os colaboradores possuem setores válidos.' });
        report.summary.totalOk++;
      }

      // PGs sem setor
      const groupsWithoutSector = proData.groups.filter(g => g.sectorId && !proData.sectors.find(sec => sec.id === g.sectorId));
      if (groupsWithoutSector.length > 0) {
        report.dataIntegrity.push({ type: 'error', message: `${groupsWithoutSector.length} PGs com Setor ID inexistente.` });
        report.summary.totalErrors++;
      } else {
        report.dataIntegrity.push({ type: 'ok', message: 'Todos os PGs possuem setores válidos.' });
        report.summary.totalOk++;
      }

      // Membros de PG sem PG ou sem Staff
      const orphanMembers = proGroupMembers.filter(m => !proData.groups.find(g => g.id === m.groupId) || !proData.staff.find(s => s.id === m.staffId));
      if (orphanMembers.length > 0) {
        report.dataIntegrity.push({ type: 'warning', message: `${orphanMembers.length} membros de PG com PG ou Colaborador inexistente.` });
        report.summary.totalWarnings++;
      } else {
        report.dataIntegrity.push({ type: 'ok', message: 'Todos os membros de PG estão vinculados corretamente.' });
        report.summary.totalOk++;
      }

      // Terceirizados sem setor (Ignorado conforme regra de negócio)
      // const providersWithoutSector = (proData.providers || []).filter(p => p.sectorId && !proData.sectors.find(sec => sec.id === p.sectorId));

      // Terceirizados em PGs órfãos
      const orphanProviderMembers = proGroupProviderMembers.filter(m => !proData.groups.find(g => g.id === m.groupId) || !(proData.providers || []).find(p => p.id === m.providerId));
      if (orphanProviderMembers.length > 0) {
        report.dataIntegrity.push({ 
          type: 'warning', 
          message: `${orphanProviderMembers.length} registros de terceirizados em PG com PG ou Provider inexistente.`,
          action: 'delete_orphan_provider_members',
          data: orphanProviderMembers
        });
        report.summary.totalWarnings++;
      }

      // Terceirizados sem PG
      const providersWithoutPG = (proData.providers || []).filter(p => !proGroupProviderMembers.find(m => m.providerId === p.id && !m.leftAt));
      if (providersWithoutPG.length > 0) {
        report.dataIntegrity.push({
          type: 'warning',
          message: `${providersWithoutPG.length} Terceirizados não estão em nenhum PG.`,
          action: 'view_providers_without_pg',
          data: providersWithoutPG
        });
        report.summary.totalWarnings++;
      }

      // Embaixadores sem setor
      const ambassadorsWithoutSector = ambassadors.filter(a => a.sectorId && !proData.sectors.find(sec => sec.id === a.sectorId));
      if (ambassadorsWithoutSector.length > 0) {
        report.dataIntegrity.push({ type: 'error', message: `${ambassadorsWithoutSector.length} embaixadores com Setor ID inexistente.` });
        report.summary.totalErrors++;
      }

      // Solicitações de Visita sem setor
      const visitRequestsWithoutSector = (chaplaincyData.visitRequests || []).filter(v => v.sectorId && !proData.sectors.find(sec => sec.id === v.sectorId));
      if (visitRequestsWithoutSector.length > 0) {
        report.dataIntegrity.push({ type: 'error', message: `${visitRequestsWithoutSector.length} solicitações de visita com Setor ID inexistente.` });
        report.summary.totalErrors++;
      }

      // Histórico de Transferências órfão
      const orphanHistory = (proData.history || []).filter(h => 
        !proData.staff.find(s => s.id === h.staffId) || 
        (h.oldSectorId && !proData.sectors.find(sec => sec.id === h.oldSectorId)) ||
        (h.newSectorId && !proData.sectors.find(sec => sec.id === h.newSectorId))
      );
      if (orphanHistory.length > 0) {
        report.dataIntegrity.push({ type: 'warning', message: `${orphanHistory.length} registros de histórico com Colaborador ou Setor inexistente.` });
        report.summary.totalWarnings++;
      }

      // Participantes de Aulas Bíblicas órfãos
      const orphanBibleClassAttendees = (chaplaincyData.bibleClassAttendees || []).filter(a => 
        !chaplaincyData.bibleClasses.find(c => c.id === a.classId) || 
        (a.staffId && !proData.staff.find(s => s.id === a.staffId))
      );
      if (orphanBibleClassAttendees.length > 0) {
        report.dataIntegrity.push({ type: 'warning', message: `${orphanBibleClassAttendees.length} participantes de aulas com Aula ou Colaborador inexistente.` });
        report.summary.totalWarnings++;
      }

      // PGs (Small Groups) sem sectorId
      const smallGroupsMissingSectorId = chaplaincyData.smallGroups.filter(g => !g.sectorId && g.sector);
      if (smallGroupsMissingSectorId.length > 0) {
        report.dataIntegrity.push({ 
          type: 'warning', 
          message: `${smallGroupsMissingSectorId.length} PGs (Small Groups) sem ID de Setor (mas com nome do setor).`,
          action: 'fix_small_groups_sector_id',
          data: smallGroupsMissingSectorId
        });
        report.summary.totalWarnings++;
      }

      // Aulas Bíblicas sem sectorId (Apenas para Colaboradores)
      const bibleClassesMissingSectorId = chaplaincyData.bibleClasses.filter(c => !c.sectorId && c.sector && (!c.participantType || c.participantType === 'Colaborador'));
      if (bibleClassesMissingSectorId.length > 0) {
        report.dataIntegrity.push({ 
          type: 'warning', 
          message: `${bibleClassesMissingSectorId.length} Aulas Bíblicas sem ID de Setor (mas com nome do setor).`,
          action: 'fix_bible_classes_sector_id',
          data: bibleClassesMissingSectorId
        });
        report.summary.totalWarnings++;
      }

      // Estudos Bíblicos sem sectorId (Apenas para Colaboradores)
      const bibleStudiesMissingSectorId = chaplaincyData.bibleStudies.filter(s => !s.sectorId && s.sector && (!s.participantType || s.participantType === 'Colaborador'));
      if (bibleStudiesMissingSectorId.length > 0) {
        report.dataIntegrity.push({ 
          type: 'warning', 
          message: `${bibleStudiesMissingSectorId.length} Estudos Bíblicos sem ID de Setor (mas com nome do setor).`,
          action: 'fix_bible_studies_sector_id',
          data: bibleStudiesMissingSectorId
        });
        report.summary.totalWarnings++;
      }

      // Visitas sem sectorId (Apenas para Colaboradores)
      const staffVisitsMissingSectorId = chaplaincyData.staffVisits.filter(v => !v.sectorId && v.sector && (!v.participantType || v.participantType === 'Colaborador'));
      if (staffVisitsMissingSectorId.length > 0) {
        report.dataIntegrity.push({ 
          type: 'warning', 
          message: `${staffVisitsMissingSectorId.length} Visitas sem ID de Setor (mas com nome do setor).`,
          action: 'fix_staff_visits_sector_id',
          data: staffVisitsMissingSectorId
        });
        report.summary.totalWarnings++;
      }

      // 3. Type Validation (BIGINT)
      const isNumeric = (val: string) => /^\d+$/.test(val);
      
      const nonNumericStaff = proData.staff.filter(s => !isNumeric(s.id));
      if (nonNumericStaff.length > 0) {
        report.dataIntegrity.push({ type: 'error', message: `${nonNumericStaff.length} colaboradores com ID não-numérico (UUID).` });
        report.summary.totalErrors++;
      }

      const nonNumericSectors = proData.sectors.filter(s => !isNumeric(s.id));
      if (nonNumericSectors.length > 0) {
        report.dataIntegrity.push({ type: 'error', message: `${nonNumericSectors.length} setores com ID não-numérico (UUID).` });
        report.summary.totalErrors++;
      }

      // 4. Duplicate Checks
      const sectorNames = new Set();
      let duplicateSectors = 0;
      proData.sectors.forEach(s => {
        const key = `${s.unit}-${s.name.toLowerCase().trim()}`;
        if (sectorNames.has(key)) duplicateSectors++;
        sectorNames.add(key);
      });
      if (duplicateSectors > 0) {
        report.dataIntegrity.push({ type: 'warning', message: `${duplicateSectors} setores com nomes duplicados na mesma unidade.` });
        report.summary.totalWarnings++;
      }

      const pgNames = new Set();
      let duplicatePGs = 0;
      proData.groups.forEach(g => {
        const key = `${g.unit}-${g.name.toLowerCase().trim()}`;
        if (pgNames.has(key)) duplicatePGs++;
        pgNames.add(key);
      });
      if (duplicatePGs > 0) {
        report.dataIntegrity.push({ type: 'warning', message: `${duplicatePGs} PGs com nomes duplicados na mesma unidade.` });
        report.summary.totalWarnings++;
      }

    } catch (err: any) {
      report.schemaSync.push({ table: 'Geral', status: 'error', message: err.message });
      report.summary.totalErrors++;
    }

    setHealthCheckState({ isOpen: true, isChecking: false, report });
  };

  const [detailsModal, setDetailsModal] = useState<{isOpen: boolean, title: string, data: any[]}>({isOpen: false, title: '', data: []});

  const handleAction = async (action: string, records: any[]) => {
    if (action === 'view_providers_without_pg') {
      setDetailsModal({
        isOpen: true,
        title: 'Terceirizados sem PG',
        data: records
      });
      return;
    }

    if (action === 'delete_orphan_provider_members') {
      if (!window.confirm(`Tem certeza que deseja deletar ${records.length} registros órfãos de terceirizados em PGs?`)) return;
      setIsAuditing(true);
      try {
        let deletedCount = 0;
        for (const record of records) {
          await deleteRecord('proGroupProviderMembers', record.id);
          deletedCount++;
        }
        showToast(`Sucesso! ${deletedCount} registros órfãos deletados.`, "success");
        await onRefreshData();
        runHealthCheck();
      } catch (err) {
        showToast("Erro ao deletar: " + (err as Error).message, "warning");
      } finally {
        setIsAuditing(false);
      }
      return;
    }

    setIsAuditing(true);
    try {
      let collectionName = '';
      if (action === 'fix_small_groups_sector_id') collectionName = 'smallGroups';
      if (action === 'fix_bible_classes_sector_id') collectionName = 'bibleClasses';
      if (action === 'fix_bible_studies_sector_id') collectionName = 'bibleStudies';
      if (action === 'fix_staff_visits_sector_id') collectionName = 'staffVisits';

      let fixedCount = 0;
      for (const record of records) {
        // Find sector by name and unit
        const sectorName = record.sector?.trim().toLowerCase();
        const sector = proData.sectors.find(s => s.name.trim().toLowerCase() === sectorName && s.unit === record.unit);
        
        if (sector) {
          await saveRecord(collectionName, { ...record, sectorId: sector.id });
          fixedCount++;
        }
      }

      showToast(`Sucesso! ${fixedCount} de ${records.length} registros corrigidos.`, "success");
      await onRefreshData();
      runHealthCheck(); // Re-run to update the report
    } catch (err) {
      showToast("Erro ao corrigir: " + (err as Error).message, "warning");
    } finally {
      setIsAuditing(false);
    }
  };

  const downloadReport = () => {
    if (!healthCheckState.report) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(healthCheckState.report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `health_check_${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <>
      <SyncModal isOpen={syncState.isOpen} status={syncState.status} title={syncState.title} message={syncState.message} errorDetails={syncState.error} onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} />
      
      {/* MODAL HEALTH CHECK */}
      {healthCheckState.isOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => !healthCheckState.isChecking && setHealthCheckState(prev => ({ ...prev, isOpen: false }))} />
          <div className="relative bg-white w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[2rem] shadow-2xl animate-in zoom-in duration-300 border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-inner ${healthCheckState.isChecking ? 'bg-blue-100 text-blue-600' : healthCheckState.report?.summary.totalErrors > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  <i className={`fas ${healthCheckState.isChecking ? 'fa-spinner fa-spin' : healthCheckState.report?.summary.totalErrors > 0 ? 'fa-exclamation-triangle' : 'fa-check-circle'}`}></i>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Diagnóstico do Sistema</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {healthCheckState.isChecking ? 'Analisando integridade...' : 'Relatório de Saúde'}
                  </p>
                </div>
              </div>
              {!healthCheckState.isChecking && (
                <button onClick={() => setHealthCheckState(prev => ({ ...prev, isOpen: false }))} className="w-10 h-10 bg-white border border-slate-200 text-slate-400 rounded-full hover:bg-slate-50 hover:text-slate-600 transition-colors flex items-center justify-center">
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {healthCheckState.isChecking ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-slate-600 uppercase tracking-widest animate-pulse">Verificando tabelas e relações...</p>
                </div>
              ) : healthCheckState.report ? (
                <div className="space-y-8">
                  {/* Resumo */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                      <div className="text-2xl font-black text-emerald-600">{healthCheckState.report.summary.totalOk}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Testes OK</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                      <div className="text-2xl font-black text-amber-500">{healthCheckState.report.summary.totalWarnings}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Avisos</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                      <div className="text-2xl font-black text-rose-600">{healthCheckState.report.summary.totalErrors}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Erros Críticos</div>
                    </div>
                  </div>

                  {/* Detalhes */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i className="fas fa-database text-blue-500"></i> Sincronia de Schema (Supabase)
                      </h4>
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        {healthCheckState.report.schemaSync.map((item: any, idx: number) => (
                          <div key={idx} className={`p-3 border-b border-slate-100 last:border-0 flex items-start gap-3 ${item.status === 'error' ? 'bg-rose-50/50' : ''}`}>
                            <i className={`fas mt-0.5 ${item.status === 'error' ? 'fa-times-circle text-rose-500' : 'fa-check-circle text-emerald-500'}`}></i>
                            <div>
                              <div className="text-[10px] font-black text-slate-700 uppercase">{item.table}</div>
                              <div className={`text-[10px] ${item.status === 'error' ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>{item.message}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i className="fas fa-link text-purple-500"></i> Integridade de Dados (Relações)
                      </h4>
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        {healthCheckState.report.dataIntegrity.map((item: any, idx: number) => (
                          <div key={idx} className={`p-3 border-b border-slate-100 last:border-0 flex items-center justify-between gap-3 ${item.type === 'error' ? 'bg-rose-50/50' : item.type === 'warning' ? 'bg-amber-50/50' : ''}`}>
                            <div className="flex items-start gap-3">
                              <i className={`fas mt-0.5 ${item.type === 'error' ? 'fa-times-circle text-rose-500' : item.type === 'warning' ? 'fa-exclamation-triangle text-amber-500' : 'fa-check-circle text-emerald-500'}`}></i>
                              <div className={`text-[10px] font-bold ${item.type === 'error' ? 'text-rose-600' : item.type === 'warning' ? 'text-amber-600' : 'text-slate-600'}`}>
                                {item.message}
                              </div>
                            </div>
                            {item.action && (
                              <button 
                                onClick={() => handleAction(item.action, item.data)}
                                disabled={isAuditing}
                                className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase shadow-sm transition-all disabled:opacity-50 whitespace-nowrap ${
                                  item.type === 'error' 
                                    ? 'bg-rose-600 text-white hover:bg-rose-700' 
                                    : item.type === 'warning'
                                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              >
                                {isAuditing ? '...' : item.action.includes('view') ? 'Ver Detalhes' : item.action.includes('delete') ? 'Deletar' : 'Corrigir Auto'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {!healthCheckState.isChecking && healthCheckState.report && (
              <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button onClick={() => setHealthCheckState(prev => ({ ...prev, isOpen: false }))} className="px-6 py-3 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">
                  Fechar
                </button>
                <button onClick={downloadReport} className="px-6 py-3 bg-blue-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <i className="fas fa-download"></i> Baixar Relatório JSON
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
      <div className="grid md:grid-cols-3 gap-8">
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

        {/* DIAGNÓSTICO DO SISTEMA */}
        <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-6 shadow-sm hover:border-emerald-300 transition-all group w-full">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
              <i className="fas fa-stethoscope"></i>
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-slate-800 font-black uppercase text-sm tracking-tight">Diagnóstico do Sistema</h3>
              <p className="text-slate-500 font-medium text-[10px] leading-relaxed">
                  Verifica a sincronia entre o Frontend e o Supabase, e checa a integridade dos dados.
              </p>
            </div>
            <div className="relative w-full mt-auto">
              <button 
                  onClick={runHealthCheck}
                  disabled={healthCheckState.isChecking}
                  className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl uppercase text-[9px] tracking-widest shadow-sm hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                  <i className={`fas ${healthCheckState.isChecking ? 'fa-spinner fa-spin' : 'fa-heartbeat'}`}></i> 
                  {healthCheckState.isChecking ? 'Analisando...' : 'Iniciar Diagnóstico'}
              </button>
            </div>
        </div>
      </div>
      {/* DETAILS MODAL */}
      {detailsModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDetailsModal({isOpen: false, title: '', data: []})}></div>
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400">
                  <i className="fas fa-list"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{detailsModal.title}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{detailsModal.data.length} registros encontrados</p>
                </div>
              </div>
              <button 
                onClick={() => setDetailsModal({isOpen: false, title: '', data: []})}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shadow-sm border border-slate-100"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-50/30">
              <div className="space-y-3">
                {detailsModal.data.map((item, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <span className="block text-xs font-black text-slate-800 uppercase tracking-widest">{item.name || item.staffName || 'Sem Nome'}</span>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mt-1">Unidade: {item.unit} {item.whatsapp ? `• WhatsApp: ${item.whatsapp}` : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end">
              <button 
                onClick={() => setDetailsModal({isOpen: false, title: '', data: []})}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminDataTools;
