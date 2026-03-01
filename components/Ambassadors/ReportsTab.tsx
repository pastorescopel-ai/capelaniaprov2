import React from 'react';
import { Filter, Printer, FileText, Calendar, Users } from 'lucide-react';
import { Unit, Ambassador, ProSector } from '../../types';

interface ReportsTabProps {
  currentUnit: Unit;
  ambassadors: Ambassador[];
  proSectors: ProSector[];
  stats: any;
  reportStartDate: string;
  setReportStartDate: (val: string) => void;
  reportEndDate: string;
  setReportEndDate: (val: string) => void;
  reportSectorId: string;
  setReportSectorId: (val: string) => void;
  reportSortOrder: 'alpha' | 'percent';
  setReportSortOrder: (val: 'alpha' | 'percent') => void;
  handleGeneratePDF: (mode: 'sector' | 'full') => void;
  isGenerating: string | false;
}

const ReportsTab: React.FC<ReportsTabProps> = ({
  currentUnit,
  ambassadors,
  proSectors,
  stats,
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  reportSectorId,
  setReportSectorId,
  reportSortOrder,
  setReportSortOrder,
  handleGeneratePDF,
  isGenerating
}) => {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
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

      <div className="space-y-4">
        <div className="flex items-center justify-between px-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Posição por Setor</h4>
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">
            {currentUnit} • {reportSortOrder === 'alpha' ? 'Ordem Alfabética' : 'Maior Adesão'}
          </span>
        </div>

        <div className="grid gap-4">
          {Object.values(stats[currentUnit].sectors)
            .filter((s: any) => reportSectorId === 'all' || String(s.id) === String(reportSectorId))
            .sort((a: any, b: any) => {
              if (reportSortOrder === 'alpha') return a.name.localeCompare(b.name);
              return b.percent - a.percent;
            })
            .map((sector: any) => (
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-4 border-t border-slate-50">
                  {ambassadors
                    .filter(a => {
                      const matchesUnit = a.unit === currentUnit;
                      const matchesSector = String(a.sectorId) === String(sector.id);
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
  );
};

export default ReportsTab;
