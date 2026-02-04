
import React, { useRef, useState, useMemo } from 'react';
import * as Xlsx from 'xlsx';
import { useToast } from '../../contexts/ToastContext';
import PGMaestro from './PGMaestro';
import { ProStaff, ProSector, ProGroup, Unit } from '../../types';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import Autocomplete from '../Shared/Autocomplete';
import { normalizeString } from '../../utils/formatters';

interface AdminListsProps {
  lists: {
    sectorsHAB: string; sectorsHABA: string;
    groupsHAB: string; groupsHABA: string;
    staffHAB: string; staffHABA: string;
  };
  setLists: React.Dispatch<React.SetStateAction<any>>;
  onAutoSave?: (updatedLists: any) => Promise<void>;
  proData?: { staff: ProStaff[]; sectors: ProSector[]; groups: ProGroup[] };
  onSavePro?: (staff: ProStaff[], sectors: ProSector[], groups: ProGroup[], legacyLists: any) => Promise<void>;
}

interface PreviewItem {
  id: string; // ID Puro (Excel)
  name: string;
  unit: Unit;
  
  // Campos Específicos de Staff
  sectorIdRaw?: string; // O que veio do Excel
  sectorNameRaw?: string; // O que veio do Excel
  sectorIdLinked?: string | null; // O ID validado no banco
  sectorStatus?: 'ok' | 'error' | 'new'; // Status do vínculo
  
  // Campos Específicos de Setor
  // (Usa id e name básicos)
}

const AdminLists: React.FC<AdminListsProps> = ({ lists, setLists, onAutoSave, proData, onSavePro }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'staff' | 'sectors' | 'pgs'>('staff');
  const [activeUnit, setActiveUnit] = useState<'HAB' | 'HABA'>('HAB');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ isOpen: false, status: 'idle', title: '', message: '' });
  
  const [previewData, setPreviewData] = useState<PreviewItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20; 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- UTILITÁRIOS DE LIMPEZA ---

  const getRawId = (val: any): string => {
      if (val === undefined || val === null) return "";
      let str = String(val).trim().toUpperCase();
      // REGRA: Remover prefixos HAB/HABA e manter apenas a matrícula (números/letras finais)
      // Ex: "HAB-1234" -> "1234", "HABA 5678" -> "5678"
      return str.replace(/^(HAB|HABA)[-\s]*/i, '').trim();
  };

  const normalizeHeader = (h: string) => 
    String(h || '')
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,º°ª#]/g, "")
      .replace(/\s+/g, " ");

  const findColumnIndex = (headers: string[], synonyms: string[]) => {
      let idx = headers.findIndex(h => synonyms.some(s => h === s));
      if (idx !== -1) return idx;
      return headers.findIndex(h => synonyms.some(s => h.includes(s)));
  };

  // --- OPÇÕES DE SETOR (Para Autocomplete) ---
  const sectorOptions = useMemo(() => {
      if (!proData) return [];
      return proData.sectors
        .filter(s => s.unit === activeUnit)
        .map(s => ({ 
            value: s.name, 
            label: `${s.id} - ${s.name}`, // Mostra ID e Nome para facilitar
            subLabel: s.name,
            category: 'RH' as const 
        }));
  }, [proData, activeUnit]);

  // --- PROCESSAMENTO DO ARQUIVO ---

  const processFile = (file: File) => {
    setIsProcessingFile(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = Xlsx.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = Xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        if (allRows.length < 2) {
          showToast("Planilha vazia ou inválida.", "warning");
          setIsProcessingFile(false);
          return;
        }

        // 1. Identificar Cabeçalhos
        let dataStartRow = -1;
        let headers: string[] = [];

        for(let i = 0; i < Math.min(allRows.length, 50); i++){
            const row = allRows[i].map(c => normalizeHeader(String(c)));
            const hasKeywords = row.some(cell => 
                cell.includes('SETOR') || cell.includes('MATRICULA') || 
                cell.includes('CRACHA') || cell.includes('PG') || 
                cell.includes('GRUPO') || cell.includes('DEPARTAMENTO') || cell.includes('ID')
            );
            if(hasKeywords){ headers = row; dataStartRow = i + 1; break; }
        }
        
        if (dataStartRow === -1) {
            showToast("Não foi possível identificar as colunas. Verifique os cabeçalhos.", "warning");
            setIsProcessingFile(false);
            return;
        }

        const dataRows = allRows.slice(dataStartRow);
        const seenIds = new Set<string>();
        
        // 2. Mapeamento de Colunas Genérico
        const idxId = findColumnIndex(headers, ['ID', 'COD', 'MATRICULA', 'MAT', 'CRACHA', 'REGISTRO']);
        const idxName = findColumnIndex(headers, ['NOME', 'COLABORADOR', 'FUNCIONARIO', 'SETOR', 'PG', 'GRUPO', 'DESCRIÇÃO']);
        
        // Colunas Específicas de Staff
        const idxSecId = findColumnIndex(headers, ['ID SETOR', 'COD SETOR', 'COD DEPARTAMENTO', 'CODIGO SETOR']);
        const idxSecName = findColumnIndex(headers, ['NOME SETOR', 'SETOR', 'DEPARTAMENTO']);

        const res: PreviewItem[] = dataRows.map(row => {
            const rawId = getRawId(row[idxId]);
            // Se não tiver ID, tenta usar o nome como ID (caso de PGs sem ID explícito)
            const name = String(row[idxName]||'').trim();
            const finalId = rawId || (activeTab === 'pgs' ? name : ''); 

            if(!finalId) return null;
            if(seenIds.has(finalId)) return null; // Evita duplicatas no mesmo arquivo
            seenIds.add(finalId);

            const item: PreviewItem = {
                id: finalId,
                name: name,
                unit: activeUnit,
                sectorStatus: 'ok'
            };

            if (activeTab === 'staff') {
                const sIdRaw = row[idxSecId] ? getRawId(row[idxSecId]) : '';
                const sNameRaw = row[idxSecName] ? String(row[idxSecName]).trim() : '';
                
                item.sectorIdRaw = sIdRaw;
                item.sectorNameRaw = sNameRaw;
                
                // TENTA VINCULAR AUTOMATICAMENTE
                let match = null;
                
                // 1. Por ID (Prioridade Máxima)
                if (sIdRaw && proData) {
                    match = proData.sectors.find(s => s.unit === activeUnit && s.id === sIdRaw);
                }
                
                // 2. Por Nome (Fuzzy)
                if (!match && sNameRaw && proData) {
                    const norm = normalizeString(sNameRaw);
                    match = proData.sectors.find(s => s.unit === activeUnit && normalizeString(s.name) === norm);
                }

                if (match) {
                    item.sectorIdLinked = match.id;
                    item.sectorStatus = 'ok';
                } else {
                    item.sectorIdLinked = null;
                    item.sectorStatus = 'error';
                }
            }

            return item;
        }).filter((i): i is PreviewItem => i !== null);

        setPreviewData(res);
        setCurrentPage(1);
        
        if (res.length > 0) {
            showToast(`${res.length} registros processados.`, "success");
        } else {
            showToast("Nenhum registro válido encontrado.", "warning");
        }

      } catch (err) {
        console.error("Erro no processamento do Excel:", err);
        showToast("Erro ao processar arquivo.", "warning");
      } finally {
        setIsProcessingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- CORREÇÃO MANUAL NA TABELA ---

  const handleManualSectorChange = (index: number, val: string) => {
      const realIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
      const newData = [...previewData];
      const item = newData[realIndex];

      // Tenta achar pelo formato "ID - Nome" que montamos nas options
      let matchedSector = null;
      if (val.includes(' - ')) {
          const idPart = val.split(' - ')[0];
          matchedSector = proData?.sectors.find(s => s.id === idPart && s.unit === activeUnit);
      }

      // Se não achou, busca pelo nome exato
      if (!matchedSector) {
          matchedSector = proData?.sectors.find(s => s.name === val && s.unit === activeUnit);
      }

      if (matchedSector) {
          item.sectorIdLinked = matchedSector.id;
          item.sectorStatus = 'ok'; // SUCESSO: Vira check verde e fecha input
      } else {
          item.sectorIdLinked = null;
          item.sectorStatus = 'error'; // ERRO: Continua com input aberto
      }
      
      item.sectorNameRaw = val; 
      setPreviewData(newData);
  };

  const handleForceEdit = (index: number) => {
      const realIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
      const newData = [...previewData];
      // Força o status para erro/edição para abrir o input novamente
      newData[realIndex].sectorStatus = 'error';
      // Preenche o input com o nome atual para facilitar a edição
      if (newData[realIndex].sectorIdLinked && proData) {
          const s = proData.sectors.find(sec => sec.id === newData[realIndex].sectorIdLinked);
          if (s) newData[realIndex].sectorNameRaw = s.name;
      }
      setPreviewData(newData);
  };

  // --- IMPORTAÇÃO FINAL (BLINDADA) ---

  const handleConfirmImport = async () => {
    if (!proData || !onSavePro) return;
    setSyncState({ isOpen: true, status: 'processing', title: 'Salvando Dados', message: 'Processando e unificando registros...' });
    
    try {
        let updatedSectors = [...proData.sectors];
        let updatedStaff = [...proData.staff];
        let updatedGroups = [...proData.groups];
        
        const newIds = new Set(previewData.map(i => i.id));

        if (activeTab === 'sectors') {
            updatedSectors = [
                ...updatedSectors.filter(s => !(newIds.has(s.id) && s.unit === activeUnit)), 
                ...previewData.map(p => ({ id: p.id, name: p.name, unit: p.unit }))
            ];
        } else if (activeTab === 'staff') {
            // Regra de Ouro: IDs de Staff não podem ter prefixo de unidade. O getRawId já cuidou disso no previewData.
            updatedStaff = [
                ...updatedStaff.filter(s => !(newIds.has(s.id) && s.unit === activeUnit)),
                ...previewData.map(p => ({
                    id: p.id,
                    name: p.name,
                    sectorId: p.sectorIdLinked || "",
                    unit: p.unit
                }))
            ];
        } else if (activeTab === 'pgs') {
            const prefixPG = (id: string) => id.startsWith(activeUnit) ? id : `${activeUnit}-${id}`;
            const pgIds = new Set(previewData.map(p => prefixPG(p.id)));
            updatedGroups = [
                ...updatedGroups.filter(g => !pgIds.has(g.id)),
                ...previewData.map(p => ({
                    id: prefixPG(p.id),
                    name: p.name,
                    unit: p.unit
                }))
            ];
        }

        const legacyUpdate = {
            ...lists,
            staffHAB: updatedStaff.filter(s => s.unit === 'HAB').map(s => `${s.id} | ${s.name}`).join('\n'),
            staffHABA: updatedStaff.filter(s => s.unit === 'HABA').map(s => `${s.id} | ${s.name}`).join('\n'),
            sectorsHAB: updatedSectors.filter(s => s.unit === 'HAB').map(s => `${s.id} - ${s.name}`).join('\n'),
            sectorsHABA: updatedSectors.filter(s => s.unit === 'HABA').map(s => `${s.id} - ${s.name}`).join('\n'),
            groupsHAB: updatedGroups.filter(s => s.unit === 'HAB').map(g => `${g.name}`).join('\n'),
            groupsHABA: updatedGroups.filter(s => s.unit === 'HABA').map(g => `${g.name}`).join('\n')
        };

        const success = await onSavePro(updatedStaff, updatedSectors, updatedGroups, legacyUpdate);
        
        if (success === false) throw new Error("Recusa do servidor.");

        const unlinked = previewData.filter(p => activeTab === 'staff' && !p.sectorIdLinked).length;
        const msg = unlinked > 0 
            ? `Importação Concluída! ${previewData.length} registros salvos. Atenção: ${unlinked} colaboradores ficaram sem setor.`
            : `Sucesso! ${previewData.length} registros importados e vinculados corretamente.`;

        setSyncState({ isOpen: true, status: 'success', title: 'Finalizado', message: msg });
        setPreviewData([]); 
    } catch (e: any) {
        console.error("Falha na importação:", e);
        setSyncState({ 
            isOpen: true, 
            status: 'error', 
            title: 'Erro ao Salvar', 
            message: "Houve uma falha técnica ao gravar os dados.", 
            error: e.message 
        });
    }
  };

  const displayData = useMemo(() => {
      let source: any[] = [];
      if (previewData.length > 0) return previewData;
      
      if (proData) {
          if (activeTab === 'staff') source = proData.staff.filter(s => s.unit === activeUnit);
          else if (activeTab === 'sectors') source = proData.sectors.filter(s => s.unit === activeUnit);
          else source = proData.groups.filter(s => s.unit === activeUnit);
      }
      return source.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [previewData, proData, activeTab, activeUnit]);

  const totalPages = Math.ceil(displayData.length / ITEMS_PER_PAGE);
  const currentItems = displayData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getSectorName = (id: string) => {
      const s = proData?.sectors.find(sec => sec.id === id);
      return s ? s.name : id;
  };

  return (
    <div className="space-y-12">
      <SyncModal isOpen={syncState.isOpen} status={syncState.status} title={syncState.title} message={syncState.message} errorDetails={syncState.error} onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} />
      
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Importação Excel</h2>
          <div className="flex bg-slate-50 p-1.5 rounded-xl gap-2">
             {['HAB', 'HABA'].map(u => (<button key={u} onClick={() => { setActiveUnit(u as any); setPreviewData([]); setCurrentPage(1); }} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeUnit === u ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>Unidade {u}</button>))}
          </div>
        </div>
        
        <div className="flex gap-4 border-b overflow-x-auto no-scrollbar">
            {[
                {id:'sectors', l:'1. Setores', i:'fa-map-marker-alt'}, 
                {id:'staff', l:'2. Colaboradores', i:'fa-user-md'}, 
                {id:'pgs', l:'3. PGs', i:'fa-users'}
            ].map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setPreviewData([]); setCurrentPage(1); }} className={`pb-4 px-4 text-xs font-black uppercase flex items-center gap-2 border-b-4 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-300'}`}><i className={`fas ${tab.i}`}></i> {tab.l}</button>
            ))}
        </div>

        <div className="bg-slate-50 p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <input type="file" ref={fileInputRef} accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessingFile} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg hover:bg-black transition-all disabled:opacity-50">
                    <i className={`fas ${isProcessingFile ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i> 
                    {isProcessingFile ? 'Lendo...' : 'Carregar Planilha'}
                </button>
                <div className="text-xs font-bold text-slate-400">
                    {previewData.length > 0 
                        ? <span className="text-blue-600">{previewData.length} registros lidos.</span>
                        : <span>Banco Atual: {displayData.length} registros</span>}
                </div>
            </div>
            {previewData.length > 0 && (
                <button onClick={handleConfirmImport} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center gap-2 animate-in slide-in-from-right duration-300">
                    <i className="fas fa-save"></i> Gravar no Banco
                </button>
            )}
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-[9px] font-black uppercase text-slate-400 border-b">
                        <th className="p-4">ID (Excel)</th>
                        <th className="p-4">Nome</th>
                        {activeTab === 'staff' && <th className="p-4">Vínculo de Setor (Excel -> Banco)</th>}
                        {activeTab !== 'staff' && <th className="p-4">Unidade</th>}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {currentItems.map((item, i) => (
                        <tr key={i} className={`hover:bg-slate-50 transition-colors ${item.sectorStatus === 'error' ? 'bg-amber-50' : ''}`}>
                            <td className="p-4 text-xs font-mono font-bold text-blue-600">{item.id}</td>
                            <td className="p-4 text-sm font-bold text-slate-700">{item.name}</td>
                            
                            {activeTab === 'staff' && (
                                <td className="p-4">
                                    {previewData.length > 0 ? (
                                        // --- MODO PREVIEW INTELIGENTE ---
                                        item.sectorStatus === 'ok' ? (
                                            // CENÁRIO A: SUCESSO (MOSTRA TEXTO LIMPO)
                                            <div className="flex items-center justify-between group">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] shadow-sm">
                                                        <i className="fas fa-check"></i>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-700 uppercase leading-none">
                                                            {getSectorName(item.sectorIdLinked!)}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                            Vinculado
                                                        </span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleForceEdit(i)} 
                                                    className="w-6 h-6 rounded-lg bg-slate-50 text-slate-300 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                    title="Alterar Vínculo Manualmente"
                                                >
                                                    <i className="fas fa-pencil-alt text-[10px]"></i>
                                                </button>
                                            </div>
                                        ) : (
                                            // CENÁRIO B: ERRO/NOVO (MOSTRA CAMPO DE BUSCA)
                                            <div className="flex items-center gap-2 animate-in slide-in-from-left duration-300">
                                                {/* Badge do Valor Original do Excel */}
                                                <div className="hidden md:flex flex-col items-end min-w-[60px] opacity-50">
                                                    <span className="text-[7px] font-black text-rose-400 uppercase">Excel</span>
                                                    <span className="text-[9px] font-mono text-rose-600 line-through">{item.sectorIdRaw || "?"}</span>
                                                </div>
                                                
                                                {/* Campo de Busca / Correção */}
                                                <div className="relative flex-1 min-w-[220px]">
                                                    <Autocomplete 
                                                        options={sectorOptions}
                                                        value={item.sectorNameRaw || ''}
                                                        onChange={(val) => handleManualSectorChange(i, val)}
                                                        onSelectOption={(val) => handleManualSectorChange(i, val)}
                                                        placeholder="⚠️ Corrigir Setor..."
                                                        required={false}
                                                        className="w-full p-2.5 pl-3 text-xs font-bold rounded-xl border-2 bg-white border-amber-300 text-amber-700 placeholder-amber-400 focus:ring-4 focus:ring-amber-100 focus:border-amber-400 transition-all shadow-sm"
                                                    />
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        // --- MODO VISUALIZAÇÃO (BANCO) ---
                                        <span className={`text-[10px] font-bold uppercase ${!item.sectorId ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {getSectorName(item.sectorId)}
                                        </span>
                                    )}
                                </td>
                            )}

                            {activeTab !== 'staff' && (
                                <td className="p-4 text-xs font-bold text-slate-400">{item.unit}</td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-30"><i className="fas fa-chevron-left"></i></button>
                <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                        let pageNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) { pageNum = currentPage - 2 + i; if (pageNum > totalPages) pageNum = totalPages - (4 - i); }
                        if (pageNum <= 0 || pageNum > totalPages) return null;
                        return (<button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{pageNum}</button>);
                    })}
                </div>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-30"><i className="fas fa-chevron-right"></i></button>
            </div>
        )}
      </section>
      
      <PGMaestro lists={lists} setLists={setLists} onAutoSave={onAutoSave} />
    </div>
  );
};

export default AdminLists;
