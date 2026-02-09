
import React, { useRef, useState, useMemo } from 'react';
import * as Xlsx from 'xlsx';
import { useToast } from '../../contexts/ToastContext';
import PGMaestro from './PGMaestro';
import { ProStaff, ProSector, ProGroup, Unit } from '../../types';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import Autocomplete from '../Shared/Autocomplete';
import { normalizeString, cleanID } from '../../utils/formatters';

interface AdminListsProps {
  proData?: { staff: ProStaff[]; sectors: ProSector[]; groups: ProGroup[] };
  onSavePro?: (staff: ProStaff[], sectors: ProSector[], groups: ProGroup[]) => Promise<boolean>;
}

interface PreviewItem {
  id: string; 
  name: string;
  unit: Unit;
  sectorIdRaw?: string; 
  sectorNameRaw?: string; 
  sectorIdLinked?: string | null; 
  sectorStatus?: 'ok' | 'error' | 'new'; 
  linkedSectorName?: string; // Para exibição visual do vínculo encontrado
}

const AdminLists: React.FC<AdminListsProps> = ({ proData, onSavePro }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'staff' | 'sectors' | 'pgs'>('staff');
  const [activeUnit, setActiveUnit] = useState<Unit>(Unit.HAB);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ isOpen: false, status: 'idle', title: '', message: '' });
  
  const [previewData, setPreviewData] = useState<PreviewItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20; 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalização de cabeçalhos para identificar colunas flexivelmente
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

  const sectorOptions = useMemo(() => {
      if (!proData) return [];
      return proData.sectors
        .filter(s => s.unit === activeUnit)
        .map(s => ({ 
            value: s.name, 
            label: `${s.id} - ${s.name}`, 
            subLabel: s.name,
            category: 'RH' as const 
        }));
  }, [proData, activeUnit]);

  // --- BLINDAGENS DE IMPORTAÇÃO (REFINADO) ---

  const validateSheetType = (headers: string[], tab: string): boolean => {
      // Definições de Assinatura de Colunas
      const hasStaffCols = headers.some(h => h.includes('MATRICULA') || h.includes('CRACHA') || h.includes('FUNCIONARIO') || h.includes('COLABORADOR'));
      const hasSectorCols = headers.some(h => h.includes('DEPARTAMENTO') || (h.includes('SETOR') && !h.includes('ID')) || h.includes('CENTRO DE CUSTO'));
      const hasPGCols = headers.some(h => h.includes('LIDER') || h.includes('PEQUENO GRUPO') || h.includes('ANFITRIAO'));

      if (tab === 'staff') {
          // Aba Colaboradores: Exige colunas de pessoa.
          if (!hasStaffCols) {
              showToast("Arquivo inválido para Colaboradores. Necessário coluna 'Matrícula', 'Crachá' ou 'Funcionário'.", "warning");
              return false;
          }
          // Nota: Pode ter colunas de setor, sem problemas.
      }

      if (tab === 'sectors') {
          // Aba Setores: Exige colunas de setor.
          if (!hasSectorCols) {
              showToast("Arquivo inválido para Setores. Necessário coluna 'Nome Setor' ou 'Departamento'.", "warning");
              return false;
          }
          // Trava de Segurança: Se tiver colunas de funcionário, provavelmente é a lista errada.
          if (hasStaffCols) {
              showToast("Segurança: Esta planilha contém dados de Colaboradores (Matrícula/Crachá). Não importe na aba de Setores.", "warning");
              return false;
          }
      }

      if (tab === 'pgs') {
          // Aba PGs: Exige colunas de PG.
          if (!hasPGCols) {
              showToast("Arquivo inválido para PGs. Necessário coluna 'Líder', 'PG' ou 'Anfitrião'.", "warning");
              return false;
          }
      }

      return true;
  };

  const validateUnitConsistency = (rows: any[][], idIdx: number, targetUnit: Unit): boolean => {
      // Verifica as primeiras 20 linhas para ver se há prefixos da outra unidade
      const otherUnit = targetUnit === 'HAB' ? 'HABA' : 'HAB';
      for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const idVal = String(rows[i][idIdx] || '').toUpperCase();
          if (idVal.includes(otherUnit + '-') || idVal.includes(otherUnit + ' ')) {
              showToast(`ERRO CRÍTICO: Planilha contém registros da unidade ${otherUnit}. Abortando para proteger a base ${targetUnit}.`, "warning");
              return false;
          }
      }
      return true;
  };

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

        // 1. Identificar Linha de Cabeçalho
        let dataStartRow = -1;
        let headers: string[] = [];

        for(let i = 0; i < Math.min(allRows.length, 50); i++){
            const row = allRows[i].map(c => normalizeHeader(String(c)));
            // Palavras-chave genéricas para achar o header
            const hasKeywords = row.some(cell => 
                cell.includes('SETOR') || cell.includes('MATRICULA') || 
                cell.includes('CRACHA') || cell.includes('PG') || 
                cell.includes('GRUPO') || cell.includes('DEPARTAMENTO') || cell.includes('ID') || cell.includes('NOME')
            );
            if(hasKeywords){ headers = row; dataStartRow = i + 1; break; }
        }
        
        if (dataStartRow === -1) {
            showToast("Não foi possível identificar as colunas. Verifique o cabeçalho.", "warning");
            setIsProcessingFile(false);
            return;
        }

        // 2. Validações de Segurança (Tipagem de Aba)
        if (!validateSheetType(headers, activeTab)) {
            setIsProcessingFile(false);
            return;
        }

        const dataRows = allRows.slice(dataStartRow);
        
        // Mapeamento de Colunas
        const idxId = findColumnIndex(headers, ['ID', 'COD', 'MATRICULA', 'MAT', 'CRACHA', 'REGISTRO']);
        const idxName = findColumnIndex(headers, ['NOME', 'COLABORADOR', 'FUNCIONARIO', 'SETOR', 'PG', 'GRUPO', 'DESCRIÇÃO']);
        
        // Colunas específicas de Staff (Vínculo)
        const idxSecId = findColumnIndex(headers, ['ID SETOR', 'COD SETOR', 'COD DEPARTAMENTO', 'CODIGO SETOR']);
        const idxSecName = findColumnIndex(headers, ['NOME SETOR', 'SETOR', 'DEPARTAMENTO']);

        if (idxId === -1 || idxName === -1) {
            showToast("Colunas obrigatórias (ID/Matrícula e Nome) não encontradas.", "warning");
            setIsProcessingFile(false);
            return;
        }

        // 3. Validação de Unidade nos Dados (Cross-Check HAB/HABA)
        if (!validateUnitConsistency(dataRows, idxId, activeUnit)) {
            setIsProcessingFile(false);
            return;
        }

        const seenIds = new Set<string>();
        const res: PreviewItem[] = [];

        dataRows.forEach(row => {
            // Limpeza agressiva do ID para comparação correta
            const rawId = cleanID(row[idxId]); 
            const name = String(row[idxName]||'').trim();
            
            // Para PGs, às vezes não tem ID numérico, usa o nome como ID se necessário, mas ideal é ID
            const finalId = rawId || (activeTab === 'pgs' ? cleanID(name) : ''); 

            if(!finalId) return;
            if(seenIds.has(finalId)) return; 
            seenIds.add(finalId);

            const item: PreviewItem = {
                id: finalId, // ID limpo (apenas números ou string normalizada)
                name: name,
                unit: activeUnit,
                sectorStatus: 'ok'
            };

            // Lógica de Vínculo de Setor (Exclusivo para Aba Staff)
            if (activeTab === 'staff') {
                const sIdRaw = row[idxSecId] ? cleanID(row[idxSecId]) : '';
                const sNameRaw = row[idxSecName] ? String(row[idxSecName]).trim() : '';
                
                item.sectorIdRaw = sIdRaw;
                item.sectorNameRaw = sNameRaw;
                
                let match = null;
                
                // Tenta casar pelo ID do setor primeiro (mais seguro)
                if (sIdRaw && proData) {
                    match = proData.sectors.find(s => s.unit === activeUnit && cleanID(s.id) === sIdRaw);
                }
                // Fallback: Tenta pelo nome se não achou ID
                if (!match && sNameRaw && proData) {
                    const norm = normalizeString(sNameRaw);
                    match = proData.sectors.find(s => s.unit === activeUnit && normalizeString(s.name) === norm);
                }

                if (match) {
                    item.sectorIdLinked = match.id;
                    item.linkedSectorName = match.name;
                    item.sectorStatus = 'ok';
                } else {
                    item.sectorIdLinked = null;
                    item.linkedSectorName = undefined;
                    item.sectorStatus = 'error'; // Vai pintar de laranja/vermelho
                }
            }
            res.push(item);
        });

        setPreviewData(res);
        setCurrentPage(1);
        showToast(`${res.length} registros válidos lidos.`, "success");

      } catch (err) {
        console.error(err);
        showToast("Erro crítico ao processar arquivo.", "warning");
      } finally {
        setIsProcessingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- LÓGICA DE SALVAMENTO BLINDADA (MAP STRATEGY) ---
  const handleConfirmImport = async () => {
    if (!proData || !onSavePro) return;
    setSyncState({ isOpen: true, status: 'processing', title: 'Sincronizando', message: 'Calculando diferenças e salvando...' });
    
    try {
        console.log(`[Import] Iniciando Sync Blindado. Unidade: ${activeUnit}`);
        
        let stats = { updated: 0, deactivated: 0, new: 0 };
        
        // Função Genérica de Merge usando MAP para evitar duplicidade de chaves
        const mergeData = (currentDB: any[], incomingList: PreviewItem[], type: 'staff'|'sector'|'pg') => {
            const map = new Map<string, any>();

            // 1. Carrega TUDO que já existe no banco para o mapa
            currentDB.forEach(item => {
                // Chave composta se necessário, mas aqui usaremos o ID limpo como chave canônica
                const key = cleanID(item.id); 
                map.set(key, item);
            });

            // 2. Processa a lista da Planilha (Incoming)
            // Se o ID já existe, atualiza. Se não, cria.
            incomingList.forEach(incoming => {
                const key = incoming.id; // Já está limpo pelo processFile
                const existing = map.get(key);

                if (existing) {
                    // Se existe, mas é de outra unidade (colisão de ID entre unidades?), IGNORA se for proteger.
                    if (existing.unit === activeUnit) {
                        // Atualiza registro existente da MESMA unidade
                        const updated = {
                            ...existing,
                            name: incoming.name,
                            active: true, // Reativa se estava inativo
                            updatedAt: Date.now()
                        };
                        
                        // Atualiza campos específicos
                        if (type === 'staff') {
                            updated.sectorId = incoming.sectorIdLinked || existing.sectorId || "";
                        }
                        
                        map.set(key, updated);
                        stats.updated++;
                    } 
                } else {
                    // Novo Registro
                    const newItem: any = {
                        id: key,
                        name: incoming.name,
                        unit: activeUnit,
                        active: true,
                        updatedAt: Date.now()
                    };
                    if (type === 'staff') newItem.sectorId = incoming.sectorIdLinked || "";
                    
                    map.set(key, newItem);
                    stats.new++;
                }
            });

            // 3. Passada de Desativação (Sync)
            // Itens que estão no banco, são desta unidade, mas NÃO vieram na planilha
            const incomingKeys = new Set(incomingList.map(i => i.id));
            
            const resultList: any[] = [];
            
            map.forEach((value, key) => {
                // Se é da unidade ativa
                if (value.unit === activeUnit) {
                    // E não está na lista de entrada
                    if (!incomingKeys.has(key)) {
                        // Desativa (Soft Delete)
                        if (value.active !== false) {
                            value.active = false;
                            value.updatedAt = Date.now();
                            stats.deactivated++;
                        }
                    }
                }
                resultList.push(value);
            });

            return resultList;
        };

        if (activeTab === 'staff') {
            const finalStaff = mergeData(proData.staff, previewData, 'staff');
            await onSavePro(finalStaff, proData.sectors, proData.groups);
        } else if (activeTab === 'sectors') {
            const finalSectors = mergeData(proData.sectors, previewData, 'sector');
            await onSavePro(proData.staff, finalSectors, proData.groups);
        } else if (activeTab === 'pgs') {
            const finalGroups = mergeData(proData.groups, previewData, 'pg');
            await onSavePro(proData.staff, proData.sectors, finalGroups);
        }

        setSyncState({ 
            isOpen: true, 
            status: 'success', 
            title: 'Sincronização Blindada', 
            message: `Sucesso!\n\nNovos/Atualizados: ${stats.updated + stats.new}\nDesativados (Saíram da folha): ${stats.deactivated}` 
        });
        setPreviewData([]); 

    } catch (e: any) {
        console.error("[Import Error]", e);
        setSyncState({ isOpen: true, status: 'error', title: 'Erro ao Salvar', message: "Falha na sincronização.", error: e.message });
    }
  };

  const handleManualSectorChange = (index: number, val: string) => {
      const realIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
      const newData = [...previewData];
      const item = newData[realIndex];
      
      // Tenta achar pelo nome ou label
      const labelParts = val.split(' - ');
      const searchName = labelParts.length > 1 ? labelParts[1] : val;
      const searchId = labelParts.length > 1 ? labelParts[0] : '';

      let matchedSector = null;
      if (searchId) {
          matchedSector = proData?.sectors.find(s => cleanID(s.id) === cleanID(searchId) && s.unit === activeUnit);
      }
      if (!matchedSector) {
          matchedSector = proData?.sectors.find(s => s.name === searchName && s.unit === activeUnit);
      }

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

  // Helper para mostrar nome do setor na tabela principal (modo somente leitura do banco)
  const getSectorNameFromDB = (sectorId: string) => {
      const s = proData?.sectors.find(sec => sec.id === sectorId);
      return s ? s.name : sectorId;
  };

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
        <div className="bg-slate-50 p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <input type="file" ref={fileInputRef} accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessingFile} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg hover:bg-black transition-all">
                    <i className={`fas ${isProcessingFile ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i> {isProcessingFile ? 'Lendo...' : 'Carregar Planilha'}
                </button>
                <div className="text-xs font-bold text-slate-400">{previewData.length > 0 ? <span className="text-blue-600">{previewData.length} registros lidos.</span> : <span>Banco Atual: {displayData.length} ativos</span>}</div>
            </div>
            {previewData.length > 0 && (
                <button onClick={handleConfirmImport} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center gap-2">
                    <i className="fas fa-sync"></i> Sincronizar Banco
                </button>
            )}
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-[9px] font-black uppercase text-slate-400 border-b">
                        <th className="p-4">ID (Limpo)</th>
                        <th className="p-4">Nome</th>
                        {activeTab === 'staff' && <th className="p-4">Vínculo de Setor</th>}
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
                                        item.sectorStatus === 'ok' ? (
                                            // MODO PREVIEW: VÍNCULO CORRETO
                                            <div className="flex items-center justify-between group">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]"><i className="fas fa-check"></i></div>
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-700 uppercase block">{item.linkedSectorName}</span>
                                                        {item.sectorNameRaw && item.sectorNameRaw !== item.linkedSectorName && (
                                                            <span className="text-[8px] text-slate-400 block strike">Excel: {item.sectorNameRaw}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleManualSectorChange(i, '')} className="w-6 h-6 rounded-lg bg-slate-50 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-pencil-alt text-[10px]"></i></button>
                                            </div>
                                        ) : (
                                            // MODO PREVIEW: ERRO DE VÍNCULO (Autocomplete para corrigir)
                                            <div className="space-y-1">
                                                <Autocomplete options={sectorOptions} value={item.sectorNameRaw || ''} onChange={(val) => handleManualSectorChange(i, val)} placeholder="⚠️ Vincular Setor..." required={false} className="w-full p-2 text-xs font-bold rounded-xl border-2 border-amber-300 bg-white" />
                                                <span className="text-[8px] font-bold text-rose-400">ID Excel: {item.sectorIdRaw || 'N/A'}</span>
                                            </div>
                                        )
                                    ) : (
                                        // MODO LEITURA (BANCO)
                                        <span className="text-[10px] font-bold uppercase text-slate-500">{getSectorNameFromDB(item.sectorId)}</span>
                                    )}
                                </td>
                            )}
                            {activeTab !== 'staff' && <td className="p-4 text-xs font-bold text-slate-400">{item.unit}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600"><i className="fas fa-chevron-left"></i></button>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600"><i className="fas fa-chevron-right"></i></button>
            </div>
        )}
      </section>
      <PGMaestro proData={proData} />
    </div>
  );
};

export default AdminLists;
