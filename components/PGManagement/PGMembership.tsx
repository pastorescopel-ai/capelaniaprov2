
import React from 'react';
import { Unit } from '../../types';
import Autocomplete from '../Shared/Autocomplete';
import GapRadar from './GapRadar';
import RemovalModal from './RemovalModal';
import { usePGMembership } from '../../hooks/usePGMembership';

interface PGMembershipProps {
  unit: Unit;
}

const PGMembership: React.FC<PGMembershipProps> = ({ unit }) => {
  const {
    activeTab, setActiveTab,
    selectedSectorName, setSelectedSectorName,
    staffSearch, setStaffSearch,
    selectedPGName, setSelectedPGName,
    providerSearch, setProviderSearch,
    isProcessing,
    removalType, setRemovalType,
    memberToRemove, setMemberToRemove,
    currentSector, currentPG,
    availableProviders, coverageGaps, emptyPGs, availableStaff, pgMembers,
    isNewProvider,
    handleEnroll, handleCreateAndEnrollProvider, confirmRemoval, handleSetLeader,
    proSectors, proGroups
  } = usePGMembership({ unit });

  const cleanId = (id: any) => String(id || '').replace(/\D/g, '');

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-500">
      
      <RemovalModal 
        memberToRemove={memberToRemove}
        removalType={removalType}
        setRemovalType={setRemovalType}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={confirmRemoval}
      />

      <div className="bg-slate-900 p-8 rounded-[3rem] shadow-xl grid md:grid-cols-2 gap-8 text-white relative">
        <div className="absolute inset-0 rounded-[3rem] overflow-hidden pointer-events-none">
           <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        </div>
        
        <div className="space-y-4 z-10 relative">
          <div className="flex bg-white/10 p-1 rounded-xl w-fit">
            <button 
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'staff' ? 'bg-blue-500 text-white shadow-md' : 'text-white/50 hover:text-white/80'}`}
            >
              Colaboradores (CLT)
            </button>
            <button 
              onClick={() => setActiveTab('providers')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'providers' ? 'bg-blue-500 text-white shadow-md' : 'text-white/50 hover:text-white/80'}`}
            >
              Prestadores
            </button>
          </div>

          {activeTab === 'staff' ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">1. Selecione o Setor (Origem)</label>
                <Autocomplete 
                  options={proSectors.filter(s => s.unit === unit).map(s => ({ value: s.name, label: s.name }))}
                  value={selectedSectorName}
                  onChange={(v) => { setSelectedSectorName(v); setStaffSearch(''); }}
                  placeholder="Buscar Setor..."
                  className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl text-white font-bold placeholder:text-white/30 focus:bg-white/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Ou Busque por Nome/Matrícula</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={staffSearch}
                    onChange={e => { setStaffSearch(e.target.value); setSelectedSectorName(''); }}
                    placeholder="Nome ou Matrícula..."
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl text-white font-bold placeholder:text-white/30 focus:bg-white/20 outline-none"
                  />
                  {staffSearch && (
                    <button onClick={() => setStaffSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"><i className="fas fa-times"></i></button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">1. Buscar ou Cadastrar Prestador</label>
              <input 
                type="text"
                value={providerSearch}
                onChange={e => setProviderSearch(e.target.value)}
                placeholder="Digite o nome do prestador..."
                className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl text-white font-bold placeholder:text-white/30 focus:bg-white/20 outline-none"
              />
            </div>
          )}
        </div>

        <div className="space-y-2 z-10 relative mt-auto">
          <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">2. Selecione o PG (Destino)</label>
          <Autocomplete 
            options={proGroups.filter(g => g.unit === unit).map(g => ({ value: g.name, label: g.name }))}
            value={selectedPGName}
            onChange={setSelectedPGName}
            placeholder="Buscar Pequeno Grupo..."
            className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl text-white font-bold placeholder:text-white/30 focus:bg-white/20 outline-none"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-h-[400px]">
          <div className="mb-4 pb-4 border-b border-slate-50">
            <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-users text-slate-400"></i> {activeTab === 'staff' ? 'Disponíveis para Matrícula' : 'Prestadores Encontrados'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                {activeTab === 'staff' ? `${availableStaff.length} Resultados` : `${availableProviders.length} Prestadores`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 max-h-[500px]">
            {activeTab === 'staff' ? (
                <>
                    {availableStaff.length === 0 && (
                        <div className="text-center py-10 opacity-50">
                            <p className="text-xs text-slate-400 font-bold uppercase">{currentSector || staffSearch ? 'Nenhum colaborador encontrado.' : 'Selecione um setor ou busque por nome.'}</p>
                        </div>
                    )}
                    {availableStaff.map(staff => (
                      <div key={staff.id} className="p-4 rounded-2xl flex items-center justify-between border bg-white border-blue-100 shadow-sm hover:border-blue-300 transition-all animate-in slide-in-from-left duration-300">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-700 text-xs uppercase truncate">
                            {staff.name}
                            <span className="ml-2 text-[8px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 uppercase tracking-tighter">{(staff as any).sectorName}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-1.5 rounded uppercase">{cleanId(staff.id)}</p>
                            <p className="text-[9px] font-bold uppercase text-slate-400 truncate">
                                {staff.membership ? `Mover de: ${staff.groupName}` : 'Não Matriculado'}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => handleEnroll(staff.id, 'staff')} disabled={!currentPG || isProcessing} className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 flex-shrink-0 ml-4 ${staff.membership ? 'bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}><i className={`fas ${staff.membership ? 'fa-exchange-alt' : 'fa-plus'} text-xs`}></i></button>
                      </div>
                    ))}
                </>
            ) : (
                <>
                    {isNewProvider && (
                        <div className="p-4 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in duration-300 mb-4">
                            <div className="w-10 h-10 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center">
                                <i className="fas fa-user-plus"></i>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 text-sm">{providerSearch.toUpperCase()}</p>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Prestador não encontrado</p>
                            </div>
                            <button 
                                onClick={handleCreateAndEnrollProvider}
                                disabled={!currentPG || isProcessing}
                                className="px-4 py-2 bg-blue-600 text-white font-bold text-xs uppercase rounded-xl shadow-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                ✨ Cadastrar e Matricular
                            </button>
                        </div>
                    )}
                    {availableProviders.map(provider => (
                      <div key={provider.id} className="p-4 rounded-2xl flex items-center justify-between border bg-white border-blue-100 shadow-sm hover:border-blue-300 transition-all animate-in slide-in-from-left duration-300">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-700 text-xs uppercase truncate">{provider.name}</p>
                          <p className="text-[9px] font-bold uppercase text-slate-400 truncate flex items-center gap-2">
                              {provider.membership ? (
                                  <>
                                    <span>Mover de: {provider.groupName}</span>
                                    {provider.joinedDate && <span className="text-[8px] bg-slate-100 px-1.5 rounded text-slate-500">Desde: {provider.joinedDate}</span>}
                                  </>
                              ) : 'Não Matriculado'}
                          </p>
                        </div>
                        <button onClick={() => handleEnroll(provider.id, 'provider')} disabled={!currentPG || isProcessing} className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 flex-shrink-0 ml-4 ${provider.membership ? 'bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}><i className={`fas ${provider.membership ? 'fa-exchange-alt' : 'fa-plus'} text-xs`}></i></button>
                      </div>
                    ))}
                </>
            )}
          </div>
        </div>

        <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100 flex flex-col min-h-[400px]">
          <div className="mb-4 pb-4 border-b border-emerald-100/50">
            <h3 className="font-black text-emerald-900 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-house-user text-emerald-500"></i> Membros do PG
            </h3>
            <p className="text-[10px] text-emerald-700/60 font-bold uppercase mt-1">{currentPG ? `${pgMembers.length} Matriculados` : 'Selecione um PG'}</p>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 max-h-[500px]">
            {pgMembers.map(member => (
              <div key={member.id} className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all group ${member.isOptimistic ? 'bg-emerald-100 border-emerald-200 animate-pulse' : member.isLeader ? 'bg-amber-50 border-amber-200 shadow-md' : 'bg-white border-emerald-100'}`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {member.isOptimistic && <i className="fas fa-circle-notch fa-spin text-[10px] text-emerald-600"></i>}
                    {member.isLeader && <i className="fas fa-crown text-amber-500 text-xs animate-bounce"></i>}
                    <div className="min-w-0">
                        <p className={`text-xs uppercase truncate ${member.isLeader ? 'font-black text-amber-800' : 'font-bold text-emerald-900'}`}>
                            {member.staffName}
                            <span className={`ml-2 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${member.isLeader ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-700'}`}>{(member as any).sectorName}</span>
                            {(member as any).type === 'provider' && <span className="ml-2 text-[8px] bg-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded-full font-black">PRESTADOR</span>}
                        </p>
                        {member.joinedDate && <p className="text-[8px] font-bold text-emerald-600/60 uppercase">Desde: {member.joinedDate}</p>}
                    </div>
                </div>
                {!member.isOptimistic && (
                    <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button onClick={() => handleSetLeader(member)} disabled={isProcessing || member.isLeader} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${member.isLeader ? 'bg-amber-100 text-amber-500 cursor-default' : 'bg-slate-50 text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}><i className="fas fa-crown text-[10px]"></i></button>
                        <button onClick={() => setMemberToRemove({ id: member.id, name: member.staffName, staffId: member.staffId })} disabled={isProcessing} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-300 hover:text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all"><i className="fas fa-trash text-[10px]"></i></button>
                    </div>
                )}
              </div>
            ))}
            {currentPG && pgMembers.length === 0 && (
              <div className="text-center py-10 opacity-50"><i className="fas fa-user-friends text-4xl text-emerald-300 mb-2"></i><p className="text-xs font-bold text-emerald-700">PG vazio.</p></div>
            )}
          </div>
        </div>
      </div>

      <GapRadar 
        coverageGaps={coverageGaps}
        emptyPGs={emptyPGs}
        onSelectSector={(name) => { setSelectedSectorName(name); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onSelectPG={(name) => { setSelectedPGName(name); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />
    </div>
  );
};

export default PGMembership;
