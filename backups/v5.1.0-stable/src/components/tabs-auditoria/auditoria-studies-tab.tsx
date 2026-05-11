import React from 'react';
import Autocomplete from '../Shared/Autocomplete';
import { ParticipantType } from '../../types';

interface AuditoriaStudiesTabProps {
  studyOrphans: any[];
  activeStudyTab: ParticipantType;
  setActiveStudyTab: React.Dispatch<React.SetStateAction<ParticipantType>>;
  studyTargetMap: Record<string, string>;
  setStudyTargetMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  officialStaffOptions: any[];
  officialPatientOptions: any[];
  officialProviderOptions: any[];
  handleLinkStudy: (orphanName: string) => void;
  isProcessing: boolean;
}

const AuditoriaStudiesTab: React.FC<AuditoriaStudiesTabProps> = ({
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
      <div className="p-8 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Fila de Tratamento: Estudos Bíbicos</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Normalização de participantes legados</p>
        </div>
        <div className="flex bg-slate-200 p-1 rounded-xl">
          {(['staff', 'patient', 'provider'] as ParticipantType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveStudyTab(type)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                activeStudyTab === type ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {type === 'staff' ? 'Colaboradores' : type === 'patient' ? 'Pacientes' : 'Prestadores'}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto custom-scrollbar pb-72">
        {studyOrphans.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-4xl animate-bounce">
              <i className="fas fa-check-double"></i>
            </div>
            <p className="text-slate-400 font-bold uppercase text-sm tracking-widest">Nenhum registro pendente!</p>
          </div>
        ) : (
          studyOrphans.map((orphan, index) => (
            <div key={index} className="p-6 flex flex-col xl:flex-row items-center gap-6 hover:bg-slate-50 transition-colors group">
              <div className="flex-1 w-full xl:w-1/3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase bg-indigo-100 text-indigo-700">
                    <i className="fas fa-book-reader"></i> Nome não Normalizado
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{orphan.count} estudos</span>
                </div>
                <div className="font-black text-slate-800 uppercase text-lg leading-tight">{orphan.name}</div>
              </div>

              <div className="hidden xl:block text-slate-300">
                <i className="fas fa-arrow-right text-xl transition-colors group-hover:text-indigo-400"></i>
              </div>

              <div className="flex-1 w-full xl:w-2/3 flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <Autocomplete
                    options={
                      activeStudyTab === 'staff' ? officialStaffOptions :
                      activeStudyTab === 'patient' ? officialPatientOptions :
                      officialProviderOptions
                    }
                    value={studyTargetMap[orphan.name] || ''}
                    onChange={(val) => setStudyTargetMap(prev => ({ ...prev, [orphan.name]: val }))}
                    onSelectOption={(label) => setStudyTargetMap(prev => ({ ...prev, [orphan.name]: label }))}
                    placeholder={`Vincular a ${activeStudyTab === 'staff' ? 'Colaborador' : activeStudyTab === 'patient' ? 'Paciente' : 'Prestador'} Oficial...`}
                    className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all focus:border-indigo-500 group-hover:border-indigo-200"
                  />
                </div>
                <button
                  onClick={() => handleLinkStudy(orphan.name)}
                  disabled={!studyTargetMap[orphan.name] || isProcessing}
                  className="px-8 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap bg-indigo-500 hover:bg-indigo-600"
                >
                  {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-link"></i>}
                  <span>Vincular</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AuditoriaStudiesTab;
