
import React, { useRef, useState, useMemo } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { ProStaff, ProSector, ProGroup, Unit, ProGroupMember, ProGroupProviderMember, ProMonthlyStats, ProHistoryRecord } from '../../types';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import Autocomplete from '../Shared/Autocomplete';
import { cleanID, normalizeString } from '../../utils/formatters';
import { useExcelProcessor, ProcessedRow, SkippedRow } from '../../hooks/useExcelProcessor';
import { useApp } from '../../hooks/useApp';

interface AdminListsProps {
  proData?: { 
    staff: ProStaff[]; 
    sectors: ProSector[]; 
    groups: ProGroup[];
    memberships?: ProGroupMember[];
    providerMemberships?: ProGroupProviderMember[];
    stats?: ProMonthlyStats[];
    history?: ProHistoryRecord[];
  };
  onSavePro?: (staff: ProStaff[], sectors: ProSector[], groups: ProGroup[], options?: { deleteFutureCycleMonth?: string; unit?: Unit }) => Promise<boolean>;
  activeUnit: Unit;
  setActiveUnit: (unit: Unit) => void;
}

const AdminLists: React.FC<AdminListsProps> = ({ proData, onSavePro, activeUnit, setActiveUnit }) => {
  const { config, saveRecord, proGroupMembers, proGroupProviderMembers, ambassadors, proMonthlyStats } = useApp();
  const { showToast } = useToast();
  const { processExcelFile, isProcessing: isReadingFile } = useExcelProcessor();

  const formatMonthLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(month) - 1]}/${year}`;
  };
  
  const [activeTab, setActiveTab] = useState<'staff' | 'sectors' | 'pgs'>('staff');
  const [importMode, setImportMode] = useState<'sync' | 'incremental'>('incremental');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return config.activeCompetenceMonth || new Date().toISOString().split('T')[0];
  });
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ isOpen: false, status: 'idle', title: '', message: '' });
  
  // Modal de Setores (Novo)
  const [sectorModal, setSectorModal] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; sector?: ProSector }>({ isOpen: false, mode: 'add' });
  const [sectorName, setSectorName] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [sectorUnit, setSectorUnit] = useState<Unit>(activeUnit);

  const [previewData, setPreviewData] = useState<ProcessedRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20; 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sectorOptions = useMemo(() => {
      if (!proData) return [];
      return proData.sectors.filter(s => s.unit === activeUnit).map(s => ({ value: s.name, label: `${s.id} - ${s.name}`, subLabel: s.name, category: 'RH' as const }));
  }, [proData, activeUnit]);

  const handleProcessFile = async (file: File) => {
      // Avisos de Mês (Sem bloqueio conforme solicitação do usuário)
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const selectedMonthStart = new Date(selectedMonth + 'T12:00:00').getTime();

      if (selectedMonthStart > currentMonthStart) {
          showToast("AVISO: Você está importando dados para um mês futuro.", "info");
      }

      // Verificar se o mês já está fechado
      const isClosed = proMonthlyStats?.some(s => s.month === selectedMonth);
      if (isClosed) {
          showToast(`AVISO: O mês de ${formatMonthLabel(selectedMonth)} já possui fechamento oficial. A importação atualizará o banco ativo, mas não o histórico já gravado.`, "warning");
      }

      try {
          const { rows, skippedRows: newSkippedRows } = await processExcelFile(file, activeTab, activeUnit, proData);
          setPreviewData(rows);
          setSkippedRows(newSkippedRows);
          setCurrentPage(1);
          
          if (newSkippedRows.length > 0) {
              showToast(`${rows.length} registros lidos. ${newSkippedRows.length} problemas detectados (veja o log abaixo).`, "warning");
          } else {
              showToast(`${rows.length} registros lidos com sucesso.`, "success");
          }
      } catch (e: any) {
          showToast(e.message, "warning");
      } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const handleConfirmImport = async () => {
    if (!proData || !onSavePro) return;
    setSyncState({ isOpen: true, status: 'processing', title: 'Sincronizando', message: 'Calculando diferenças e salvando...' });
    
    try {
        const stats = { updated: 0, deactivated: 0, new: 0, rematriculated: 0 };
        const mergeData = (currentDB: any[], incomingList: ProcessedRow[], type: 'staff'|'sector'|'pg') => {
            const map = new Map<string, any>();
            const duplicatesToDeactivate: any[] = [];

            // Usar chave composta unit|id para evitar colisões entre unidades
            currentDB.forEach(item => { 
                // Usamos o cleanID atualizado (que remove zeros) para a chave de busca
                const cleanedId = cleanID(item.id);
                const key = `${item.unit}|${cleanedId}`; 
                
                if (map.has(key) && item.unit === activeUnit) {
                    const existing = map.get(key);
                    // Regra de Ouro: Mantemos o que estiver ATIVO ou o registro original se ambos forem iguais
                    if (!existing.active && item.active) {
                        duplicatesToDeactivate.push({ ...existing, active: false, leftAt: Date.now(), updatedAt: Date.now() });
                        map.set(key, item);
                    } else {
                        // Se o que já está no mapa for melhor, descartamos este como duplicata inativa
                        duplicatesToDeactivate.push({ ...item, active: false, leftAt: Date.now(), updatedAt: Date.now() });
                    }
                } else {
                    map.set(key, item); 
                }
            });

            incomingList.forEach(incoming => {
                const cleanedIncomingId = cleanID(incoming.id);
                const key = `${activeUnit}|${cleanedIncomingId}`; 
                const existing = map.get(key);
                const importTimestamp = new Date(selectedMonth + 'T12:00:00').getTime();

                if (existing) {
                    const updated = { 
                        ...existing,
                        // Vital: Preservamos o ID do banco se ele já for limpo, 
                        // mas se o do Excel for mais completo, poderíamos atualizar. 
                        // Aqui mantemos o 'existing.id' para não quebrar referências de outras tabelas.
                        name: incoming.name, 
                        active: true, 
                        cycleMonth: selectedMonth,
                        updatedAt: Date.now(),
                        leftAt: null
                    };
                    // Se não tem createdAt ou se o existente é no futuro (erro de lançamento), setamos para o mês atual
                    if (!updated.createdAt || updated.createdAt > importTimestamp) {
                        updated.createdAt = importTimestamp;
                    }
                    
                    if (type === 'staff') updated.sectorId = incoming.sectorIdLinked || existing.sectorId || "";
                    map.set(key, updated);
                    stats.updated++;
                } else {
                    const newItem: any = { 
                        id: incoming.id, 
                        name: incoming.name, 
                        unit: activeUnit, 
                        active: true, 
                        cycleMonth: selectedMonth,
                        createdAt: importTimestamp, // Importante: Setar para o mês de referência
                        updatedAt: Date.now() 
                    };
                    if (type === 'staff') newItem.sectorId = incoming.sectorIdLinked || "";
                    map.set(key, newItem);
                    stats.new++;
                }
            });

            const incomingKeys = new Set(incomingList.map(i => `${activeUnit}|${i.id}`));
            const resultList: any[] = [];
            const importMonthStart = new Date(selectedMonth + 'T12:00:00').getTime();
            const previousMonthEnd = new Date(importMonthStart - 86400000).getTime();
            const monthEnd = new Date(new Date(selectedMonth + 'T00:00:00').getFullYear(), new Date(selectedMonth + 'T00:00:00').getMonth() + 1, 0, 23, 59, 59).getTime();

            map.forEach((value, key) => {
                // Apenas processamos registros da unidade ativa para sincronização
                if (value.unit === activeUnit) {
                    if (!incomingKeys.has(key)) {
                        // No modo 'sync', desativamos quem não está na planilha
                        if (importMode === 'sync' && value.active !== false) { 
                            value.active = false; 
                            value.leftAt = previousMonthEnd;
                            value.updatedAt = Date.now(); 
                            stats.deactivated++; 

                            // Apenas marcamos como inativo no RH, mas NÃO encerramos as matrículas em PGs automaticamente
                            // Isso preserva o histórico solicitado pelo usuário e evita perdas por planilhas incompletas.
                        }
                    }
                }
                resultList.push(value);
            });
            return [...resultList, ...duplicatesToDeactivate];
        };

        const saveOptions = importMode === 'sync' ? { deleteFutureCycleMonth: selectedMonth, unit: activeUnit } : undefined;

        if (activeTab === 'staff') {
            const finalStaff = mergeData(proData.staff, previewData, 'staff');
            const success = await onSavePro(finalStaff, proData.sectors, proData.groups, saveOptions);
            
            if (success) {
                // AUTO-REMATRICULAÇÃO: Trazer matrículas do mês anterior ou do último disponível
                const now = new Date(selectedMonth + 'T12:00:00');
                const currentActiveStaffIds = new Set(finalStaff.filter(s => s.active !== false && s.unit === activeUnit).map(s => cleanID(s.id)));
                
                // MANTEMOS as matrículas já existentes para este mês
                const existingTargetMemberships = new Set((proGroupMembers || []).filter(m => m.cycleMonth === selectedMonth).map(m => `${cleanID(m.staffId)}|${cleanID(m.groupId)}`));
                const newMemberships: ProGroupMember[] = [];

                // 1. Prioridade: Se a planilha ATUAL já tem informação de PG, usa ela (Recuperação Direta)
                const spreadsheetMemberships = previewData.filter(p => (p as any).pgNameRaw);
                if (spreadsheetMemberships.length > 0) {
                    setSyncState(prev => ({ ...prev, message: `Staff atualizado. Processando matrículas detectadas na planilha...` }));
                    
                    spreadsheetMemberships.forEach(p => {
                        const sid = cleanID(p.id);
                        const pgName = (p as any).pgNameRaw;
                        const isLeader = (p as any).isLeaderRaw;
                        
                        const matchedPG = proData.groups.find(g => g.unit === activeUnit && normalizeString(g.name) === normalizeString(pgName));
                        
                        if (matchedPG) {
                            const key = `${sid}|${cleanID(matchedPG.id)}`;
                            // SÓ adicionamos se NÃO existir no banco
                            if (!existingTargetMemberships.has(key)) {
                                newMemberships.push({
                                    id: crypto.randomUUID(),
                                    groupId: matchedPG.id,
                                    staffId: sid,
                                    cycleMonth: selectedMonth,
                                    isLeader: !!isLeader,
                                    joinedAt: Date.now(),
                                    createdAt: Date.now(),
                                    updatedAt: Date.now()
                                });
                                existingTargetMemberships.add(key);
                            }
                        }
                    });
                }

                // 2. Fallback: Propagar matrículas ativas do mês imediatamente anterior para garantir continuidade
                const prevMonthDate = new Date(now);
                prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
                const prevMonthISO = prevMonthDate.toISOString().split('T')[0];

                const existingPrevMonthMemberships = (proGroupMembers || []).filter(m => m.cycleMonth === prevMonthISO && !m.leftAt);
                
                setSyncState(prev => ({ ...prev, message: `Staff atualizado. Preservando matrículas ativas...` }));
                
                existingPrevMonthMemberships.forEach(oldM => {
                    const sid = cleanID(oldM.staffId);
                    if (currentActiveStaffIds.has(sid)) {
                        const key = `${sid}|${cleanID(oldM.groupId)}`;
                        // SÓ migramos se o colaborador já não tiver uma matrícula vinculada no mês novo
                        const alreadyHasNewMembership = (proGroupMembers || []).some(m => m.cycleMonth === selectedMonth && cleanID(m.staffId) === sid);
                        
                        if (!alreadyHasNewMembership && !existingTargetMemberships.has(key)) {
                            newMemberships.push({
                                id: crypto.randomUUID(),
                                groupId: oldM.groupId,
                                staffId: oldM.staffId,
                                cycleMonth: selectedMonth,
                                isLeader: oldM.isLeader,
                                joinedAt: Date.now(),
                                createdAt: Date.now(),
                                updatedAt: Date.now()
                            });
                            existingTargetMemberships.add(key);
                        }
                    }
                });

                if (newMemberships.length > 0) {
                    const res = await saveRecord('proGroupMembers', newMemberships);
                    if (res) stats.rematriculated = newMemberships.length;
                }
            }
        } else if (activeTab === 'sectors') {
            const finalSectors = mergeData(proData.sectors, previewData, 'sector');
            await onSavePro(proData.staff, finalSectors, proData.groups, saveOptions);
        } else if (activeTab === 'pgs') {
            const finalGroups = mergeData(proData.groups, previewData, 'pg');
            await onSavePro(proData.staff, proData.sectors, finalGroups, saveOptions);
        }

        setSyncState({ 
            isOpen: true, 
            status: 'success', 
            title: 'Sincronização Blindada', 
            message: `Sucesso!\n\nNovos/Atualizados: ${stats.updated + stats.new}\nRemovidos da lista (Inativos): ${stats.deactivated}${stats.rematriculated > 0 ? `\nRematriculados (Auto): ${stats.rematriculated}` : ''}\nIgnorados (Divergências): ${skippedRows.length}` 
        });
        setPreviewData([]); 
    } catch (e: any) {
        setSyncState({ isOpen: true, status: 'error', title: 'Erro ao Salvar', message: "Falha na sincronização.", error: e.message });
    }
  };

  const handleManualSectorChange = (index: number, val: string) => {
      const realIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
      const newData = [...previewData];
      const item = newData[realIndex];
      const labelParts = val.split(' - ');
      const searchName = labelParts.length > 1 ? labelParts[1] : val;
      const searchId = labelParts.length > 1 ? labelParts[0] : '';

      let matchedSector = null;
      if (searchId) matchedSector = proData?.sectors.find(s => cleanID(s.id) === cleanID(searchId) && s.unit === activeUnit);
      if (!matchedSector) matchedSector = proData?.sectors.find(s => s.name === searchName && s.unit === activeUnit);

      if (matchedSector) {
          item.sectorIdLinked = matchedSector.id;
          item.linkedSectorName = matchedSector.name;
          item.sectorStatus = 'ok'; 
      } else {
          item.sectorIdLinked = null;
          item.linkedSectorName = undefined;
          item.sectorStatus = 'error'; 
      }
      item.sectorNameRaw = val; 
      setPreviewData(newData);
  };

  const handleOpenAddSector = () => {
    setSectorModal({ isOpen: true, mode: 'add' });
    setSectorName('');
    setSectorId('');
    setSectorUnit(activeUnit);
  };

  const handleOpenEditSector = (sector: ProSector) => {
    setSectorModal({ isOpen: true, mode: 'edit', sector });
    setSectorName(sector.name);
    setSectorId(String(sector.id));
    setSectorUnit(sector.unit || activeUnit);
  };

  const handleSaveSector = async () => {
    if (!proData || !onSavePro) return;
    if (!sectorId || !sectorName) {
      showToast("ID e Nome são obrigatórios.", "warning");
      return;
    }

    const cleanId = cleanID(sectorId);
    let updatedSectors = [...proData.sectors];

    if (sectorModal.mode === 'add') {
      // Verificar se ID já existe na unidade destino
      if (proData.sectors.some(s => cleanID(s.id) === cleanId && s.unit === sectorUnit)) {
        showToast(`Este ID de setor já existe na unidade ${sectorUnit}.`, "error");
        return;
      }
      
      const newSector: ProSector = {
        id: cleanId,
        name: sectorName,
        unit: sectorUnit,
        active: true,
        cycleMonth: selectedMonth,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      updatedSectors.push(newSector);
    } else if (sectorModal.mode === 'edit' && sectorModal.sector) {
      updatedSectors = updatedSectors.map(s => {
        // Encontra o setor antigo (usamos activeUnit para o filtro inicial mas agora permitimos mudar unit)
        if (s.id === sectorModal.sector?.id && s.unit === sectorModal.sector?.unit) {
          return { ...s, name: sectorName, id: cleanId, unit: sectorUnit, updatedAt: Date.now() };
        }
        return s;
      });
    }

    const success = await onSavePro(proData.staff, updatedSectors, proData.groups);
    if (success) {
      showToast(`Setor ${sectorModal.mode === 'add' ? 'adicionado' : 'atualizado'} com sucesso!`, "success");
      setSectorModal({ isOpen: false, mode: 'add' });
    }
  };

  const handleDeleteSector = async (sector: ProSector) => {
    if (!proData || !onSavePro) return;
    
    // Verificar se há staff ou PGs vinculados
    const hasStaff = proData.staff.some(s => cleanID(s.id) === cleanID(sector.id) && s.unit === activeUnit);
    const hasGroups = proData.groups.some(g => cleanID(g.id) === cleanID(sector.id) && g.unit === activeUnit);
    
    const confirmMsg = (hasStaff || hasGroups) 
      ? `Este setor possui vínculos ativos. Desativar o setor deixará esses registros órfãos. Confirmar desativação?`
      : `Tem certeza que deseja excluir o setor ${sector.name}?`;

    if (!window.confirm(confirmMsg)) return;

    const updatedSectors = proData.sectors.map(s => {
      if (s.id === sector.id && s.unit === activeUnit) {
        return { ...s, active: false, leftAt: Date.now(), updatedAt: Date.now() };
      }
      return s;
    });

    const success = await onSavePro(proData.staff, updatedSectors, proData.groups);
    if (success) {
      showToast("Setor desativado com sucesso!", "success");
    }
  };

  const displayData = useMemo(() => {
      let source: any[] = [];
      if (previewData.length > 0) return previewData;
      if (proData) {
          if (activeTab === 'staff') source = proData.staff.filter(s => s.unit === activeUnit && s.active !== false);
          else if (activeTab === 'sectors') source = proData.sectors.filter(s => s.unit === activeUnit && s.active !== false);
          else source = proData.groups.filter(s => s.unit === activeUnit && s.active !== false);
      }
      return source.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [previewData, proData, activeTab, activeUnit]);

  const totalPages = Math.ceil(displayData.length / ITEMS_PER_PAGE);
  const currentItems = displayData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const getSectorNameFromDB = (sectorId: string) => { const s = proData?.sectors.find(sec => sec.id === sectorId); return s ? s.name : sectorId; };

  const instructions = {
      staff: { icon: 'fa-user-md', title: 'Importação de Colaboradores', fields: "Obrigatório: 'Matrícula', 'Nome', 'ID_Setor' e 'Setor'.", optional: "", warn: "A planilha NÃO deve conter colunas de PGs." },
      sectors: { icon: 'fa-map-marker-alt', title: 'Importação de Setores', fields: "Obrigatório: 'ID' e 'Nome Setor' (ou Departamento).", optional: "", warn: "Proibido: Colunas de Funcionários (Matrícula) ou PGs." },
      pgs: { icon: 'fa-users', title: 'Importação de Pequenos Grupos', fields: "Obrigatório: Apenas ID e Nome do PG (ou Grupo).", optional: "Líder é opcional.", warn: "Proibido: Colunas de Funcionários ou Setores." }
  };
  const currentInst = instructions[activeTab];

  return (
    <div className="space-y-12">
      <SyncModal isOpen={syncState.isOpen} status={syncState.status} title={syncState.title} message={syncState.message} errorDetails={syncState.error} onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} />
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Importação Excel (Modo Blindado)</h2>
          <div className="flex bg-slate-50 p-1.5 rounded-xl gap-2">
             {['HAB', 'HABA'].map(u => (<button key={u} onClick={() => { setActiveUnit(u as any); setPreviewData([]); setCurrentPage(1); }} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeUnit === u ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>Unidade {u}</button>))}
          </div>
        </div>
        <div className="flex gap-4 border-b overflow-x-auto no-scrollbar">
            {[ {id:'sectors', l:'1. Setores', i:'fa-map-marker-alt'}, {id:'staff', l:'2. Colaboradores', i:'fa-user-md'}, {id:'pgs', l:'3. PGs', i:'fa-users'} ].map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setPreviewData([]); setCurrentPage(1); }} className={`pb-4 px-4 text-xs font-black uppercase flex items-center gap-2 border-b-4 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-300'}`}><i className={`fas ${tab.i}`}></i> {tab.l}</button>
            ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Modo de Sincronia:</div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button 
                        onClick={() => setImportMode('sync')}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${importMode === 'sync' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Inativa colaboradores que não estão na planilha, mantendo histórico de matrículas 100% blindado."
                    >
                        Sincronização Segura (Padrão RH)
                    </button>
                    <button 
                        onClick={() => setImportMode('incremental')}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${importMode === 'incremental' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Apenas insere novos e atualiza dados existentes, sem inativar nenhum colaborador."
                    >
                        Apenas Inserir / Atualizar
                    </button>
                </div>
            </div>
            <div className="text-[9px] font-bold text-slate-500 italic max-w-md text-right leading-relaxed">
                {importMode === 'sync' 
                    ? "✓ Sincronização Inteligente: Ativa/atualiza os listados no Excel, e marca como inativos os demitidos. Suas matrículas em PGs e histórico mensal estão 100% protegidos contra exclusão." 
                    : "✓ Apenas Inserir/Atualizar: Mantém todos os colaboradores atuais como ativos e apenas acrescenta novos ou atualiza os que estão no arquivo Excel."}
            </div>
        </div>

        <div className={`p-6 rounded-2xl border-l-4 flex gap-4 items-start ${activeTab === 'pgs' ? 'bg-amber-50 border-amber-400 text-amber-900' : 'bg-blue-50 border-blue-400 text-blue-900'}`}>
            <div className="mt-1"><i className={`fas ${currentInst.icon} text-xl`}></i></div>
            <div className="space-y-1">
                <h4 className="font-black uppercase text-xs tracking-widest">{currentInst.title}</h4>
                <p className="text-[10px] font-bold">{currentInst.fields} {currentInst.optional}</p>
                <p className="text-[10px] font-black uppercase opacity-70"><i className="fas fa-exclamation-triangle mr-1"></i> {currentInst.warn}</p>
            </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                <input type="file" ref={fileInputRef} accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleProcessFile(e.target.files[0])} />
                <button onClick={() => fileInputRef.current?.click()} disabled={isReadingFile} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg hover:bg-black transition-all"><i className={`fas ${isReadingFile ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i> {isReadingFile ? 'Lendo...' : 'Carregar Planilha'}</button>
                
                {activeTab === 'sectors' && (
                  <button 
                    onClick={handleOpenAddSector}
                    className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all active:scale-95"
                    title="Adicionar Setor Manualmente"
                  >
                    <i className="fas fa-plus"></i>
                  </button>
                )}

                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-[9px] font-black text-slate-400 uppercase px-2">Mês de Referência:</label>
                  <input 
                    type="month" 
                    value={selectedMonth.substring(0, 7)} 
                    onChange={(e) => setSelectedMonth(e.target.value + '-01')}
                    className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:ring-0"
                  />
                  <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                    {formatMonthLabel(selectedMonth)}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-400">{previewData.length > 0 ? <span className="text-blue-600">{previewData.length} registros lidos.</span> : <span>Banco Atual: {displayData.length} ativos</span>}</div>
            </div>
            {previewData.length > 0 && (<button onClick={handleConfirmImport} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center gap-2"><i className="fas fa-sync"></i> Sincronizar Banco</button>)}
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead><tr className="text-[9px] font-black uppercase text-slate-400 border-b"><th className="p-4">ID (Limpo)</th><th className="p-4">Nome</th>{activeTab === 'staff' && <th className="p-4">Vínculo de Setor</th>}<th className="p-4">Mês Ref.</th>{activeTab !== 'staff' && <th className="p-4">Unidade</th>}<th className="p-4 text-right">Ações</th></tr></thead>
                <tbody className="divide-y">{currentItems.map((item, i) => (
                    <tr key={i} className={`hover:bg-slate-50 transition-colors ${item.sectorStatus === 'error' ? 'bg-amber-50' : ''}`}>
                        <td className="p-4 text-xs font-mono font-bold text-blue-600">{item.id}</td>
                        <td className="p-4 text-sm font-bold text-slate-700">
                          {item.name}
                          {activeTab === 'sectors' && (
                            <span className={`ml-2 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter shadow-sm ${item.unit === 'HAB' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                              {item.unit}
                            </span>
                          )}
                        </td>
                        {activeTab === 'staff' && (
                          <>
                            <td className="p-4">{previewData.length > 0 ? (item.sectorStatus === 'ok' ? (<div className="flex items-center justify-between group"><div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]"><i className="fas fa-check"></i></div><div><span className="text-[10px] font-black text-slate-700 uppercase block">{item.linkedSectorName}</span>{item.sectorNameRaw && item.sectorNameRaw !== item.linkedSectorName && (<span className="text-[8px] text-slate-400 block strike">Excel: {item.sectorNameRaw}</span>)}</div></div><button onClick={() => handleManualSectorChange(i, '')} className="w-6 h-6 rounded-lg bg-slate-50 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-pencil-alt text-[10px]"></i></button></div>) : (<div className="space-y-1"><Autocomplete options={sectorOptions} value={item.sectorNameRaw || ''} onChange={(val) => handleManualSectorChange(i, val)} placeholder="⚠️ Vincular Setor..." required={false} className="w-full p-2 text-xs font-bold rounded-xl border-2 border-amber-300 bg-white" /><span className="text-[8px] font-bold text-rose-400">ID Excel: {item.sectorIdRaw || 'N/A'}</span></div>)) : (<span className="text-[10px] font-bold uppercase text-slate-500">{getSectorNameFromDB(item.sectorId)}</span>)}</td>
                          </>
                        )}
                        <td className="p-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase">
                            {item.cycleMonth ? formatMonthLabel(item.cycleMonth) : (previewData.length > 0 ? formatMonthLabel(selectedMonth) : 'N/A')}
                          </span>
                        </td>
                        {activeTab !== 'staff' && <td className="p-4 text-xs font-bold text-slate-400">{item.unit}</td>}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             {activeTab === 'sectors' && (
                               <>
                                 <button onClick={() => handleOpenEditSector(item)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex items-center justify-center" title="Editar Setor">
                                   <i className="fas fa-edit text-[10px]"></i>
                                 </button>
                                 <button onClick={() => handleDeleteSector(item)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm flex items-center justify-center" title="Excluir Setor">
                                   <i className="fas fa-trash-alt text-[10px]"></i>
                                 </button>
                               </>
                             )}
                          </div>
                        </td>
                    </tr>
                ))}</tbody>
            </table>
        </div>
        {totalPages > 1 && (<div className="flex items-center justify-center gap-2 pt-6"><button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600"><i className="fas fa-chevron-left"></i></button><button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600"><i className="fas fa-chevron-right"></i></button></div>)}

        {/* Log de Divergências */}
        {skippedRows.length > 0 && (
          <div className="mt-12 p-8 bg-rose-50 border border-rose-100 rounded-[2.5rem] space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between border-b border-rose-200 pb-4">
              <div className="flex items-center gap-3 text-rose-800">
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                  <i className="fas fa-exclamation-circle text-lg"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">Log de Divergências ({skippedRows.length})</h3>
                  <p className="text-[10px] font-bold opacity-70 uppercase">Registros ignorados para garantir a integridade do banco</p>
                </div>
              </div>
              <button 
                onClick={() => setSkippedRows([])}
                className="text-rose-400 hover:text-rose-600 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
              {skippedRows.map((row, idx) => (
                <div key={idx} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{row.id}</span>
                    <span className="text-[8px] font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full uppercase">Ignorado</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 truncate">{row.name}</h4>
                  <p className="text-[9px] font-medium text-slate-400 leading-tight italic">{row.reason}</p>
                </div>
              ))}
            </div>
            
            <div className="bg-white/50 p-4 rounded-2xl border border-rose-100/50">
              <p className="text-[9px] font-bold text-rose-800 leading-relaxed uppercase tracking-wide">
                <i className="fas fa-info-circle mr-1"></i>
                Dica: Verifique se existem matrículas duplicadas ou linhas em branco no seu arquivo Excel. O sistema exige IDs únicos para evitar sobreposição de dados.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Modal de Setor */}
      {sectorModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-slate-800">
              <h3 className="font-black uppercase text-sm tracking-widest">
                {sectorModal.mode === 'add' ? 'Adicionar Novo Setor' : 'Editar Setor'}
              </h3>
              <button onClick={() => setSectorModal({ isOpen: false, mode: 'add' })} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Unidade</label>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
                  {[Unit.HAB, Unit.HABA].map(u => (
                    <button
                      key={u}
                      onClick={() => setSectorUnit(u as Unit)}
                      className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition-all ${
                        sectorUnit === u ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">ID do Setor (Código Base)</label>
                <input 
                  type="text" 
                  value={sectorId}
                  onChange={(e) => setSectorId(e.target.value)}
                  placeholder="Ex: 101"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                  disabled={sectorModal.mode === 'edit'} // ID é imutável na edição por segurança conforme pedido
                />
                {sectorModal.mode === 'edit' && <p className="text-[9px] text-slate-400 italic ml-2">* O ID é a chave base e não pode ser alterado aqui por integridade.</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nome do Setor</label>
                <input 
                  type="text" 
                  value={sectorName}
                  onChange={(e) => setSectorName(e.target.value)}
                  placeholder="Ex: UTI ADULTO"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all text-slate-800"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setSectorModal({ isOpen: false, mode: 'add' })}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveSector}
                  className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                  Confirmar {sectorModal.mode === 'add' ? 'Adição' : 'Alteração'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLists;
