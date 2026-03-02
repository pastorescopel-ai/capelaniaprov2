import React from 'react';
import Autocomplete from '../Shared/Autocomplete';
import { PersonType } from '../../hooks/useDataHealer';

interface HealerPeopleTabProps {
  filteredPeopleList: any[];
  personTypeMap: Record<string, PersonType>;
  setPersonTypeMap: React.Dispatch<React.SetStateAction<Record<string, PersonType>>>;
  isHealthy: (name: string) => boolean;
  targetMap: Record<string, string>;
  setTargetMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sectorMap: Record<string, string>;
  setSectorMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  officialStaffOptions: any[];
  officialPatientOptions: any[];
  officialProviderOptions: any[];
  officialSectorOptions: any[];
  handleProcessPerson: (name: string) => void;
  handleDeleteSourceRecord: (collection: string, id: string, actionType?: string, orphanName?: string) => void;
  getSourceRecords: (orphanName: string) => any[];
  isProcessing: boolean;
}

const HealerPeopleTab: React.FC<HealerPeopleTabProps> = ({
  filteredPeopleList,
  personTypeMap,
  setPersonTypeMap,
  isHealthy,
  targetMap,
  setTargetMap,
  sectorMap,
  setSectorMap,
  officialStaffOptions,
  officialPatientOptions,
  officialProviderOptions,
  officialSectorOptions,
  handleProcessPerson,
  handleDeleteSourceRecord,
  getSourceRecords,
  isProcessing
}) => {
  const [expandedPerson, setExpandedPerson] = React.useState<string | null>(null);

  return (
    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Fila de Tratamento</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase"><i className="fas fa-magic mr-1"></i> Correção em massa</span>
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
            const sectors = item.sectors;
            const sources = item.sources;
            const currentType = personTypeMap[name] || 'Colaborador';
            const healthy = isHealthy(name);

            return (
              <div key={index} className="p-6 flex flex-col xl:flex-row items-center gap-6 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 w-full xl:w-1/3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase ${healthy ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      <i className={`fas ${healthy ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i> 
                      {healthy ? 'Vínculo Existente' : 'Registro Pendente'}
                    </span>
                    <div className="flex flex-wrap bg-slate-200 rounded-lg p-0.5">
                      {(['Colaborador', 'Ex-Colaborador', 'Paciente', 'Prestador'] as PersonType[]).map(t => (
                        <button key={t} onClick={() => setPersonTypeMap(prev => ({...prev, [name]: t}))} className={`px-2 py-1 rounded-md text-[7px] font-bold uppercase transition-all whitespace-nowrap ${currentType === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="font-black text-slate-800 uppercase text-lg leading-tight">{name}</div>
                  
                  <div className="space-y-1 mt-2">
                    {sources.class > 0 && <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 p-1.5 rounded flex items-center gap-2 w-fit"><i className="fas fa-chalkboard-teacher"></i> Encontrado em: {sources.class} Aulas</div>}
                    {sources.study > 0 && <div className="text-[10px] font-bold text-blue-600 bg-blue-50 p-1.5 rounded flex items-center gap-2 w-fit"><i className="fas fa-book-open"></i> Encontrado em: {sources.study} Estudos</div>}
                    {sources.visit > 0 && <div className="text-[10px] font-bold text-rose-600 bg-rose-50 p-1.5 rounded flex items-center gap-2 w-fit"><i className="fas fa-hand-holding-heart"></i> Encontrado em: {sources.visit} Visitas</div>}
                    <div className="text-[10px] text-slate-500 font-bold flex items-start gap-2 bg-white/50 p-2 rounded-lg border border-slate-100">
                      <i className="fas fa-map-marker-alt text-slate-400 mt-0.5"></i>
                      <span>{sectors.length > 0 ? `Visto em: ${sectors.join(', ')}` : <span className="italic text-slate-400">Local não registrado</span>}</span>
                    </div>
                    
                    <button 
                        onClick={() => setExpandedPerson(expandedPerson === name ? null : name)}
                        className="mt-2 text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors uppercase tracking-wider"
                    >
                        <i className={`fas ${expandedPerson === name ? 'fa-chevron-up' : 'fa-search'}`}></i>
                        {expandedPerson === name ? 'Ocultar Detalhes' : 'Investigar Origem'}
                    </button>

                    {expandedPerson === name && (
                        <div className="mt-3 bg-slate-100 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-2">
                            <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">Registros Encontrados no Banco de Dados:</h4>
                            {getSourceRecords(name).map((rec: any, idx: number) => (
                                <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center gap-3 shadow-sm">
                                    <div className="text-[10px] text-slate-600 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black uppercase text-[10px] text-slate-700">{rec.type}</span>
                                            <span className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-mono border border-slate-200" title="ID do Registro">ID: {String(rec.id).split('-')[0]}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-[9px]">
                                            <span className="font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100" title="Tabela no Banco de Dados"><i className="fas fa-database mr-1"></i>{rec.collection}</span>
                                            {rec.date && <span><i className="far fa-calendar-alt mr-1"></i>{new Date(rec.date).toLocaleDateString('pt-BR')}</span>}
                                            {rec.sector && <span><i className="fas fa-map-marker-alt mr-1"></i>{rec.sector}</span>}
                                        </div>
                                        {rec.details && <div className="mt-1.5 text-slate-500 italic text-[9px] bg-slate-50 p-1.5 rounded border border-slate-100"><i className="fas fa-info-circle mr-1 text-slate-400"></i>{rec.details}</div>}
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteSourceRecord(rec.collection, rec.id, rec.actionType, name)}
                                        className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors flex flex-col items-center gap-1 border border-transparent hover:border-rose-100 min-w-[60px]"
                                        title={rec.actionType === 'delete_record' ? "Excluir Registro Completo" : "Remover Apenas o Nome"}
                                    >
                                        <i className={`fas ${rec.actionType === 'delete_record' ? 'fa-trash-alt' : 'fa-eraser'}`}></i>
                                        <span className="text-[7px] font-bold uppercase">{rec.actionType === 'delete_record' ? 'Excluir' : 'Limpar'}</span>
                                    </button>
                                </div>
                            ))}
                            {getSourceRecords(name).length === 0 && <div className="text-[10px] italic text-slate-400">Nenhum registro detalhado encontrado.</div>}
                        </div>
                    )}
                  </div>
                </div>

                <div className="hidden xl:block text-slate-300">
                  <i className="fas fa-arrow-right text-xl transition-colors group-hover:text-rose-400"></i>
                </div>

                <div className="flex-1 w-full xl:w-2/3 flex flex-col md:flex-row gap-3">
                  {currentType === 'Ex-Colaborador' ? (
                    <div className="flex-1 flex flex-col md:flex-row gap-3">
                      <div className="flex-1">
                        <Autocomplete 
                          options={officialStaffOptions}
                          value={targetMap[name] || ''}
                          onChange={(val) => setTargetMap(prev => ({...prev, [name]: val}))}
                          onSelectOption={(label) => setTargetMap(prev => ({...prev, [name]: label}))}
                          placeholder="Buscar no RH (Inativos)..."
                          className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all focus:border-rose-500"
                        />
                      </div>
                      <div className="flex-1">
                        <Autocomplete 
                          options={officialSectorOptions} 
                          value={sectorMap[name] || ''} 
                          onChange={(val) => setSectorMap(prev => ({...prev, [name]: val}))} 
                          onSelectOption={(val) => setSectorMap(prev => ({...prev, [name]: val}))} 
                          placeholder="Último Setor (Opcional)..." 
                          className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-rose-500" 
                        />
                      </div>
                    </div>
                  ) : currentType === 'Paciente' || currentType === 'Prestador' ? (
                    <div className="flex-1">
                      <Autocomplete 
                        options={currentType === 'Paciente' ? (officialPatientOptions || []) : (officialProviderOptions || [])}
                        value={targetMap[name] || ''}
                        onChange={(val) => setTargetMap(prev => ({...prev, [name]: val}))}
                        onSelectOption={(label) => setTargetMap(prev => ({...prev, [name]: label}))}
                        placeholder={`Vincular a ${currentType} Existente (Opcional)...`}
                        className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all focus:border-rose-500"
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <Autocomplete 
                        options={officialStaffOptions}
                        value={targetMap[name] || ''}
                        onChange={(val) => setTargetMap(prev => ({...prev, [name]: val}))}
                        onSelectOption={(label) => setTargetMap(prev => ({...prev, [name]: label}))}
                        placeholder="Buscar no RH (Inclui Inativos)..."
                        className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all focus:border-rose-500 group-hover:border-rose-200"
                      />
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleProcessPerson(name)}
                    disabled={(!targetMap[name] && (currentType === 'Colaborador' || currentType === 'Ex-Colaborador')) || isProcessing}
                    className="px-8 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap bg-rose-500 hover:bg-rose-600"
                  >
                    {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check-circle"></i>}
                    <span>
                      {currentType === 'Colaborador' || currentType === 'Ex-Colaborador' ? 'Unificar' : 
                       targetMap[name] ? 'Vincular' : 'Criar & Vincular'}
                    </span>
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

export default HealerPeopleTab;
