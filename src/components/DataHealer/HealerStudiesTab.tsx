import React from 'react';
import Autocomplete from '../Shared/Autocomplete';
import { ParticipantType } from '../../types';

interface HealerStudiesTabProps {
  studyOrphans: any[];
  activeStudyTab: ParticipantType;
  setActiveStudyTab: React.Dispatch<React.SetStateAction<ParticipantType>>;
  studyTargetMap: Record<string, string>;
  setStudyTargetMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  officialStaffOptions: any[];
  officialPatientOptions: any[];
  officialProviderOptions: any[];
  handleLinkStudy: (name: string) => void;
  isProcessing: boolean;
}

const HealerStudiesTab: React.FC<HealerStudiesTabProps> = ({
  studyOrphans,
  activeStudyTab,
  setActiveStudyTab,
  studyTargetMap,
  setStudyTargetMap,
  officialStaffOptions,
  officialPatientOptions,
  officialProviderOptions,
  handleLinkStudy,
  isProcessing
}) => {
  return (
    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-8 bg-slate-50 border-b border-slate-100 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Estudos Bíblicos Desvinculados</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase"><i className="fas fa-magic mr-1"></i> Correção Manual</span>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
          <button 
            onClick={() => setActiveStudyTab(ParticipantType.STAFF)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeStudyTab === ParticipantType.STAFF ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Colaboradores
          </button>
          <button 
            onClick={() => setActiveStudyTab(ParticipantType.PATIENT)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeStudyTab === ParticipantType.PATIENT ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Pacientes
          </button>
          <button 
            onClick={() => setActiveStudyTab(ParticipantType.PROVIDER)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeStudyTab === ParticipantType.PROVIDER ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Prestadores
          </button>
        </div>
      </div>
      <div className="p-6 bg-indigo-50 border-b border-indigo-100">
        <p className="text-indigo-600 text-xs font-bold">Estes registros de {activeStudyTab.toLowerCase()}s não possuem vínculo com a base oficial. Vincule-os manualmente para corrigir os relatórios.</p>
      </div>
      <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto custom-scrollbar pb-72">
        {studyOrphans.filter(o => o.participantType === activeStudyTab).length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-4xl animate-bounce">
              <i className="fas fa-check-double"></i>
            </div>
            <p className="text-slate-400 font-bold uppercase text-sm tracking-widest">Todos os estudos de {activeStudyTab.toLowerCase()}s estão vinculados corretamente!</p>
          </div>
        ) : (
          studyOrphans.filter(o => o.participantType === activeStudyTab).map(orphan => (
            <div key={orphan.name} className="p-6 flex flex-col xl:flex-row items-center gap-6 hover:bg-slate-50 transition-colors group">
              <div className="flex-1 w-full xl:w-1/3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase bg-indigo-100 text-indigo-700">
                    <i className="fas fa-link"></i> Sem Vínculo Oficial
                  </span>
                </div>
                <h4 className="font-black text-slate-800 uppercase text-lg leading-tight">{orphan.name}</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase"><i className="fas fa-layer-group mr-1"></i> {orphan.count} registro(s)</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase"><i className="fas fa-map-marker-alt mr-1"></i> Unidade: {orphan.unit}</span>
                  <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded uppercase"><i className="fas fa-user-tag mr-1"></i> Tipo: {orphan.participantType}</span>
                </div>
              </div>
              <div className="hidden xl:block text-slate-300">
                <i className="fas fa-arrow-right text-xl transition-colors group-hover:text-indigo-400"></i>
              </div>
              <div className="flex-1 w-full xl:w-2/3 bg-slate-50 p-6 rounded-3xl border border-slate-100 group-hover:border-indigo-200 transition-colors">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Vincular à Base Oficial ({activeStudyTab})</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Autocomplete 
                      options={activeStudyTab === ParticipantType.STAFF ? officialStaffOptions : activeStudyTab === ParticipantType.PATIENT ? officialPatientOptions : officialProviderOptions} 
                      value={studyTargetMap[orphan.name] || ''} 
                      onChange={(val) => setStudyTargetMap(prev => ({...prev, [orphan.name]: val}))} 
                      placeholder={`Buscar na base de ${activeStudyTab}s...`} 
                    />
                  </div>
                  <button 
                    onClick={() => handleLinkStudy(orphan.name)} 
                    disabled={isProcessing || !studyTargetMap[orphan.name]}
                    className="px-6 py-4 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-wider rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2 whitespace-nowrap"
                  >
                    {isProcessing ? <><i className="fas fa-circle-notch fa-spin"></i> Vinculando...</> : <><i className="fas fa-link"></i> Vincular Estudo</>}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HealerStudiesTab;
