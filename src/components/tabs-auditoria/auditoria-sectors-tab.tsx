import React from 'react';
import Autocomplete from '../Shared/Autocomplete';

interface AuditoriaSectorsTabProps {
  sectorOrphans: any[];
  targetMap: Record<string, string>;
  setTargetMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  officialSectorOptions: any[];
  handleHealSector: (orphan: any) => void;
  isProcessing: boolean;
}

const AuditoriaSectorsTab: React.FC<AuditoriaSectorsTabProps> = ({
  sectorOrphans,
  targetMap,
  setTargetMap,
  officialSectorOptions,
  handleHealSector,
  isProcessing
}) => {
  return (
    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <div className="flex flex-col">
          <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Fila de Tratamento: Setores</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Correção de inconsistências por ID ou Nome</p>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase">
          <i className="fas fa-magic mr-1"></i> Sincronização de Integridade
        </span>
      </div>
      <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto custom-scrollbar pb-72">
        {sectorOrphans.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-4xl animate-bounce">
              <i className="fas fa-check-double"></i>
            </div>
            <p className="text-slate-400 font-bold uppercase text-sm tracking-widest">Nenhum registro pendente!</p>
          </div>
        ) : (
          sectorOrphans.map((orphan, index) => {
            const isIdOrphan = orphan.type === 'id';
            const displayValue = orphan.display;
            return (
              <div key={index} className="p-6 flex flex-col xl:flex-row items-center gap-6 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 w-full xl:w-1/3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase ${isIdOrphan ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      <i className={`fas ${isIdOrphan ? 'fa-id-card' : 'fa-exclamation-triangle'}`}></i> 
                      {isIdOrphan ? 'ID Inexistente' : 'Nome Desconhecido'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{orphan.count} registros</span>
                  </div>
                  <div className="font-black text-slate-800 uppercase text-lg leading-tight">{displayValue}</div>
                  {isIdOrphan && <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Vincule este ID antigo a um setor atual</div>}
                </div>

                <div className="hidden xl:block text-slate-300">
                  <i className="fas fa-arrow-right text-xl transition-colors group-hover:text-blue-400"></i>
                </div>

                <div className="flex-1 w-full xl:w-2/3 flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <Autocomplete
                      options={officialSectorOptions}
                      value={targetMap[displayValue] || ''}
                      onChange={(val) => setTargetMap(prev => ({ ...prev, [displayValue]: val }))}
                      onSelectOption={(label) => setTargetMap(prev => ({ ...prev, [displayValue]: label }))}
                      placeholder="Vincular ao Setor Oficial..."
                      className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all focus:border-blue-500 group-hover:border-blue-200"
                    />
                  </div>
                  <button
                    onClick={() => handleHealSector(orphan)}
                    disabled={!targetMap[displayValue] || isProcessing}
                    className="px-8 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap bg-blue-500 hover:bg-blue-600"
                  >
                    {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-link"></i>}
                    <span>Vincular</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AuditoriaSectorsTab;
