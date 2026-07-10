
import React, { useState, useMemo, memo } from 'react';
import { Unit } from '../../types';
import { usePro } from '../../contexts/ProContext';
import { useApp } from '../../hooks/useApp';
import { normalizeString } from '../../utils/formatters';
import { useDocumentGenerator } from '../../hooks/useDocumentGenerator';
import { usePGReportsData } from '../../hooks/usePGReportsData';
import { 
  generateSectorHtml, 
  generateActivityReportHtml, 
  generateNoLeaderReportHtml,
  generateLeadersReportHtml 
} from '../../utils/pgReportGenerators';

interface PGReportsProps {
  unit: Unit;
}

const PGReports = memo(({ unit }: PGReportsProps) => {
  const { proSectors, proStaff, proGroups, proHistoryRecords, proGroupMembers, proGroupProviderMembers } = usePro();
  const { config } = useApp();
  const { generatePdf, generateZipOfPdfs, isGenerating, progress } = useDocumentGenerator();
  
  // Filtros
  const [selectedTarget, setSelectedTarget] = useState<{type: 'sector' | 'pg' | 'leader', id: string, label: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterCritical, setFilterCritical] = useState(false);
  const [selectedPG, setSelectedPG] = useState<{ pgName: string, leaderName: string | null, members: any[] } | null>(null);

  const { reportData, activePGCount } = usePGReportsData({
    unit,
    startDate,
    endDate,
    searchTerm,
    selectedTarget,
    filterCritical
  });

  const searchOptions = useMemo(() => {
    const options: {type: 'sector' | 'pg' | 'leader', id: string, label: string}[] = [];
    proSectors.filter(s => s.unit === unit).forEach(s => options.push({type: 'sector', id: s.id, label: `Setor: ${s.name}`}));
    proGroups.filter(g => g.unit === unit).forEach(g => options.push({type: 'pg', id: g.id, label: `PG: ${g.name}`}));
    proStaff.filter(s => s.unit === unit).forEach(s => {
        const sector = proSectors.find(sec => sec.id === s.sectorId);
        options.push({type: 'leader', id: s.id, label: `Líder: ${s.name} (${sector?.name || 'Sem Setor'}) - ${s.whatsapp || 'Sem WhatsApp'}`});
    });
    return options;
  }, [proSectors, proGroups, proStaff, unit]);

  const filteredOptions = useMemo(() => {
    return searchOptions.filter(o => normalizeString(o.label).includes(normalizeString(searchTerm)));
  }, [searchOptions, searchTerm]);

  const reportHeaderInfo = useMemo(() => {
    const s = new Date(startDate + 'T12:00:00');
    const e = new Date(endDate + 'T12:00:00');
    const firstDay = new Date(s.getFullYear(), s.getMonth(), 1);
    const lastDay = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    const isFullMonth = s.getDate() === 1 && e.getTime() === lastDay.getTime();
    
    if (isFullMonth) {
      const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(s);
      const year = s.getFullYear();
      return {
        title: `Pequenos Grupos - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year}`,
        periodLabel: `Mês de Referência: ${monthName}/${year}`
      };
    }

    return {
      title: 'Pequenos Grupos',
      periodLabel: `Período: ${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`
    };
  }, [startDate, endDate]);

  const handlePrintAction = async () => {
    if (!searchTerm) {
      const pages = reportData.map(data => ({
        html: generateSectorHtml(data, config, reportHeaderInfo),
        name: `Relatorio_${data.sector.name}`
      }));
      await generateZipOfPdfs(pages, `Backup_Relatorios_PDF_${unit}_${startDate}`);
    } else {
      let combinedHtml = '';
      reportData.forEach(data => {
        combinedHtml += generateSectorHtml(data, config, reportHeaderInfo);
      });
      await generatePdf(combinedHtml, `Relatorio_${unit}.pdf`);
    }
  };

  const handlePrintActivityAction = async () => {
    const html = generateActivityReportHtml(reportData, proGroups.filter(g => g.unit === unit), proHistoryRecords, unit, startDate, reportHeaderInfo, config);
    await generatePdf(html, `Atividade_PGs_${unit}_${startDate}.pdf`);
  };

  const handlePrintNoLeaderAction = async () => {
    const html = generateNoLeaderReportHtml(proGroups, proGroupMembers, proGroupProviderMembers, unit, reportHeaderInfo, config);
    await generatePdf(html, `PGs_Ativos_Sem_Lideres_${unit}_${startDate}.pdf`);
  };

  const handlePrintLeadersAction = async () => {
    const html = generateLeadersReportHtml(proGroups, proStaff, proSectors, unit, reportHeaderInfo, config);
    await generatePdf(html, `Relacao_Lideres_PGs_${unit}_${startDate}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{reportHeaderInfo.title}</h2>
                  {(() => {
                    const s = new Date(startDate + 'T12:00:00');
                    const mStr = new Date(s.getFullYear(), s.getMonth(), 1).toISOString().split('T')[0];
                    const isClosedInDB = proHistoryRecords.some(r => r.month === mStr && r.unit === unit);
                    return isClosedInDB ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-200">
                        <i className="fas fa-check-circle mr-1"></i> Mês Encerrado
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-amber-200">
                        <i className="fas fa-lock-open mr-1"></i> Ciclo Aberto
                      </span>
                    );
                  })()}
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{reportHeaderInfo.periodLabel}</p>
                <p className="text-emerald-600 text-xs font-black uppercase mt-1">{activePGCount} PGs Ativos</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setFilterCritical(!filterCritical)} 
                className={`px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all flex items-center gap-3 ${filterCritical ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}
              >
                  <i className={`fas ${filterCritical ? 'fa-check-circle' : 'fa-bullseye'}`}></i>
                  {filterCritical ? 'Gargalos Ativados' : 'Meta < 80%'}
              </button>
              <button 
                onClick={handlePrintNoLeaderAction} 
                disabled={!!isGenerating}
                className="px-6 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                  {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-user-slash"></i>}
                  PGs Sem Líderes
              </button>
              <button 
                onClick={handlePrintActivityAction} 
                disabled={!!isGenerating}
                className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                  {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-list-check"></i>}
                  Atividade de PGs
              </button>
              <button 
                onClick={handlePrintLeadersAction} 
                disabled={!!isGenerating}
                className="px-6 py-4 bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                  {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-user-tie"></i>}
                  Relação de Líderes
              </button>
              <button 
                onClick={handlePrintAction} 
                disabled={!!isGenerating}
                className={`px-8 py-4 ${!searchTerm ? 'bg-amber-600' : 'bg-[#005a9c]'} text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50 min-w-[200px]`}
              >
                  {isGenerating ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    <i className={`fas ${!searchTerm ? 'fa-file-archive' : 'fa-file-pdf'}`}></i> 
                  )}
                  {isGenerating ? (progress || 'Processando...') : (!searchTerm ? 'Gerar Backup (ZIP)' : 'Imprimir PDF')}
              </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50 rounded-[2rem]">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início do Período</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-xl bg-white border-none font-bold text-xs shadow-sm" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim do Período</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-xl bg-white border-none font-bold text-xs shadow-sm" />
            </div>
            
            <div className="space-y-1 relative">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Filtrar por Setor, PG ou Líder</label>
                <div className="relative group">
                  <input 
                      type="text" 
                      placeholder="Buscar..." 
                      value={searchTerm}
                      autoComplete="off"
                      onChange={e => { 
                        setSearchTerm(e.target.value); 
                        setSelectedTarget(null); 
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                      className="w-full p-4 rounded-xl bg-white border-none font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500 pr-10" 
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => { setSearchTerm(''); setSelectedTarget(null); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      <i className="fas fa-times-circle"></i>
                    </button>
                  )}
                </div>
                {showDropdown && (searchTerm || filteredOptions.length > 0) && (
                    <div className="absolute z-50 w-full bg-white mt-1 rounded-xl shadow-2xl border border-slate-100 max-h-80 overflow-y-auto no-scrollbar animate-in slide-in-from-top-2 duration-200">
                        <div className="p-2">
                          {filteredOptions.map((o, idx) => {
                              const showHeader = idx === 0 || filteredOptions[idx-1].type !== o.type;
                              return (
                                <React.Fragment key={`${o.type}-${o.id}-${idx}`}>
                                  {showHeader && (
                                    <div className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 rounded-md mb-1 mt-1 ${idx > 0 ? 'mt-3' : ''}`}>
                                      {o.type === 'sector' ? 'Setores' : o.type === 'pg' ? 'Pequenos Grupos' : 'Líderes'}
                                    </div>
                                  )}
                                  <button 
                                      type="button"
                                      onMouseDown={(e) => { 
                                          e.preventDefault();
                                          setSelectedTarget(o); 
                                          setSearchTerm(o.label); 
                                          setShowDropdown(false);
                                      }} 
                                      className="w-full text-left p-3 text-[11px] font-bold text-slate-700 hover:bg-blue-600 hover:text-white rounded-xl transition-all mb-0.5 flex items-center justify-between group"
                                  >
                                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                                      <i className="fas fa-chevron-right text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                  </button>
                                </React.Fragment>
                              );
                          })}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {reportData.map(data => (
              <div key={data.sector.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h4 className="font-black text-slate-800 uppercase text-xs leading-tight mb-1">{data.sector.name}</h4>
                        <div className="flex items-center justify-between mb-1">
                           <p className="text-[9px] font-bold text-slate-400 uppercase">Cobertura: {Math.round(data.coverage)}%</p>
                           <span className={`w-2 h-2 rounded-full ${data.coverage >= 80 ? 'bg-emerald-500' : data.coverage >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}></span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                           <div 
                             className={`h-full rounded-full ${data.coverage >= 80 ? 'bg-emerald-500' : data.coverage >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} 
                             style={{ width: `${Math.min(data.coverage, 100)}%` }}
                           ></div>
                           <div className="absolute top-0 bottom-0 w-0.5 bg-slate-300 left-[80%]"></div>
                        </div>
                        
                        {/* Indicadores de Colaboradores e Matriculados */}
                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500 mt-3 p-1.5 bg-slate-50 rounded-xl">
                          <span>Colaboradores: <span className="text-slate-800 font-extrabold">{data.totalStaff}</span></span>
                          <span>Matriculados: <span className="text-blue-600 font-extrabold">{data.enrolledCount}</span></span>
                        </div>
                      </div>
                  </div>
                  <div className="flex gap-1 flex-wrap mt-2">
                      {data.pgs.map((pg: any) => {
                          if (!pg) return null;
                          return (
                            <button 
                              key={pg.id} 
                              type="button"
                              onClick={() => {
                                const pgInfo = data.enrolledByPG.find((item: any) => normalizeString(item.pgName) === normalizeString(pg.name)) || {
                                  pgName: pg.name,
                                  leaderName: pg.currentLeader || pg.leader || 'Sem Líder Definido',
                                  members: []
                                };
                                const sortedMembers = [...pgInfo.members].sort((a: any, b: any) => 
                                  String(a.name || '').localeCompare(String(b.name || ''))
                                );
                                setSelectedPG({
                                  ...pgInfo,
                                  members: sortedMembers
                                });
                              }}
                              className="text-[8px] font-black uppercase px-2 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition-all cursor-pointer flex items-center gap-1 group border border-blue-100/50"
                            >
                              <span>{pg.name}</span>
                              <i className="fas fa-eye text-[6px] opacity-40 group-hover:opacity-100"></i>
                            </button>
                          );
                      })}
                  </div>
              </div>
          ))}
      </div>

      {/* Modal de Detalhes do PG (Membros e Líder) */}
      {selectedPG && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200" id="pg-members-modal">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-50 flex items-start justify-between bg-slate-50/50">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded-md mb-2 inline-block">Membros do Pequeno Grupo</span>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">{selectedPG.pgName}</h3>
              </div>
              <button 
                onClick={() => setSelectedPG(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            {/* Leader Section */}
            <div className="p-6 py-4 bg-amber-50/40 border-b border-amber-50/80 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                <i className="fas fa-user-tie text-lg"></i>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Líder do PG</p>
                <p className="text-sm font-bold text-slate-800">{selectedPG.leaderName || 'Sem Líder Definido'}</p>
              </div>
            </div>

            {/* Members List */}
            <div className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-3 max-h-[40vh]">
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
                <span>Colaborador</span>
                <span>Matrícula/Cadastro</span>
              </div>

              {selectedPG.members.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <i className="fas fa-users-slash text-3xl mb-3 block"></i>
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhum colaborador matriculado</p>
                </div>
              ) : (
                selectedPG.members.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${member.type === 'provider' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col items-start">
                        <p className="text-xs font-bold text-slate-800">{member.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                            {member.type === 'provider' ? 'Prestador' : 'CLT/Staff'}
                          </span>
                          {member.isOtherSector && (
                            <span className="text-[7px] font-black uppercase tracking-widest text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <i className="fas fa-exclamation-circle"></i> {member.sectorName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {member.id}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400">
                Total: {selectedPG.members.length} {selectedPG.members.length === 1 ? 'Matriculado' : 'Matriculados'}
              </span>
              <button 
                onClick={() => setSelectedPG(null)}
                className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 transition-all shadow-md"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="text-center p-10 text-slate-400">
        <i className="fas fa-file-pdf text-4xl mb-4"></i>
        <p className="font-bold text-xs uppercase">
          {searchTerm ? 'O binário PDF real será gerado e aberto em nova aba para salvar ou imprimir.' : 'Sem filtros: O sistema gerará um pacote ZIP contendo PDFs individuais profissionais para cada setor.'}
        </p>
      </div>
    </div>
  );
});

PGReports.displayName = 'PGReports';

export default PGReports;
