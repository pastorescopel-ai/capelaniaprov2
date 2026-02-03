
import React, { useRef, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../../contexts/ToastContext';
import PGMaestro from './PGMaestro';
import { ProStaff, ProSector, ProGroup, Unit } from '../../types';
import { useApp } from '../../contexts/AppContext';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';

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

const AdminLists: React.FC<AdminListsProps> = ({ lists, setLists, onAutoSave, proData, onSavePro }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'staff' | 'sectors' | 'pgs'>('staff');
  const [activeUnit, setActiveUnit] = useState<'HAB' | 'HABA'>('HAB');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ isOpen: false, status: 'idle', title: '', message: '' });
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15; 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanExcelId = (val: any): string => {
      if (val === undefined || val === null) return "";
      let str = String(val).trim();
      if (str.toUpperCase().startsWith('HAB-') || str.toUpperCase().startsWith('HABA-')) {
          return str.split('-')[1].trim();
      }
      return str;
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

  const processFile = (file: File) => {
    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (allRows.length < 2) {
          showToast("Planilha vazia ou inválida.", "warning");
          return;
        }

        let dataStartRow = -1;
        let headers: string[] = [];

        for(let i = 0; i < Math.min(allRows.length, 50); i++){
            const row = allRows[i].map(c => normalizeHeader(String(c)));
            const hasKeywords = row.some(cell => 
                cell.includes('SETOR') || cell.includes('MATRICULA') || 
                cell.includes('CRACHA') || cell.includes('PG') || 
                cell.includes('GRUPO') || cell.includes('DEPARTAMENTO')
            );
            if(hasKeywords){ headers = row; dataStartRow = i + 1; break; }
        }
        
        if (dataStartRow === -1) {
            showToast("Não foi possível identificar as colunas.", "warning");
            setIsProcessingFile(false);
            return;
        }

        const dataRows = allRows.slice(dataStartRow);
        const seenIds = new Set<string>();
        
        if (activeTab === 'sectors') {
            const idxId = findColumnIndex(headers, ['ID SETOR', 'COD', 'ID', 'NUMERO']);
            const idxName = findColumnIndex(headers, ['SETOR', 'NOME', 'DEPTO']);
            const idxUnit = findColumnIndex(headers, ['UNIDADE', 'UNID', 'HOSPITAL']);

            const res = dataRows.map(row => {
                const rawId = cleanExcelId(row[idxId]);
                if(!rawId) return null;
                
                let unit = activeUnit as Unit;
                if (idxUnit !== -1 && row[idxUnit]) {
                   const uValue = String(row[idxUnit]).toUpperCase();
                   if (uValue.includes('HABA')) unit = Unit.HABA;
                   else if (uValue.includes('HAB')) unit = Unit.HAB;
                }

                // ID COMPOSTO PARA SETORES
                const compositeId = `${unit}-${rawId}`;
                if(seenIds.has(compositeId)) return null;
                seenIds.add(compositeId);

                return { id: compositeId, name: String(row[idxName]||'').trim(), unit };
            }).filter(Boolean);
            setPreviewData(res);
        } else if (activeTab === 'staff') {
            const idxId = findColumnIndex(headers, ['MATRICULA', 'MAT', 'CRACHA', 'REGISTRO', 'ID']);
            const idxName = findColumnIndex(headers, ['NOME', 'COLABORADOR', 'FUNCIONARIO']);
            const idxSec = findColumnIndex(headers, ['ID SETOR', 'CODIGO SETOR', 'COD DPTO', 'SETOR']);
            
            const res = dataRows.map(row => {
                const rawId = cleanExcelId(row[idxId]);
                if(!rawId) return null;

                const unit = activeUnit as Unit;
                const compositeId = `${unit}-${rawId}`;
                if(seenIds.has(compositeId)) return null;
                seenIds.add(compositeId);
                
                const rawSec = cleanExcelId(row[idxSec]);
                const sectorId = rawSec ? `${unit}-${rawSec}` : '';

                return { id: compositeId, name: String(row[idxName]||'').trim(), sectorId, unit };
            }).filter(Boolean);
            setPreviewData(res);
        } else {
            // ABA DE PGs - PROTEÇÃO CONTRA SOBREPOSIÇÃO
            const idxId = findColumnIndex(headers, ['ID PG', 'COD PG', 'N PG', 'NUMERO PG', 'ID', 'MAT']);
            const idxName = findColumnIndex(headers, ['NOME PG', 'PG', 'GRUPO', 'NOME GRUPO', 'NOME']);
            const idxUnit = findColumnIndex(headers, ['UNIDADE', 'UNID', 'HOSPITAL']);
            
            const res = dataRows.map(row => {
                const rawName = String(row[idxName] || '').trim();
                if(!rawName) return null;
                
                let unit = activeUnit as Unit;
                if (idxUnit !== -1 && row[idxUnit]) {
                   const uValue = String(row[idxUnit]).toUpperCase();
                   if (uValue.includes('HABA')) unit = Unit.HABA;
                   else if (uValue.includes('HAB')) unit = Unit.HAB;
                }

                let rawId = cleanExcelId(row[idxId]);
                if(!rawId) rawId = rawName.substring(0,5).replace(/\s/g, '').toUpperCase();

                // CRIAÇÃO DO ID COMPOSTO (UNIDADE-ID)
                // Isso garante que o PG 1 do HAB seja diferente do PG 1 do HABA
                const compositeId = `${unit}-${rawId}`;

                if(seenIds.has(compositeId)) return null;
                seenIds.add(compositeId);
                
                return { id: compositeId, name: rawName, unit };
            }).filter(Boolean);
            setPreviewData(res);
        }
        
        setCurrentPage(1);
        if (seenIds.size > 0) {
            showToast(`${seenIds.size} registros identificados. IDs agora são vinculados à unidade.`, "success");
        }
      } catch (err) {
        showToast("Erro ao processar Excel.", "warning");
      } finally {
        setIsProcessingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!proData || !onSavePro) return;
    setSyncState({ isOpen: true, status: 'processing', title: 'Sincronizando', message: 'Consolidando base de dados única...' });
    try {
        let updatedSectors = [...proData.sectors];
        let updatedStaff = [...proData.staff];
        let updatedGroups = [...proData.groups];
        
        if (activeTab === 'sectors') {
            const newIds = new Set(previewData.map(i => i.id));
            updatedSectors = [...updatedSectors.filter(s => !newIds.has(s.id)), ...previewData];
        } else if (activeTab === 'staff') {
            const newIds = new Set(previewData.map(i => i.id));
            updatedStaff = [...updatedStaff.filter(s => !newIds.has(s.id)), ...previewData];
        } else {
            const newIds = new Set(previewData.map(i => i.id));
            updatedGroups = [...updatedGroups.filter(s => !newIds.has(s.id)), ...previewData];
        }

        const legacyUpdate = {
            ...lists,
            staffHAB: updatedStaff.filter(s => s.unit === 'HAB').map(s => `${s.id.split('-')[1] || s.id} | ${s.name}`).join('\n'),
            staffHABA: updatedStaff.filter(s => s.unit === 'HABA').map(s => `${s.id.split('-')[1] || s.id} | ${s.name}`).join('\n'),
            sectorsHAB: updatedSectors.filter(s => s.unit === 'HAB').map(s => `${s.id.split('-')[1] || s.id} - ${s.name}`).join('\n'),
            sectorsHABA: updatedSectors.filter(s => s.unit === 'HABA').map(s => `${s.id.split('-')[1] || s.id} - ${s.name}`).join('\n'),
            groupsHAB: updatedGroups.filter(s => s.unit === 'HAB').map(g => `${g.name}`).join('\n'),
            groupsHABA: updatedGroups.filter(s => s.unit === 'HABA').map(g => `${g.name}`).join('\n')
        };

        await onSavePro(updatedStaff, updatedSectors, updatedGroups, legacyUpdate);
        setSyncState({ isOpen: true, status: 'success', title: 'Concluído', message: 'Dados importados com isolamento por unidade.' });
        setPreviewData([]);
    } catch (e: any) {
        setSyncState({ isOpen: true, status: 'error', title: 'Erro', message: e.message });
    }
  };

  const displayData = useMemo(() => {
      let source: any[] = [];
      if (previewData.length > 0) source = previewData;
      else if (proData) {
          if (activeTab === 'staff') source = proData.staff.filter(s => s.unit === activeUnit);
          else if (activeTab === 'sectors') source = proData.sectors.filter(s => s.unit === activeUnit);
          else source = proData.groups.filter(s => s.unit === activeUnit);
      }
      return source.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [previewData, proData, activeTab, activeUnit]);

  const totalPages = Math.ceil(displayData.length / ITEMS_PER_PAGE);
  const currentItems = displayData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-12">
      <SyncModal isOpen={syncState.isOpen} status={syncState.status} title={syncState.title} message={syncState.message} errorDetails={syncState.error} onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} />
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Importação Isolada por Unidade</h2>
          <div className="flex bg-slate-50 p-1.5 rounded-xl gap-2">
             {['HAB', 'HABA'].map(u => (<button key={u} onClick={() => { setActiveUnit(u as any); setPreviewData([]); setCurrentPage(1); }} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeUnit === u ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>Unidade {u}</button>))}
          </div>
        </div>
        <div className="flex gap-4 border-b">
            {[{id:'sectors', l:'Setores', i:'fa-map-marker-alt'}, {id:'staff', l:'Colaboradores', i:'fa-user-md'}, {id:'pgs', l:'PGs', i:'fa-users'}].map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setPreviewData([]); setCurrentPage(1); }} className={`pb-4 px-4 text-xs font-black uppercase flex items-center gap-2 border-b-4 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-300'}`}><i className={`fas ${tab.i}`}></i> {tab.l}</button>
            ))}
        </div>
        <div className="bg-slate-50 p-6 rounded-[2rem] flex justify-between items-center">
            <div className="flex items-center gap-4">
                <input type="file" ref={fileInputRef} accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
                <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg"><i className="fas fa-file-excel"></i> Carregar Planilha</button>
                <span className="text-xs font-bold text-slate-400">{previewData.length > 0 ? `${previewData.length} identificados` : `Banco: ${displayData.length}`}</span>
            </div>
            {previewData.length > 0 && <button onClick={handleConfirmImport} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-emerald-200">Consolidar Dados</button>}
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead><tr className="text-[9px] font-black uppercase text-slate-400 border-b"><th className="p-4">ID de Sistema (Único)</th><th className="p-4">Nome do Registro</th>{activeTab === 'staff' && <th className="p-4">Setor</th>}</tr></thead>
                <tbody className="divide-y">
                    {currentItems.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                            <td className="p-4 text-xs font-mono font-bold text-blue-600">{item.id}</td>
                            <td className="p-4 text-sm font-bold text-slate-700">{item.name}</td>
                            {activeTab === 'staff' && (
                                <td className="p-4 text-[10px] font-bold text-slate-500 uppercase">
                                    {proData?.sectors.find(s => s.id === item.sectorId)?.name || item.sectorId}
                                </td>
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
