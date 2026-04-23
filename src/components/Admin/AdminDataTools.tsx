
import React, { useState, useRef, useMemo } from 'react';
import { User, ProStaff, ProSector, ProGroup, ProGroupMember, ProGroupProviderMember, ProProvider, Ambassador, ProMonthlyStats, ProHistoryRecord } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import { cleanID, getTimestamp, normalizeString } from '../../utils/formatters';
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
  const [isRobustAuditing, setIsRobustAuditing] = useState(false);
  const [robustReport, setRobustReport] = useState<any>(null);

  const [healthCheckState, setHealthCheckState] = useState<{
    isOpen: boolean;
    isChecking: boolean;
    report: any | null;
  }>({ isOpen: false, isChecking: false, report: null });

  const runRobustDiagnostics = async () => {
    setIsRobustAuditing(true);
    try {
      const response = await fetch('/api/diagnostics');
      const data = await response.json();
      setRobustReport(data);
    } catch (err) {
      showToast("Erro ao rodar diagnóstico: " + (err as Error).message, "warning");
    } finally {
      setIsRobustAuditing(false);
    }
  };

  const deleteFile = async (filePath: string) => {
    if (!window.confirm(`Tem certeza que deseja deletar o arquivo: ${filePath}?`)) return;
    try {
      const response = await fetch('/api/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (response.ok) {
        showToast("Arquivo deletado com sucesso!", "success");
        runRobustDiagnostics(); // Re-run diagnostics
      } else {
        showToast("Erro ao deletar arquivo.", "error");
      }
    } catch (err) {
      showToast("Erro ao deletar arquivo: " + (err as Error).message, "warning");
    }
  };

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
            report.schemaSync.push({ table, status: 'warning', message: `Faltam colunas de auditoria: ${!hasCreatedAt ? 'created_at ' : ''}${!hasUpdatedAt ? 'updated_at' : ''}` });
            report.summary.totalWarnings++;
          } else {
            report.schemaSync.push({ table, status: 'ok', message: 'Tabela acessível e com datas mapeadas.' });
            report.summary.totalOk++;
          }

          // Check for joined_at/left_at in relevant tables
          const hasJoinedAt = columns.includes('joined_at');
          const hasLeftAt = columns.includes('left_at');
          if (hasJoinedAt || hasLeftAt) {
            report.schemaSync.push({ 
              table, 
              status: 'info', 
              message: `Contém colunas de vínculo: ${hasJoinedAt ? 'joined_at ' : ''}${hasLeftAt ? 'left_at' : ''}` 
            });
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

      // Terceirizados em PGs órfãos (Apenas se ainda estiverem ativos no grupo)
      const orphanProviderMembers = proGroupProviderMembers.filter(m => 
        !m.leftAt && (!proData.groups.find(g => g.id === m.groupId) || !(proData.providers || []).find(p => p.id === m.providerId))
      );
      if (orphanProviderMembers.length > 0) {
        report.dataIntegrity.push({ 
          type: 'warning', 
          message: `${orphanProviderMembers.length} registros de terceirizados ativos em PG com PG ou Provider inexistente.`,
          action: 'delete_orphan_provider_members',
          data: orphanProviderMembers
        });
        report.summary.totalWarnings++;
      }

      // Terceirizados sem PG (Removido por regra de negócio: prestadores podem receber atendimento sem PG fixo)
      /*
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
      */

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

      // Visitas sem sectorId (Removido por regra de negócio: podem ser lançamentos externos ou incorretos que não exigem vínculo)
      /*
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
      */

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

      // 5. Future Cycle Check (Detection of potential data visibility issues)
      const currentMonthStr = new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
      const futureCycleMembers = proGroupMembers.filter(m => m.cycleMonth && m.cycleMonth > currentMonthStr);
      if (futureCycleMembers.length > 0) {
        report.dataIntegrity.push({ 
          type: 'info', 
          message: `${futureCycleMembers.length} matrículas possuem ciclo futuro (ex: sincronizados para o próximo mês).`,
          details: 'Isso pode fazer com que membros sumam de meses passados se a lógica de filtragem for estrita.'
        });
      }

      // 6. Migration Date Check (Detection of reset createdAt)
      const migrationDate = new Date('2026-04-04').getTime();
      const resetStaff = proData.staff.filter(s => getTimestamp(s.createdAt) >= migrationDate);
      const restoredStaff = proData.staff.filter(s => getTimestamp(s.createdAt) < migrationDate && getTimestamp(s.createdAt) >= new Date('2026-01-01').getTime());

      if (resetStaff.length > 0) {
        report.dataIntegrity.push({
          type: 'warning',
          message: `${resetStaff.length} colaboradores ainda possuem data de criação de hoje (04/04/2026).`,
          details: 'Estes registros podem não ter sido afetados pelo seu comando SQL ou não possuem cycle_month.'
        });
        report.summary.totalWarnings++;
      }

      if (restoredStaff.length > 0) {
        report.dataIntegrity.push({
          type: 'ok',
          message: `${restoredStaff.length} colaboradores foram restaurados com sucesso para datas passadas.`,
          details: `Amostra de data restaurada: ${new Date(getTimestamp(restoredStaff[0].createdAt)).toLocaleDateString()}`
        });
        report.summary.totalOk++;
      }

      // 7. Legacy Backup Consistency Check
      const legacyCheckTables = [
        { name: 'bible_classes', label: 'Aulas Bíblicas' },
        { name: 'daily_activity_reports', label: 'Relatórios Diários' }
      ];

      for (const table of legacyCheckTables) {
        const { data } = await supabase
          .from(table.name)
          .select('created_at, created_at_legacy_backup')
          .not('created_at_legacy_backup', 'is', null)
          .limit(5);

        if (data && data.length > 0) {
          const isRestored = data.every(row => {
            const current = new Date(row.created_at).getTime();
            const legacy = Number(row.created_at_legacy_backup);
            return Math.abs(current - legacy) < 2000; // Tolerância de 2 segundos
          });

          if (isRestored) {
            report.dataIntegrity.push({
              type: 'ok',
              message: `Restauração de backup confirmada para ${table.label}.`,
              details: 'As datas de criação agora batem com os registros originais.'
            });
            report.summary.totalOk++;
          }
        }
      }

      // 7. Legacy Backup Analysis (Deep Dive)
      const tablesWithLegacy = [
        { name: 'bible_classes', cols: ['created_at_legacy_backup', 'updated_at_legacy_backup'] },
        { name: 'daily_activity_reports', cols: ['created_at_legacy_backup', 'updated_at_legacy_backup'] },
        { name: 'pro_history_records', cols: ['created_at_legacy_backup', 'joined_at_legacy_backup', 'left_at_legacy_backup'] },
        { name: 'staff_visits', cols: ['created_at_legacy_backup', 'updated_at_legacy_backup', 'return_date_legacy_backup'] },
        { name: 'pro_staff', cols: ['created_at_legacy_backup', 'updated_at_legacy_backup'] },
        { name: 'pro_group_members', cols: ['created_at_legacy_backup', 'updated_at_legacy_backup', 'joined_at_legacy_backup', 'left_at_legacy_backup'] }
      ];

      console.log("[DEBUG] Iniciando Auditoria de Dados Legados...");

      for (const tableInfo of tablesWithLegacy) {
        try {
          // Consultar apenas colunas existentes de forma simples
          const { data, error } = await supabase
            .from(tableInfo.name)
            .select(tableInfo.cols.join(','))
            .limit(1);

          if (error) {
            console.warn(`[DEBUG] Erro ao auditar ${tableInfo.name}:`, error.message);
            continue;
          }

          if (data && data.length > 0) {
            const sample = data[0];
            // Verifica se pelo menos uma das colunas de backup tem valor
            const hasData = tableInfo.cols.some(col => sample[col] !== null);
            
            if (hasData) {
              const readableDates = Object.entries(sample).map(([col, val]) => {
                if (!val) return `${col}: null`;
                
                let date: Date;
                if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
                  date = new Date(Number(val));
                } else {
                  date = new Date(String(val));
                }

                const dateStr = isNaN(date.getTime()) ? 'Data Inválida' : date.toISOString();
                return `${col}: ${dateStr} (${val})`;
              });
              
              console.log(`[DEBUG] Legacy Audit - ${tableInfo.name}:`, readableDates);
              report.dataIntegrity.push({
                type: 'info',
                message: `Dados de backup encontrados em ${tableInfo.name}.`,
                details: `Amostra: ${readableDates.join(' | ')}`
              });
            }
          }
        } catch (e) {
          console.error(`[DEBUG] Falha crítica ao auditar ${tableInfo.name}:`, e);
        }
      }

      // 8. Deep Audit Diagnosis (Logical Integrity)
      console.log("[DEBUG] Iniciando Diagnóstico de Auditoria Profunda...");

      // 8.1. Overlapping Enrollments (Sobreposição de Matrículas)
      const activeMemberships = proGroupMembers.filter(m => !m.leftAt);
      const staffMembershipMap = new Map<string, string[]>();
      activeMemberships.forEach(m => {
        const sid = cleanID(m.staffId);
        if (!staffMembershipMap.has(sid)) staffMembershipMap.set(sid, []);
        staffMembershipMap.get(sid)?.push(m.groupId);
      });

      const overlappingEnrollments: any[] = [];
      staffMembershipMap.forEach((groups, sid) => {
        if (groups.length > 1) {
          const staff = proData.staff.find(s => cleanID(s.id) === sid);
          overlappingEnrollments.push({
            staffId: sid,
            staffName: staff?.name || 'Desconhecido',
            groups: groups.map(gid => proData.groups.find(g => g.id === gid)?.name || gid)
          });
        }
      });

      if (overlappingEnrollments.length > 0) {
        report.dataIntegrity.push({
          type: 'error',
          message: `${overlappingEnrollments.length} Colaboradores com matrículas ATIVAS em múltiplos PGs.`,
          details: 'Isso duplica as métricas no Dashboard.',
          action: 'view_overlapping_enrollments',
          data: overlappingEnrollments
        });
        report.summary.totalErrors++;
      }

      // 8.2. Date Integrity (joinedAt vs leftAt)
      const invalidDateRecords: any[] = [];
      const checkDateIntegrity = (list: any[], tableName: string) => {
        list.forEach(item => {
          if (item.joinedAt && item.leftAt && Number(item.joinedAt) > Number(item.leftAt)) {
            invalidDateRecords.push({ ...item, tableName });
          }
        });
      };

      checkDateIntegrity(proGroupMembers, 'Matrículas de Colaboradores');
      checkDateIntegrity(proGroupProviderMembers, 'Matrículas de Terceirizados');

      if (invalidDateRecords.length > 0) {
        report.dataIntegrity.push({
          type: 'error',
          message: `${invalidDateRecords.length} Registros com data de entrada POSTERIOR à data de saída.`,
          details: 'Isso causa erros de filtragem temporal e lógica.',
          action: 'view_invalid_dates',
          data: invalidDateRecords
        });
        report.summary.totalErrors++;
      }

      // 8.3. Virtual Foreign Key Integrity (Orphaned Relations)
      const orphanedStaffSectors = proData.staff.filter(s => s.sectorId && !proData.sectors.find(sec => sec.id === s.sectorId));
      if (orphanedStaffSectors.length > 0) {
        report.dataIntegrity.push({
          type: 'warning',
          message: `${orphanedStaffSectors.length} Colaboradores vinculados a Setores que não existem.`,
          details: 'O setor original pode ter sido deletado.',
          action: 'view_orphaned_staff_sectors',
          data: orphanedStaffSectors
        });
        report.summary.totalWarnings++;
      }

      const orphanedMemberships = proGroupMembers.filter(m => !proData.groups.find(g => g.id === m.groupId) || !proData.staff.find(s => cleanID(s.id) === cleanID(m.staffId)));
      if (orphanedMemberships.length > 0) {
        report.dataIntegrity.push({
          type: 'warning',
          message: `${orphanedMemberships.length} Matrículas órfãs (PG ou Colaborador inexistente).`,
          action: 'view_orphaned_memberships',
          data: orphanedMemberships
        });
        report.summary.totalWarnings++;
      }

      // 8.4. Snapshot Integrity (Drift Detection)
      const statsWithDrift: any[] = [];
      (proData.stats || []).forEach(stat => {
        try {
          const snapshot = JSON.parse(stat.snapshotData || '{}');
          const members = snapshot.membersList || [];
          const missingInStaff = members.filter((m: any) => !proData.staff.find(s => cleanID(s.id) === cleanID(m.id)));
          
          if (missingInStaff.length > 0) {
            statsWithDrift.push({
              month: stat.month,
              unit: stat.unit,
              missingCount: missingInStaff.length,
              sampleMissing: missingInStaff.slice(0, 3).map((m: any) => m.name || m.staffName)
            });
          }
        } catch (e) {
          // JSON inválido ou formato antigo
        }
      });

      if (statsWithDrift.length > 0) {
        report.dataIntegrity.push({
          type: 'warning',
          message: `${statsWithDrift.length} meses fechados com "Drift" de dados (membros deletados).`,
          details: 'Pessoas que estavam no fechamento não existem mais no cadastro geral. Isso pode afetar a rastreabilidade.',
          action: 'view_snapshot_drift',
          data: statsWithDrift
        });
        report.summary.totalWarnings++;
      }

      // 8.5. Duplicate Names Check (Sectors and Groups) - Scoped by Unit
      const checkDuplicateNames = (list: any[], label: string) => {
        const nameMap = new Map<string, any[]>();
        list.forEach(item => {
          const norm = normalizeString(item.name || '');
          const unit = item.unit || 'unknown';
          const key = `${unit}_${norm}`; // Chave única por unidade e nome
          if (!nameMap.has(key)) nameMap.set(key, []);
          nameMap.get(key)?.push(item);
        });

        const duplicates: any[] = [];
        nameMap.forEach((items, key) => {
          if (items.length > 1) {
            const [unit, name] = key.split('_');
            duplicates.push({ name, unit, count: items.length, ids: items.map(i => i.id) });
          }
        });

        if (duplicates.length > 0) {
          report.dataIntegrity.push({
            type: 'warning',
            message: `Nomes duplicados encontrados em ${label}: ${duplicates.length} ocorrências.`,
            details: 'Nomes idênticos podem causar confusão no lançamento de dados.',
            action: `view_duplicate_${label.toLowerCase()}`,
            data: duplicates
          });
          report.summary.totalWarnings++;
        }
      };

      checkDuplicateNames(proData.sectors, 'Setores');
      checkDuplicateNames(proData.groups, 'Grupos');

    } catch (err: any) {
      report.schemaSync.push({ table: 'Geral', status: 'error', message: err.message });
      report.summary.totalErrors++;
    }

    setHealthCheckState({ isOpen: true, isChecking: false, report });
  };

  const [detailsModal, setDetailsModal] = useState<{isOpen: boolean, title: string, data: any[]}>({isOpen: false, title: '', data: []});

  const handleAction = async (action: string, records: any[]) => {
    if (action === 'view_providers_without_pg' || 
        action === 'view_overlapping_enrollments' || 
        action === 'view_invalid_dates' || 
        action === 'view_orphaned_staff_sectors' || 
        action === 'view_orphaned_memberships' ||
        action === 'view_snapshot_drift' ||
        action === 'view_duplicate_setores' ||
        action === 'view_duplicate_grupos') {
      const titles: Record<string, string> = {
        'view_providers_without_pg': 'Terceirizados sem PG',
        'view_overlapping_enrollments': 'Sobreposição de Matrículas',
        'view_invalid_dates': 'Datas de Entrada/Saída Inválidas',
        'view_orphaned_staff_sectors': 'Colaboradores com Setores Órfãos',
        'view_orphaned_memberships': 'Matrículas Órfãs',
        'view_snapshot_drift': 'Divergência em Meses Fechados',
        'view_duplicate_setores': 'Setores com Nomes Duplicados',
        'view_duplicate_grupos': 'Grupos com Nomes Duplicados'
      };
      setDetailsModal({
        isOpen: true,
        title: titles[action] || 'Detalhes',
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

        {/* DIAGNÓSTICO ROBUSTO */}
        <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-6 shadow-sm hover:border-indigo-300 transition-all group w-full">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
              <i className="fas fa-microscope"></i>
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-slate-800 font-black uppercase text-sm tracking-tight">Diagnóstico Robusto</h3>
              <p className="text-slate-500 font-medium text-[10px] leading-relaxed">
                  Análise profunda de conexões, arquivos órfãos e integridade de banco.
              </p>
            </div>
            <div className="relative w-full mt-auto">
              <button 
                  onClick={runRobustDiagnostics}
                  disabled={isRobustAuditing}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl uppercase text-[9px] tracking-widest shadow-sm hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                  <i className={`fas ${isRobustAuditing ? 'fa-spinner fa-spin' : 'fa-microscope'}`}></i> 
                  {isRobustAuditing ? 'Analisando...' : 'Iniciar Diagnóstico Robusto'}
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

      {/* MODAL DIAGNÓSTICO ROBUSTO */}
      {robustReport && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setRobustReport(null)} />
          <div className="relative bg-white w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[2rem] shadow-2xl animate-in zoom-in duration-300 border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Relatório de Diagnóstico Robusto</h3>
              <button onClick={() => setRobustReport(null)} className="w-10 h-10 bg-white border border-slate-200 text-slate-400 rounded-full hover:bg-slate-50 hover:text-slate-600 transition-colors flex items-center justify-center">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="bg-slate-100 p-4 rounded-xl">
                  <p className="text-xs font-bold text-slate-600 uppercase">Status da Conexão Supabase: <span className={robustReport.connectionStatus.supabase ? 'text-emerald-600' : 'text-rose-600'}>{robustReport.connectionStatus.supabase ? 'OK' : 'FALHA'}</span></p>
                </div>
                <div className="bg-slate-100 p-4 rounded-xl">
                  <p className="text-xs font-bold text-slate-600 uppercase">Arquivos órfãos potenciais ({robustReport.fileAnalysis.unusedFiles.length}):</p>
                  <ul className="text-[10px] font-mono text-slate-500 mt-2 max-h-60 overflow-y-auto">
                    {robustReport.fileAnalysis.unusedFiles.map((f: { path: string; lastModified: string }, i: number) => (
                      <li key={i} className="flex items-center justify-between py-1 border-b border-slate-200 last:border-none">
                        <span>{f.path} <span className="text-[9px] text-slate-400">({new Date(f.lastModified).toLocaleDateString()})</span></span>
                        <button onClick={() => deleteFile(f.path)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">Deletar</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminDataTools;
