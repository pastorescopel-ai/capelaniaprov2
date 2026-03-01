
import React from 'react';
import { useDataHealer } from '../hooks/useDataHealer';
import HealerPeopleTab from './DataHealer/HealerPeopleTab';
import HealerStudiesTab from './DataHealer/HealerStudiesTab';
import HealerAttendeesTab from './DataHealer/HealerAttendeesTab';
import HealerSectorsTab from './DataHealer/HealerSectorsTab';
import HealerPGsTab from './DataHealer/HealerPGsTab';

const DataHealer: React.FC = () => {
  const {
    activeTab, setActiveTab,
    activeStudyTab, setActiveStudyTab,
    targetMap, setTargetMap,
    studyTargetMap, setStudyTargetMap,
    sectorMap, setSectorMap,
    searchQuery, setSearchQuery,
    filterClassOnly, setFilterClassOnly,
    personTypeMap, setPersonTypeMap,
    attendeeOrphans, isLoadingAttendees,
    isProcessing, showAllHistory, setShowAllHistory,
    studyOrphans, peopleOrphans, sectorOrphans,
    officialStaffOptions, officialPatientOptions, officialProviderOptions, officialSectorOptions,
    filteredPeopleList,
    handleProcessPerson, handleHealSector, handleLinkStudy, isHealthy,
    healthScore,
    duplicatePGs,
    handleMergePGs,
    getSourceRecords,
    handleDeleteSourceRecord
  } = useDataHealer();

  // Tema dinâmico
  const getTheme = () => {
      if (activeTab === 'attendees') return 'violet';
      if (activeTab === 'people') return 'rose';
      if (activeTab === 'studies') return 'indigo';
      if (activeTab === 'pgs') return 'amber';
      return 'blue';
  };
  const currentTheme = getTheme();

  const totalOrphans = peopleOrphans.length + studyOrphans.length + sectorOrphans.length + attendeeOrphans.length + duplicatePGs.length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32 max-w-5xl mx-auto">
      
      {/* HEADER DE AUDITORIA COM SCORE DE SAÚDE */}
      <div className={`bg-white border border-slate-100 p-8 rounded-[3rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 transition-all duration-500 relative overflow-hidden`}>
        {/* Background Decorativo */}
        <div className={`absolute top-0 right-0 w-64 h-64 bg-${currentTheme}-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl`}></div>
        
        <div className="relative z-10 space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
                <div className={`w-12 h-12 rounded-2xl bg-${currentTheme}-100 text-${currentTheme}-600 flex items-center justify-center text-xl shadow-inner`}>
                    <i className={`fas ${activeTab === 'people' ? 'fa-user-shield' : activeTab === 'attendees' ? 'fa-clipboard-check' : activeTab === 'studies' ? 'fa-book-reader' : activeTab === 'pgs' ? 'fa-users-rectangle' : 'fa-building-shield'}`}></i>
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">
                        Auditoria de Qualidade
                    </h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Monitoramento de Integridade de Dados</p>
                </div>
            </div>
            
            <p className="text-slate-500 text-xs font-bold max-w-md leading-relaxed">
                {activeTab === 'people' && 'Validando identidades e vínculos de colaboradores, pacientes e prestadores.'}
                {activeTab === 'attendees' && 'Auditando presenças em classes bíblicas sem identificação de matrícula.'}
                {activeTab === 'studies' && 'Verificando sessões de estudo bíblico com nomes não normalizados.'}
                {activeTab === 'sectors' && 'Garantindo que todos os setores históricos estejam ancorados no RH oficial.'}
                {activeTab === 'pgs' && 'Detectando e fundindo cadastros duplicados de Pequenos Grupos.'}
            </p>
        </div>

        <div className="relative z-10 flex items-center gap-8 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
            <div className="text-center space-y-1">
                <span className={`block text-4xl font-black ${healthScore === 100 ? 'text-emerald-500' : healthScore > 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                    {healthScore}%
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saúde da Base</span>
            </div>
            <div className="w-px h-12 bg-slate-200"></div>
            <div className="text-center space-y-1">
                <span className={`block text-4xl font-black ${totalOrphans === 0 ? 'text-emerald-500' : 'text-slate-700'}`}>
                    {totalOrphans}
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Anomalias</span>
            </div>
        </div>
      </div>

      {/* MENSAGEM DE SUCESSO (BASE 100% LIMPA) */}
      {totalOrphans === 0 && (
          <div className="bg-emerald-50 border-2 border-emerald-100 p-10 rounded-[3rem] text-center space-y-4 animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-200">
                  <i className="fas fa-check-double"></i>
              </div>
              <div className="space-y-2">
                  <h3 className="text-2xl font-black text-emerald-900 uppercase tracking-tighter">Qualidade Garantida</h3>
                  <p className="text-emerald-700 text-xs font-bold uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                      Sua base de dados está 100% íntegra. Todos os lançamentos estão devidamente vinculados ao RH oficial.
                  </p>
              </div>
          </div>
      )}

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 max-w-xl mx-auto gap-2">
          <button 
            onClick={() => { setActiveTab('people'); setTargetMap({}); setPersonTypeMap({}); setSearchQuery(''); }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'people' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <i className="fas fa-users"></i> Pessoas
          </button>
          <button 
            onClick={() => { setActiveTab('studies'); setStudyTargetMap({}); setSearchQuery(''); }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'studies' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <i className="fas fa-book-open"></i> Estudos
          </button>
          <button 
            onClick={() => { setActiveTab('attendees'); setTargetMap({}); setSearchQuery(''); }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'attendees' ? 'bg-violet-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <i className="fas fa-clipboard-check"></i> Presenças
          </button>
          <button 
            onClick={() => { setActiveTab('pgs'); setTargetMap({}); setSearchQuery(''); }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'pgs' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <i className="fas fa-users-rectangle"></i> PGs
          </button>
          <button 
            onClick={() => { setActiveTab('sectors'); setTargetMap({}); setSearchQuery(''); }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'sectors' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <i className="fas fa-building"></i> Setores
          </button>
      </div>

      {/* BUSCA MANUAL E FILTRO (ABA PESSOAS E ESTUDOS) */}
      {(activeTab === 'people' || activeTab === 'studies') && (
          <div className="max-w-xl mx-auto space-y-4">
              <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <i className={`fas fa-search text-lg ${searchQuery ? (activeTab === 'studies' ? 'text-indigo-500' : 'text-rose-500') : 'text-slate-300'} transition-colors`}></i>
                  </div>
                  <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar nome específico para forçar auditoria..."
                      className={`w-full pl-12 pr-4 py-4 rounded-2xl border-none shadow-sm font-bold text-sm text-slate-700 outline-none focus:ring-4 ${activeTab === 'studies' ? 'focus:ring-indigo-100' : 'focus:ring-rose-100'} placeholder:text-slate-300 transition-all bg-white`}
                  />
                  {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className={`absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:${activeTab === 'studies' ? 'text-indigo-500' : 'text-rose-500'} transition-colors`}><i className="fas fa-times"></i></button>
                  )}
              </div>
              {activeTab === 'people' && (
                  <div className="flex justify-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors select-none">
                          <input type="checkbox" checked={filterClassOnly} onChange={e => setFilterClassOnly(e.target.checked)} className="rounded text-rose-500 focus:ring-rose-500" />
                          <span className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-2"><i className="fas fa-chalkboard-teacher"></i> Apenas Alunos de Classe</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors select-none">
                          <input type="checkbox" checked={showAllHistory} onChange={e => setShowAllHistory(e.target.checked)} className="rounded text-rose-500 focus:ring-rose-500" />
                          <span className="text-[9px] font-black uppercase text-slate-500">Exibir todos</span>
                      </label>
                  </div>
              )}
          </div>
      )}

      {/* LISTA DE TRATAMENTO */}
      {totalOrphans > 0 && (
          <div className="animate-in slide-in-from-bottom-4 duration-700">
              {activeTab === 'studies' && (
                <HealerStudiesTab 
                  studyOrphans={studyOrphans}
                  activeStudyTab={activeStudyTab}
                  setActiveStudyTab={setActiveStudyTab}
                  studyTargetMap={studyTargetMap}
                  setStudyTargetMap={setStudyTargetMap}
                  officialStaffOptions={officialStaffOptions}
                  officialPatientOptions={officialPatientOptions}
                  officialProviderOptions={officialProviderOptions}
                  handleLinkStudy={handleLinkStudy}
                  isProcessing={isProcessing}
                />
              )}

              {activeTab === 'people' && (
                <HealerPeopleTab 
                  filteredPeopleList={filteredPeopleList}
                  personTypeMap={personTypeMap}
                  setPersonTypeMap={setPersonTypeMap}
                  isHealthy={isHealthy}
                  targetMap={targetMap}
                  setTargetMap={setTargetMap}
                  sectorMap={sectorMap}
                  setSectorMap={setSectorMap}
                  officialStaffOptions={officialStaffOptions}
                  officialPatientOptions={officialPatientOptions}
                  officialProviderOptions={officialProviderOptions}
                  officialSectorOptions={officialSectorOptions}
                  handleProcessPerson={handleProcessPerson}
                  getSourceRecords={getSourceRecords}
                  handleDeleteSourceRecord={handleDeleteSourceRecord}
                  isProcessing={isProcessing}
                />
              )}

              {activeTab === 'attendees' && (
                <HealerAttendeesTab 
                  attendeeOrphans={attendeeOrphans}
                  isLoadingAttendees={isLoadingAttendees}
                  targetMap={targetMap}
                  setTargetMap={setTargetMap}
                  officialStaffOptions={officialStaffOptions}
                  handleProcessPerson={handleProcessPerson}
                  isProcessing={isProcessing}
                />
              )}

              {activeTab === 'sectors' && (
                <HealerSectorsTab 
                  sectorOrphans={sectorOrphans}
                  targetMap={targetMap}
                  setTargetMap={setTargetMap}
                  officialSectorOptions={officialSectorOptions}
                  handleHealSector={handleHealSector}
                  isProcessing={isProcessing}
                />
              )}

              {activeTab === 'pgs' && (
                <HealerPGsTab 
                  duplicatePGs={duplicatePGs}
                  handleMergePGs={handleMergePGs}
                  isProcessing={isProcessing}
                />
              )}
          </div>
      )}
    </div>
  );
};

export default DataHealer;
