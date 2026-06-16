import React from 'react';
import Autocomplete from '../Shared/Autocomplete';
import { PersonType } from '../../hooks/useDataHealer';

interface AuditoriaPeopleTabProps {
  filteredPeopleList: any[];
  personTypeMap: Record<string, PersonType>;
  setPersonTypeMap: React.Dispatch<React.SetStateAction<Record<string, PersonType>>>;
  targetMap: Record<string, string>;
  setTargetMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  officialStaffOptions: any[];
  officialPatientOptions: any[];
  officialProviderOptions: any[];
  handleProcessPerson: (name: string) => void;
  handleDeletePersonOrphan: (name: string) => void;
  handleTransferRecordsUnit?: (name: string, targetUnit: string) => void;
  isProcessing: boolean;
}

const AuditoriaPeopleTab: React.FC<AuditoriaPeopleTabProps> = ({
  filteredPeopleList,
  personTypeMap,
  setPersonTypeMap,
  targetMap,
  setTargetMap,
  officialStaffOptions,
  officialPatientOptions,
  officialProviderOptions,
  handleProcessPerson,
  handleDeletePersonOrphan,
  handleTransferRecordsUnit,
  isProcessing
}) => {
  return (
    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Fila de Tratamento: Pessoas</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase">
          <i className="fas fa-magic mr-1"></i> Normalização de Identidades
        </span>
      </div>
      <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto custom-scrollbar pb-72">
        {filteredPeopleList.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-4xl animate-bounce">
              <i className="fas fa-check-double"></i>
            </div>
            <p className="text-slate-400 font-bold uppercase text-sm tracking-widest">Nenhum registro pendente!</p>
          </div>
        ) : (
          filteredPeopleList.map((item, index) => {
            const name = item.name;
            const personId = item.id;
            const currentType = personTypeMap[name] || 'Colaborador';
            const count = item.count;

            return (
              <div key={index} className="p-6 flex flex-col xl:flex-row items-center gap-6 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 w-full xl:w-1/3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase bg-rose-100 text-rose-700">
                      <i className="fas fa-user-tag"></i> Nome Desconhecido
                    </span>
                    <div className="flex flex-wrap bg-slate-200 rounded-lg p-0.5">
                      {['Colaborador', 'Paciente', 'Prestador'].map(t => (
                        <button
                          key={t}
                          onClick={() => setPersonTypeMap(prev => ({ ...prev, [name]: t as PersonType }))}
                          className={`px-2 py-1 rounded-md text-[7px] font-bold uppercase transition-all whitespace-nowrap ${
                            currentType === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="font-black text-slate-800 uppercase text-lg leading-tight">
                    {name} {personId ? `(ID: ${personId})` : ''}
                  </div>
                  
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.sectors && Array.from(item.sectors).map((s: any, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold uppercase">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 text-xs font-bold text-slate-400 italic">
                    Encontrado em <span className="text-slate-600 underline decoration-slate-200 decoration-2">{count || (item.sources.class + item.sources.study + item.sources.visit + item.sources.group)}</span> registros
                  </div>

                  {targetMap[name] && (
                    <div className="mt-3 p-2 bg-rose-50 rounded-xl border border-rose-100">
                      <div className="text-[10px] font-black text-rose-400 uppercase leading-none mb-1">Vínculo Sugerido</div>
                      <div className="text-xs font-bold text-rose-700 uppercase italic flex items-center gap-2">
                        <i className="fas fa-magic"></i> 
                        <span>{targetMap[name]}</span>
                      </div>
                    </div>
                  )}

                  {item.crossUnitStaff && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="text-[9px] font-black text-amber-600 uppercase leading-none mb-1">
                        💡 Cadastro em Outra Unidade
                      </div>
                      <div className="text-[11px] font-bold text-amber-800 leading-tight">
                        Pertence ao RH oficial do <strong className="uppercase">{item.crossUnitStaff.unit}</strong>:
                      </div>
                      <button
                        onClick={() => handleTransferRecordsUnit?.(name, item.crossUnitStaff.unit)}
                        disabled={isProcessing}
                        className="mt-2 w-full py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <i className="fas fa-exchange-alt"></i>
                        Transferir registros para {item.crossUnitStaff.unit}
                      </button>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleDeletePersonOrphan(name)}
                    disabled={isProcessing}
                    className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase text-rose-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                    title="Excluir ou limpar este nome de todos os registros onde aparece"
                  >
                    <i className="fas fa-trash-alt"></i>
                    Apagar Registros Incorretos
                  </button>
                </div>

                <div className="hidden xl:block text-slate-300">
                  <i className="fas fa-arrow-right text-xl transition-colors group-hover:text-rose-400"></i>
                </div>

                <div className="flex-1 w-full xl:w-2/3 flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <Autocomplete
                      options={
                        currentType === 'Colaborador' ? officialStaffOptions :
                        currentType === 'Paciente' ? officialPatientOptions :
                        officialProviderOptions
                      }
                      value={targetMap[name] || ''}
                      onChange={(val) => setTargetMap(prev => ({ ...prev, [name]: val }))}
                      onSelectOption={(label) => setTargetMap(prev => ({ ...prev, [name]: label }))}
                      placeholder={currentType === 'Colaborador' ? "Buscar no RH (Inclui Inativos)..." : `Vincular a ${currentType} Existente (Opcional)...`}
                      className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all focus:border-rose-500 group-hover:border-rose-200"
                    />
                  </div>
                  <button
                    onClick={() => handleProcessPerson(name)}
                    disabled={(currentType === 'Colaborador' && !targetMap[name]) || isProcessing}
                    className="px-8 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap bg-rose-500 hover:bg-rose-600"
                  >
                    {isProcessing ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                      <i className="fas fa-check-circle"></i>
                    )}
                    <span>{currentType === 'Colaborador' ? 'Vincular' : (targetMap[name] ? 'Vincular' : 'Criar & Vincular')}</span>
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

export default AuditoriaPeopleTab;
