
import React from 'react';

interface GapRadarProps {
  coverageGaps: any[];
  emptyPGs: any[];
  onSelectSector: (name: string) => void;
  onSelectPG: (name: string) => void;
}

const GapRadar: React.FC<GapRadarProps> = ({ coverageGaps, emptyPGs, onSelectSector, onSelectPG }) => {
  return (
    <div className="pt-8 border-t border-slate-200">
      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight px-4 mb-6 flex items-center gap-3">
        <i className="fas fa-radar text-blue-600"></i> Radar de Vacância Profissional
      </h3>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Radar 1: Saúde de Cobertura por Setor */}
        <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-100">
              <i className="fas fa-traffic-light"></i>
            </div>
            <div>
              <h4 className="font-black text-slate-800 uppercase text-sm tracking-widest">Saúde da Cobertura</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{coverageGaps.length} setores com vacância</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {coverageGaps.length > 0 ? coverageGaps.map(gap => (
              <button 
                key={gap.id} 
                onClick={() => onSelectSector(gap.name)}
                className={`px-4 py-2 bg-white text-[10px] font-black uppercase rounded-xl border shadow-sm transition-all active:scale-95 flex items-center gap-2
                  ${gap.color === 'rose' ? 'text-rose-600 border-rose-100 hover:bg-rose-500 hover:text-white' : 
                    gap.color === 'amber' ? 'text-amber-600 border-amber-100 hover:bg-amber-500 hover:text-white' : 
                    'text-emerald-600 border-emerald-100 hover:bg-emerald-500 hover:text-white'}
                `}
              >
                <span className={`w-2 h-2 rounded-full ${
                  gap.color === 'rose' ? 'bg-rose-500' : 
                  gap.color === 'amber' ? 'bg-amber-500' : 
                  'bg-emerald-500'
                }`}></span>
                {gap.name} ({Math.round(gap.percentage)}%)
              </button>
            )) : (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                <i className="fas fa-check-circle"></i>
                <span className="text-[10px] font-black uppercase">Meta 100% batida em todos os setores!</span>
              </div>
            )}
          </div>
          {coverageGaps.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span className="text-[8px] font-black uppercase text-slate-400">Crítico (0-30%)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span><span className="text-[8px] font-black uppercase text-slate-400">Alerta (31-79%)</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span className="text-[8px] font-black uppercase text-slate-400">Sucesso (80%+)</span></div>
              </div>
          )}
        </div>

        {/* Radar 2: PGs em "Limbo" (Fantasmas) */}
        <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-100">
              <i className="fas fa-ghost"></i>
            </div>
            <div>
              <h4 className="font-black text-slate-800 uppercase text-sm tracking-widest">PGs "Fantasmas"</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{emptyPGs.length} grupos vazios detectados</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {emptyPGs.length > 0 ? emptyPGs.map(pg => (
              <button 
                key={pg.id} 
                onClick={() => onSelectPG(pg.name)}
                className="px-4 py-2 bg-white text-slate-400 text-[10px] font-black uppercase rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 hover:text-blue-600 transition-all active:scale-95 flex items-center gap-2"
              >
                <i className="fas fa-user-slash text-[8px]"></i>
                {pg.name}
              </button>
            )) : (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                <i className="fas fa-check-circle"></i>
                <span className="text-[10px] font-black uppercase">Todos os PGs têm membros!</span>
              </div>
            )}
          </div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest italic pt-2">
            * Clique em um grupo para começar a matricular membros nele.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GapRadar;
