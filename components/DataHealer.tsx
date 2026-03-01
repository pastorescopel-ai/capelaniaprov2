
import React from 'react';
import { useDataHealer } from '../hooks/useDataHealer';
import HealerPeopleTab from './DataHealer/HealerPeopleTab';
import HealerStudiesTab from './DataHealer/HealerStudiesTab';
import HealerAttendeesTab from './DataHealer/HealerAttendeesTab';
import HealerSectorsTab from './DataHealer/HealerSectorsTab';

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
    handleProcessPerson, handleHealSector, handleLinkStudy, isHealthy
  } = useDataHealer();

  // Tema dinâmico
  const getTheme = () => {
      if (activeTab === 'attendees') return 'violet';
      if (activeTab === 'people') return 'rose';
      return 'blue';
  };
  const currentTheme = getTheme();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32 max-w-5xl mx-auto">
      
      {/* HEADER DINÂMICO */}
      <div className={`bg-${currentTheme}-50 border-l-8 border-${currentTheme}-500 p-8 rounded-r-[3rem] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-colors duration-500`}>
        <div>
            <h2 className={`text-3xl font-black text-${currentTheme}-900 uppercase tracking-tighter flex items-center gap-3`}>
            <i className={`fas ${activeTab === 'people' ? 'fa-user-nurse' : activeTab === 'attendees' ? 'fa-clipboard-user' : 'fa-map-marked-alt'}`}></i> 
            Centro de Cura {activeTab === 'people' ? 'de Pessoas' : activeTab === 'attendees' ? 'de Presenças' : 'de Setores'}
            </h2>
            <p className={`text-${currentTheme}-800 text-xs font-bold mt-2 uppercase tracking-widest leading-relaxed`}>
            {activeTab === 'people' && 'Unificação de nomes e criação de identidades.'}
            {activeTab === 'attendees' && 'Correção de vínculo técnico (Staff ID nulo) em aulas.'}
            {activeTab === 'sectors' && 'Correção de nomes de setores e vínculo com IDs oficiais.'}
            </p>
        </div>
        <div className="flex flex-col items-center gap-2">
            <div className={`text-center bg-white/50 p-4 rounded-2xl border border-${currentTheme}-200 w-full`}>
                <span className={`block text-4xl font-black text-${currentTheme}-600`}>
                    {activeTab === 'people' ? filteredPeopleList.length : activeTab === 'attendees' ? attendeeOrphans.length : sectorOrphans.length}
                </span>
                <span className={`text-[10px] font-black text-${currentTheme}-400 uppercase tracking-widest`}>Pendentes</span>
            </div>
        </div>
      </div>

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
                      placeholder="Buscar nome específico para forçar unificação..."
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
          officialSectorOptions={officialSectorOptions}
          handleProcessPerson={handleProcessPerson}
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
    </div>
  );
};

export default DataHealer;
