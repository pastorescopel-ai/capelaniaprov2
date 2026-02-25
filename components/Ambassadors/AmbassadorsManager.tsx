import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Unit, Ambassador } from '../../types';
import { normalizeString } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { Upload, Download, Users, CheckCircle, AlertCircle, Search, Trash2, FileText, Printer, Filter, Calendar } from 'lucide-react';
import { generateAmbassadorReportHtml } from '../../utils/ambassadorPdf';
import { useDocumentGenerator } from '../../hooks/useDocumentGenerator';

const AmbassadorsManager: React.FC = () => {
  const { proSectors, proStaff, config } = useApp();
  const { showToast } = useToast();
  const { generatePdf, isGenerating } = useDocumentGenerator();
  
  // Estados de Navegação e Filtro Global
  const [activeTab, setActiveTab] = useState<'dashboard' | 'import' | 'list' | 'reports'>('dashboard');
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  
  // Dados
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Importação
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtros de Relatório
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportSectorId, setReportSectorId] = useState<string>('all');
  const [reportSortOrder, setReportSortOrder] = useState<'alpha' | 'percent'>('alpha');

  // Carregar embaixadores ao montar
  React.useEffect(() => {
    fetchAmbassadors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAmbassadors = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('ambassadors')
      .select('*');
    
    if (error) {
      showToast('Erro ao carregar embaixadores', 'error');
    } else {
      const formatted: Ambassador[] = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        registrationId: d.registration_id,
        email: d.email,
        sectorId: d.sector_id,
        unit: d.unit,
        completionDate: d.completion_date
      }));
      setAmbassadors(formatted);
    }
    setIsLoading(false);
  };

  // --- LÓGICA DO DASHBOARD ---
  const stats = useMemo(() => {
    const dataByUnit = {
      [Unit.HAB]: { total: 0, sectors: {} as Record<string, { name: string, count: number, totalStaff: number, percent: number }> },
      [Unit.HABA]: { total: 0, sectors: {} as Record<string, { name: string, count: number, totalStaff: number, percent: number }> }
    };

    proSectors.forEach(sector => {
      if (!dataByUnit[sector.unit]) return;
      const staffInSector = proStaff.filter(s => s.sectorId === sector.id && s.active !== false).length;
      dataByUnit[sector.unit].sectors[sector.id] = {
        name: sector.name,
        count: 0,
        totalStaff: staffInSector || 1,
        percent: 0
      };
    });

    ambassadors.forEach(amb => {
      if (amb.sectorId && dataByUnit[amb.unit]?.sectors[amb.sectorId]) {
        dataByUnit[amb.unit].sectors[amb.sectorId].count++;
        dataByUnit[amb.unit].total++;
      }
    });

    Object.keys(dataByUnit).forEach(u => {
      const unit = u as Unit;
      Object.values(dataByUnit[unit].sectors).forEach(s => {
        s.percent = (s.count / s.totalStaff) * 100;
      });
    });

    return dataByUnit;
  }, [ambassadors, proSectors, proStaff]);

  const getChartData = (unit: Unit) => {
    return Object.values(stats[unit].sectors)
      .sort((a, b) => b.percent - a.percent)
      .filter(s => s.count > 0 || s.totalStaff > 5)
      .slice(0, 15);
  };

  // --- LÓGICA DE IMPORTAÇÃO ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setImportPreview(data);
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async () => {
    setIsLoading(true);
    try {
      if (importPreview.length === 0) throw new Error("A planilha está vazia.");

      const headers = Object.keys(importPreview[0]).map(h => normalizeString(h));
      const requiredFields = ['data', 'matricula', 'nome', 'id_setor', 'setor'];
      const forbiddenFields = ['pg', 'pequenos grupos', 'pequeno grupo'];

      if (headers.some(h => forbiddenFields.some(f => h.includes(f)))) {
        throw new Error("A planilha contém colunas proibidas (PG ou Pequenos Grupos).");
      }

      const missingFields = requiredFields.filter(req => !headers.some(h => h.includes(req)));
      if (missingFields.length > 0) {
         throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}.`);
      }

      const upsertMap = new Map<string, any>();

      for (const row of importPreview) {
        const rowKeys = Object.keys(row);
        const getVal = (keyPart: string) => {
          const key = rowKeys.find(k => normalizeString(k).includes(keyPart));
          return key ? row[key] : null;
        };

        const rawDate = getVal('data');
        const matricula = getVal('matricula');
        const nome = getVal('nome');
        const idSetorExcel = getVal('id_setor');

        if (!matricula || !nome) continue;

        const regId = String(matricula).trim();

        let completionDate = new Date().toISOString();
        if (rawDate) {
            if (typeof rawDate === 'number') {
                const date = new Date(Math.round((rawDate - 25569)*86400*1000));
                completionDate = date.toISOString();
            } else {
                const parsed = new Date(rawDate);
                if (!isNaN(parsed.getTime())) completionDate = parsed.toISOString();
            }
        }

        let unit = Unit.HAB;
        let sectorIdMatch = null;
        
        // BUSCA POR ID: Compara o ID da planilha com o ID (bigint/string) do pro_sectors
        const sectorMatch = proSectors.find(s => String(s.id) === String(idSetorExcel));

        if (sectorMatch) {
            unit = sectorMatch.unit;
            sectorIdMatch = sectorMatch.id;
        }

        // LÓGICA LAST-WIN: Se a matrícula já existir no mapa, ela será sobrescrita pela última ocorrência
        upsertMap.set(regId, {
          registration_id: regId,
          name: String(nome).trim(),
          sector_id: sectorIdMatch, 
          unit: unit,
          completion_date: completionDate,
          updated_at: new Date().toISOString()
        });
      }

      const toUpsert = Array.from(upsertMap.values());

      if (toUpsert.length > 0) {
        const { error } = await supabase.from('ambassadors').upsert(toUpsert, { onConflict: 'registration_id' });
        if (error) throw error;
        showToast(`${toUpsert.length} registros processados!`, 'success');
        setImportPreview([]);
        fetchAmbassadors();
        setActiveTab('dashboard');
      } else {
        showToast('Nenhum dado válido encontrado.', 'warning');
      }
    } catch (error: any) {
      showToast(`Erro: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAmbassador = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este embaixador?')) return;
    const { error } = await supabase.from('ambassadors').delete().eq('id', id);
    if (error) showToast('Erro ao excluir', 'error');
    else {
      showToast('Excluído com sucesso', 'success');
      setAmbassadors(prev => prev.filter(a => a.id !== id));
    }
  };

  // --- GERAÇÃO DE PDF ---
  const handleGeneratePDF = async (mode: 'sector' | 'full') => {
    const html = generateAmbassadorReportHtml(ambassadors, {
      mode,
      unit: currentUnit,
      startDate: reportStartDate,
      endDate: reportEndDate,
      sectorId: reportSectorId,
      sortOrder: reportSortOrder,
      sectors: proSectors,
      stats,
      config
    });

    if (html) {
      await generatePdf(html, `Relatorio_Embaixadores_${currentUnit}_${mode}`);
    } else {
      showToast('Nenhum dado encontrado para os filtros selecionados.', 'warning');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
      
      {/* Cabeçalho Estilo Gestão de PGs */}
      <div className="sticky top-[-1rem] md:top-[-2rem] z-[100] -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-[#f1f5f9]/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto space-y-6">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-lg md:text-xl shadow-lg shadow-blue-900/20">
                <Users />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">
                  Embaixadores da Esperança
                </h1>
                <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mt-1 hidden sm:block">
                  Gestão do projeto de capacitação e engajamento
                </p>
              </div>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl md:rounded-2xl border border-slate-200 self-end md:self-auto">
              {[Unit.HAB, Unit.HABA].map(u => (
                <button 
                  key={u} 
                  onClick={() => setCurrentUnit(u)} 
                  className={`px-6 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl font-black text-[9px] md:text-[10px] uppercase transition-all ${
                    currentUnit === u 
                      ? 'bg-blue-600 text-white shadow-lg scale-105' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Unidade {u}
                </button>
              ))}
            </div>
          </header>

          {/* Navegação de Abas (Scrollable) */}
          <nav className="flex overflow-x-auto no-scrollbar gap-2">
            {[
              { id: 'dashboard', label: 'Visão Geral', icon: <Users size={16} /> },
              { id: 'import', label: 'Importação', icon: <Upload size={16} /> },
              { id: 'list', label: 'Lista Completa', icon: <FileText size={16} /> },
              { id: 'reports', label: 'Relatórios', icon: <Printer size={16} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-white border-blue-600 text-blue-600 shadow-md scale-105' 
                    : 'bg-white/50 border-transparent text-slate-400 hover:bg-white hover:text-slate-600'
                }`}
              >
                {tab.icon}
                <span className="text-[9px] md:text-xs font-black uppercase tracking-wider">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto min-h-[500px]">
        <main className="animate-in fade-in slide-in-from-top-2 duration-500">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Conteúdo do Dashboard (Mantido) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Users size={120} />
                  </div>
                  <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight mb-2">Total de Embaixadores ({currentUnit})</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-blue-600">{stats[currentUnit].total}</span>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Colaboradores Capacitados</span>
                  </div>
                  <div className="mt-8">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Top 5 Setores (Engajamento)</h4>
                    <div className="space-y-3">
                      {getChartData(currentUnit).slice(0, 5).map((s, i) => (
                        <div key={s.name} className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-400 w-4">{i+1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-bold text-slate-700">{s.name}</span>
                              <span className="font-mono text-slate-500">{s.percent.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${s.percent}%` }}></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex flex-col">
                  <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight mb-4">Desempenho por Setor</h3>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getChartData(currentUnit).slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 9}} interval={0} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          cursor={{ fill: '#f8fafc' }}
                        />
                        <Bar dataKey="percent" radius={[0, 4, 4, 0]} barSize={12}>
                          {getChartData(currentUnit).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.percent >= 5 ? '#22c55e' : '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <div className="max-w-2xl mx-auto text-center py-12">
                <div className="mb-8">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Upload size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Importar Dados ({currentUnit})</h3>
                  <p className="text-slate-500 mt-2 font-medium">Carregue a planilha do Google Forms (.xlsx ou .csv)</p>
                </div>

                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />

                {!importPreview.length ? (
                  <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl hover:shadow-blue-200 hover:-translate-y-1 flex items-center gap-3 mx-auto">
                    <Upload size={18} /> Selecionar Arquivo
                  </button>
                ) : (
                  <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 text-left">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-black text-slate-700 uppercase tracking-tight">Pré-visualização</h4>
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{importPreview.length} linhas</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto text-xs font-mono text-slate-500 mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-inner">
                      <pre>{JSON.stringify(importPreview[0], null, 2)}</pre>
                      <p className="mt-2 text-center italic opacity-50">... e mais {importPreview.length - 1} linhas</p>
                    </div>
                    <div className="flex gap-4 justify-center">
                      <button onClick={() => setImportPreview([])} className="px-6 py-3 text-slate-500 hover:bg-slate-200 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors">Cancelar</button>
                      <button onClick={processImport} disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-colors shadow-lg flex items-center gap-2">
                        {isLoading ? 'Processando...' : 'Confirmar Importação'}
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="mt-12 text-left bg-amber-50 p-6 rounded-2xl border border-amber-100">
                  <h5 className="font-black text-amber-800 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertCircle size={14} /> Regras de Importação
                  </h5>
                  <ul className="text-xs text-amber-700 space-y-2 list-disc pl-4 font-medium">
                    <li>Colunas obrigatórias: <strong>Data, Matricula, Nome, Id_setor, Setor</strong>.</li>
                    <li>O sistema atualizará automaticamente registros existentes com a mesma matrícula.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'list' && (
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-700 uppercase tracking-tight">Lista de Embaixadores ({currentUnit})</h3>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total: {ambassadors.filter(a => a.unit === currentUnit).length}</div>
               </div>
               
               <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50">
                    <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="p-4">Matrícula</th>
                      <th className="p-4">Nome</th>
                      <th className="p-4">Setor</th>
                      <th className="p-4">Data</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-600 divide-y divide-slate-50">
                    {ambassadors.filter(a => a.unit === currentUnit).sort((a, b) => a.name.localeCompare(b.name)).map(amb => {
                      const sectorName = proSectors.find(s => s.id === amb.sectorId)?.name || 'Não identificado';
                      return (
                        <tr key={amb.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-4 font-mono text-xs text-slate-400">{amb.registrationId || '-'}</td>
                          <td className="p-4 font-bold text-slate-700">{amb.name}</td>
                          <td className="p-4 text-xs">{sectorName}</td>
                          <td className="p-4 text-xs font-mono">{new Date(amb.completionDate).toLocaleDateString()}</td>
                          <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => deleteAmbassador(amb.id)} className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              
              {/* Filtros e Controles */}
              <div className="bg-slate-50 p-6 md:p-8 rounded-[2.5rem] border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                  <div>
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      <Filter size={16} className="text-blue-600" /> Parâmetros do Relatório
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">Configure os filtros para gerar o documento</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleGeneratePDF('sector')}
                      disabled={!!isGenerating}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGenerating === 'pdf' ? <i className="fas fa-circle-notch fa-spin"></i> : <Printer size={14} />}
                      Imprimir por Setor
                    </button>
                    <button 
                      onClick={() => handleGeneratePDF('full')}
                      disabled={!!isGenerating}
                      className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGenerating === 'pdf' ? <i className="fas fa-circle-notch fa-spin"></i> : <FileText size={14} />}
                      Impressão Completa
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Data Início</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="date" 
                        value={reportStartDate}
                        onChange={e => setReportStartDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Data Fim</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="date" 
                        value={reportEndDate}
                        onChange={e => setReportEndDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Setor</label>
                    <select 
                      value={reportSectorId}
                      onChange={e => setReportSectorId(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white appearance-none"
                    >
                      <option value="all">TODOS OS SETORES</option>
                      {proSectors
                        .filter(s => s.unit === currentUnit)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                        ))
                      }
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Ordenação</label>
                    <select 
                      value={reportSortOrder}
                      onChange={e => setReportSortOrder(e.target.value as any)}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white appearance-none"
                    >
                      <option value="alpha">ALFABÉTICA (SETOR)</option>
                      <option value="percent">PERCENTUAL DE ADESÃO</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Listagem de Resultados */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Posição por Setor</h4>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">
                    {currentUnit} • {reportSortOrder === 'alpha' ? 'Ordem Alfabética' : 'Maior Adesão'}
                  </span>
                </div>

                <div className="grid gap-4">
                  {Object.values(stats[currentUnit].sectors)
                    .filter(s => reportSectorId === 'all' || proSectors.find(ps => ps.name === s.name)?.id === reportSectorId)
                    .sort((a, b) => {
                      if (reportSortOrder === 'alpha') return a.name.localeCompare(b.name);
                      return b.percent - a.percent;
                    })
                    .map(sector => (
                      <div key={sector.name} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                          <div>
                            <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight">{sector.name}</h4>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                <Users size={10} /> {sector.count} Embaixadores
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                <Users size={10} className="opacity-50" /> {sector.totalStaff} Colaboradores
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="flex-1 md:w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${sector.percent >= 5 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                style={{ width: `${Math.min(sector.percent, 100)}%` }}
                              ></div>
                            </div>
                            <span className={`text-sm font-black w-14 text-right ${sector.percent >= 5 ? 'text-emerald-600' : 'text-blue-600'}`}>
                              {sector.percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Lista de Nomes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-4 border-t border-slate-50">
                          {ambassadors
                            .filter(a => {
                              const matchesUnit = a.unit === currentUnit;
                              const matchesSector = a.sectorId && proSectors.find(s => s.id === a.sectorId)?.name === sector.name;
                              const matchesStart = reportStartDate ? new Date(a.completionDate) >= new Date(reportStartDate) : true;
                              const matchesEnd = reportEndDate ? new Date(a.completionDate) <= new Date(reportEndDate) : true;
                              return matchesUnit && matchesSector && matchesStart && matchesEnd;
                            })
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(amb => (
                              <div key={amb.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className={`w-1.5 h-1.5 rounded-full ${sector.percent >= 5 ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>
                                <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{amb.name}</span>
                              </div>
                            ))}
                          {sector.count === 0 && (
                            <div className="col-span-full py-4 text-center">
                              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest italic">Nenhum embaixador capacitado neste setor</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AmbassadorsManager;
