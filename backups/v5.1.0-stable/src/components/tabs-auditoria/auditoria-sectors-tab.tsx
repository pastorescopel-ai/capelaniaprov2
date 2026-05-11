import React from 'react';
import Autocomplete from '../Shared/Autocomplete';

interface AuditoriaSectorsTabProps {
  sectorOrphans: any[];
  targetMap: Record<string, string>;
  setTargetMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  officialSectorOptions: any[];
  handleHealSector: (orphan: any) => void;
  handleDeleteSectorOrphan: (orphan: any) => void;
  handleMoveSectorUnit: (orphan: any, unit: string) => void;
  isProcessing: boolean;
}

const AuditoriaSectorsTab: React.FC<AuditoriaSectorsTabProps> = ({
  sectorOrphans,
  targetMap,
  setTargetMap,
  officialSectorOptions,
  handleHealSector,
  handleDeleteSectorOrphan,
  handleMoveSectorUnit,
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
            const isMismatch = orphan.type === 'mismatch';
            const displayValue = orphan.display;
            const originalValue = orphan.originalValue;
            
            return (
              <div key={index} className="p-6 flex flex-col xl:flex-row items-center gap-6 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 w-full xl:w-1/3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                      isIdOrphan ? 'bg-red-100 text-red-700' : 
                      isMismatch ? 'bg-indigo-100 text-indigo-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      <i className={`fas ${
                        isIdOrphan ? 'fa-id-card' : 
                        isMismatch ? 'fa-sync-alt' :
                        'fa-exclamation-triangle'
                      }`}></i> 
                      {isIdOrphan ? 'ID Inexistente' : isMismatch ? 'Ajuste de Nome' : 'Nome Desconhecido'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{orphan.count} registros</span>
                  </div>
                  <div className="font-black text-slate-800 uppercase text-lg leading-tight">
                    {displayValue} {originalValue !== 'N/A' && <span className="text-slate-400 font-bold ml-2 text-sm">({isIdOrphan ? `Nome: ${originalValue}` : `ID: ${originalValue}`})</span>}
                  </div>
                  
                  {isMismatch && (
                    <div className="mt-2 p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                      <div className="text-[10px] font-black text-indigo-400 uppercase leading-none mb-1">Novo Nome Sugerido</div>
                      <div className="text-xs font-bold text-indigo-700 uppercase italic">
                        <i className="fas fa-magic mr-1"></i> {orphan.proposedName}
                      </div>
                    </div>
                  )}

                  {isIdOrphan && <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Vincule este ID antigo a um setor atual</div>}
                  
                  <button 
                    onClick={() => handleDeleteSectorOrphan(orphan)}
                    disabled={isProcessing}
                    className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase text-rose-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                    title="Excluir todos os registros vinculados a este setor incorreto"
                  >
                    <i className="fas fa-trash-alt"></i>
                    Apagar Registros Incorretos
                  </button>
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

                {isIdOrphan && (
                  <div className="w-full xl:w-auto flex flex-col md:flex-row gap-2 xl:border-l xl:pl-6 border-slate-100">
                    <div className="text-[8px] font-black text-slate-400 uppercase mb-1 md:hidden">Corrigir Unidade do Setor</div>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => handleMoveSectorUnit(orphan, 'HAB')}
                         disabled={isProcessing}
                         className="flex-1 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[8px] font-black uppercase hover:bg-blue-500 hover:text-white transition-all shadow-sm border border-transparent whitespace-nowrap"
                         title="Este ID pertence ao HAB"
                       >
                         Mover p/ HAB
                       </button>
                       <button 
                         onClick={() => handleMoveSectorUnit(orphan, 'HABA')}
                         disabled={isProcessing}
                         className="flex-1 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[8px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-transparent whitespace-nowrap"
                         title="Este ID pertence ao HABA"
                       >
                         Mover p/ HABA
                       </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AuditoriaSectorsTab;
