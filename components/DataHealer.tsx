
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { normalizeString } from '../utils/formatters';
import { ParticipantType, ProStaff } from '../types';
import Autocomplete from './Shared/Autocomplete';
import { supabase } from '../services/supabaseClient';

type HealerTab = 'people' | 'sectors' | 'attendees';
type PersonType = 'Colaborador' | 'Ex-Colaborador' | 'Paciente' | 'Prestador';

const DataHealer: React.FC = () => {
  // Adicionado proPatients e proProviders na desestruturação
  const { bibleClasses, bibleStudies, smallGroups, staffVisits, proStaff, proPatients, proProviders, proSectors, unifyStudentIdentity, createAndLinkIdentity, healSectorConnection, saveRecord } = useApp();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<HealerTab>('people');
  const [targetMap, setTargetMap] = useState<Record<string, string>>({});
  const [sectorMap, setSectorMap] = useState<Record<string, string>>({}); // Para selecionar setor do Ex-Colaborador
  const [searchQuery, setSearchQuery] = useState(''); // NOVO: Estado para busca forçada
  const [filterClassOnly, setFilterClassOnly] = useState(false); // NOVO: Filtro para alunos de classe
  
  // Estado local para armazenar o tipo selecionado para cada registro
  const [personTypeMap, setPersonTypeMap] = useState<Record<string, PersonType>>({});
  
  // Estado para UX Otimista: Itens resolvidos somem da tela imediatamente
  const [resolvedItems, setResolvedItems] = useState<Set<string>>(new Set());
  
  // Estado específico para a aba de Presenças (Raio-X do Banco)
  const [attendeeOrphans, setAttendeeOrphans] = useState<{name: string, count: number}[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // --- CARREGAMENTO DE PRESENÇAS ÓRFÃS (DB DIRECT) ---
  useEffect(() => {
    if (activeTab === 'attendees') {
        const fetchAttendees = async () => {
            if (!supabase) return;
            setIsLoadingAttendees(true);
            try {
                // Busca apenas nomes onde staff_id é nulo na tabela de junção
                const { data, error } = await supabase
                    .from('bible_class_attendees')
                    .select('student_name')
                    .is('staff_id', null);
                
                if (error) throw error;

                if (data) {
                    const groups: Record<string, {name: string, count: number}> = {};
                    data.forEach((row: any) => {
                        const n = row.student_name;
                        if (!n) return;
                        // Agrupa por nome normalizado para juntar variações de case/acento visualmente
                        const key = normalizeString(n);
                        if (resolvedItems.has(n) || resolvedItems.has(key)) return; // Filtro otimista

                        if (!groups[key]) groups[key] = { name: n, count: 0 };
                        groups[key].count++;
                    });
                    setAttendeeOrphans(Object.values(groups).sort((a, b) => b.count - a.count));
                }
            } catch (e) {
                console.error("Erro ao buscar presenças órfãs", e);
                showToast("Erro ao carregar dados do banco.", "warning");
            } finally {
                setIsLoadingAttendees(false);
            }
        };
        fetchAttendees();
    }
  }, [activeTab, resolvedItems, showToast]);

  // --- LÓGICA DE DIAGNÓSTICO: PESSOAS ÓRFÃS (CORRIGIDO PARA INCLUIR TODAS AS ENTIDADES) ---
  const peopleOrphans = useMemo(() => {
    const orphanMap = new Map<string, { sectors: Set<string>, sources: { class: number, study: number, visit: number } }>();
    
    // Lista Mestra de Nomes Oficiais (RH + Pacientes + Prestadores)
    const officialNamesNormalized = new Set([
        ...proStaff.map(s => normalizeString(s.name)),
        ...proPatients.map(p => normalizeString(p.name)),
        ...proProviders.map(p => normalizeString(p.name))
    ]);

    const normSearch = normalizeString(searchQuery); // Normaliza a busca
    
    // Função auxiliar para verificar e adicionar à lista
    const checkAndAdd = (rawName: string, sourceSector: string | undefined, type: 'class' | 'study' | 'visit', participantType?: string) => {
        if (!rawName) return;
        
        const cleanName = rawName.split(' (')[0].trim();
        
        // FILTRO OTIMISTA: Se já foi resolvido nesta sessão, ignora
        if (resolvedItems.has(cleanName)) return;

        const norm = normalizeString(cleanName);
        const isMatchSearch = normSearch && norm.includes(normSearch); // Verifica se bate com a busca
        
        // Verifica se o nome existe em QUALQUER tabela oficial
        const isOfficiallyListed = officialNamesNormalized.has(norm);

        // Se está na lista oficial, só mostra se o usuário pediu "Exibir todos" ou está buscando especificamente
        const shouldShow = isMatchSearch || (!isOfficiallyListed || showAllHistory);

        if (shouldShow && !rawName.match(/\(\d+\)$/)) {
            // Filtro de contexto: Se é paciente e não estamos buscando, ignora (a menos que showAllHistory)
            if (participantType && participantType !== 'Colaborador' && !showAllHistory && !isMatchSearch && isOfficiallyListed) return;

            if (!orphanMap.has(cleanName)) {
                orphanMap.set(cleanName, { sectors: new Set(), sources: { class: 0, study: 0, visit: 0 } });
            }
            
            const entry = orphanMap.get(cleanName)!;
            if (sourceSector && sourceSector.trim()) entry.sectors.add(sourceSector.trim());
            entry.sources[type] = (entry.sources[type] || 0) + 1;
        }
    };

    // Varre ALUNOS (Origem: bibleClasses)
    bibleClasses.forEach(cls => {
        cls.students?.forEach(s => checkAndAdd(s, cls.sector, 'class', 'Colaborador'));
    });

    // Varre ESTUDOS (Origem: bibleStudies)
    bibleStudies.forEach(s => { 
        // Verifica se devemos processar com base no tipo
        if (s.participantType === ParticipantType.STAFF || !s.participantType || showAllHistory || normSearch) {
             checkAndAdd(s.name, s.sector, 'study', s.participantType); 
        }
    });

    // Varre VISITAS (Origem: staffVisits)
    staffVisits.forEach(v => { 
        if (v.participantType === ParticipantType.STAFF || !v.participantType || showAllHistory || normSearch) {
            checkAndAdd(v.staffName, v.sector, 'visit', v.participantType);
        }
    });
    
    return Array.from(orphanMap.entries())
        .map(([name, data]) => ({ name, sectors: Array.from(data.sectors).sort(), sources: data.sources }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [bibleClasses, bibleStudies, staffVisits, proStaff, proPatients, proProviders, showAllHistory, resolvedItems, searchQuery]);

  // --- LÓGICA DE DIAGNÓSTICO: SETORES ÓRFÃOS ---
  const sectorOrphans = useMemo(() => {
      const historySet = new Set<string>();
      const officialNamesNormalized = new Set(proSectors.map(s => normalizeString(s.name)));

      const checkSector = (sector: string) => {
          if (!sector) return;
          const clean = sector.trim();
          if (!clean) return;
          if (resolvedItems.has(clean)) return;

          const norm = normalizeString(clean);
          if (!officialNamesNormalized.has(norm)) {
              historySet.add(clean);
          }
      };

      bibleStudies.forEach(s => checkSector(s.sector));
      staffVisits.forEach(v => checkSector(v.sector));
      smallGroups.forEach(g => checkSector(g.sector));
      bibleClasses.forEach(c => checkSector(c.sector));

      return Array.from(historySet).sort();
  }, [bibleStudies, staffVisits, smallGroups, bibleClasses, proSectors, resolvedItems]);

  // --- OPÇÕES AUTOCOMPLETE ---
  const officialStaffOptions = useMemo(() => {
      return proStaff.map(s => {
          const idStr = String(s.id).replace(/\D/g, '');
          const isInactive = s.active === false;
          return {
              value: s.id, 
              label: `${s.name} (${idStr})${isInactive ? ' ⚠️ [INATIVO]' : ''}`,
              subLabel: proSectors.find(sec => sec.id === s.sectorId)?.name || 'Sem Setor',
              category: 'RH' as const
          };
      });
  }, [proStaff, proSectors]);

  const officialSectorOptions = useMemo(() => {
      return proSectors.map(s => ({
          value: s.name,
          label: `${s.name}`,
          subLabel: `Unidade ${s.unit}`,
          category: 'RH' as const
      }));
  }, [proSectors]);

  // --- FILTRAGEM FINAL (Aba Pessoas) ---
  const filteredPeopleList = useMemo(() => {
      return peopleOrphans.filter(p => !filterClassOnly || p.sources.class > 0);
  }, [peopleOrphans, filterClassOnly]);

  // --- AÇÕES ---
  const handleProcessPerson = async (orphanName: string) => {
      const selectedType = personTypeMap[orphanName] || 'Colaborador';

      if (selectedType === 'Colaborador') {
          const targetLabel = targetMap[orphanName];
          if (!targetLabel) { showToast("Selecione o colaborador correspondente no RH.", "warning"); return; }
          const targetId = targetLabel.match(/\((\d+)\)/)?.[1];
          if (!targetId) { showToast("Matrícula inválida.", "warning"); return; }

          setIsProcessing(true);
          try {
              const result = await unifyStudentIdentity(orphanName, targetId);
              showToast(result, "success");
              setResolvedItems(prev => new Set(prev).add(orphanName));
              setResolvedItems(prev => new Set(prev).add(normalizeString(orphanName))); // Add normalized too
              setTargetMap(prev => { const n = {...prev}; delete n[orphanName]; return n; });
          } catch (e: any) { showToast("Erro: " + e.message, "warning"); } 
          finally { setIsProcessing(false); }

      } else if (selectedType === 'Ex-Colaborador') {
          // Lógica Ex-Colaborador (Legacy)
          const sectorName = sectorMap[orphanName];
          const sector = proSectors.find(s => s.name === sectorName);
          if (!sector) { showToast("Selecione um setor para vincular o histórico do ex-colaborador.", "warning"); return; }
          if (!confirm(`Criar registro de inativo para "${orphanName}" no setor ${sector.name}?`)) return;

          setIsProcessing(true);
          try {
              const legacyId = (7000000000 + Math.floor(Math.random() * 1000000)).toString();
              const newLegacyStaff: ProStaff = {
                  id: legacyId, name: orphanName, sectorId: sector.id, unit: sector.unit, active: false, updatedAt: Date.now()
              };
              await saveRecord('proStaff', newLegacyStaff);
              const result = await unifyStudentIdentity(orphanName, legacyId);
              showToast(`Ex-Colaborador criado! ${result}`, "success");
              setResolvedItems(prev => new Set(prev).add(orphanName));
              setSectorMap(prev => { const n = {...prev}; delete n[orphanName]; return n; });
          } catch (e: any) { showToast("Erro: " + e.message, "warning"); }
          finally { setIsProcessing(false); }

      } else {
          // Lógica Conversão
          if (!confirm(`Confirma que "${orphanName}" é um ${selectedType}?`)) return;
          setIsProcessing(true);
          try {
              const result = await createAndLinkIdentity(orphanName, selectedType);
              showToast(result, "success");
              setResolvedItems(prev => new Set(prev).add(orphanName));
          } catch (e: any) { showToast("Erro: " + e.message, "warning"); }
          finally { setIsProcessing(false); }
      }
  };

  const handleHealSector = async (badName: string) => {
      const targetLabel = targetMap[badName];
      const selectedSector = proSectors.find(s => s.name === targetLabel);
      if (!selectedSector) { showToast("Selecione um setor oficial da lista.", "warning"); return; }

      setIsProcessing(true);
      try {
          const result = await healSectorConnection(badName, selectedSector.id);
          showToast(result, "success");
          setResolvedItems(prev => new Set(prev).add(badName));
          setTargetMap(prev => { const n = {...prev}; delete n[badName]; return n; });
      } catch (e: any) { showToast("Erro: " + e.message, "warning"); }
      finally { setIsProcessing(false); }
  };

  const isHealthy = (name: string) => {
      const norm = normalizeString(name);
      return proStaff.some(s => normalizeString(s.name) === norm) ||
             proPatients.some(p => normalizeString(p.name) === norm) ||
             proProviders.some(p => normalizeString(p.name) === norm);
  };

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

      {/* BUSCA MANUAL E FILTRO (ABA PESSOAS) */}
      {activeTab === 'people' && (
          <div className="max-w-xl mx-auto space-y-4">
              <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <i className={`fas fa-search text-lg ${searchQuery ? 'text-rose-500' : 'text-slate-300'} transition-colors`}></i>
                  </div>
                  <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar nome específico para forçar unificação..."
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border-none shadow-sm font-bold text-sm text-slate-700 outline-none focus:ring-4 focus:ring-rose-100 placeholder:text-slate-300 transition-all bg-white"
                  />
                  {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-rose-500 transition-colors"><i className="fas fa-times"></i></button>
                  )}
              </div>
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
          </div>
      )}

      {/* LISTA DE TRATAMENTO */}
      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Fila de Tratamento</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase"><i className="fas fa-magic mr-1"></i> Correção em massa</span>
        </div>
        
        <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto custom-scrollbar pb-72">
          {/* MENSAGEM DE VAZIO / LOADING */}
          {activeTab === 'attendees' && isLoadingAttendees ? (
              <div className="p-20 text-center"><i className="fas fa-circle-notch fa-spin text-3xl text-violet-400"></i><p className="mt-4 text-xs font-bold text-slate-400 uppercase">Analisando banco de dados...</p></div>
          ) : (activeTab === 'people' ? filteredPeopleList : activeTab === 'attendees' ? attendeeOrphans : sectorOrphans).length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-4xl animate-bounce">
                      <i className="fas fa-check-double"></i>
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-sm tracking-widest">Nenhum registro pendente!</p>
              </div>
          ) : (
              (activeTab === 'people' ? filteredPeopleList : activeTab === 'attendees' ? attendeeOrphans : sectorOrphans).map((item, index) => {
                  const name = (activeTab === 'people' || activeTab === 'attendees') ? (item as any).name : (item as string);
                  const sectors = activeTab === 'people' ? (item as any).sectors : [];
                  const sources = activeTab === 'people' ? (item as any).sources : { class: 0, study: 0, visit: 0 };
                  const attendeeCount = activeTab === 'attendees' ? (item as any).count : 0;
                  const currentType = personTypeMap[name] || 'Colaborador';
                  
                  const healthy = activeTab === 'people' && isHealthy(name);

                  return (
                    <div key={index} className="p-6 flex flex-col xl:flex-row items-center gap-6 hover:bg-slate-50 transition-colors group">
                        
                        {/* LADO ESQUERDO: O PROBLEMA */}
                        <div className="flex-1 w-full xl:w-1/3">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase 
                                    ${activeTab === 'attendees' ? 'bg-violet-100 text-violet-700' : healthy ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    <i className={`fas ${activeTab === 'attendees' ? 'fa-link' : healthy ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i> 
                                    {activeTab === 'attendees' ? 'Sem Vínculo (Staff ID Nulo)' : activeTab === 'people' ? (healthy ? 'Vínculo Existente' : 'Registro Pendente') : 'Setor Inválido'}
                                </span>
                                {activeTab === 'people' && (
                                    <div className="flex flex-wrap bg-slate-200 rounded-lg p-0.5">
                                        {(['Colaborador', 'Ex-Colaborador', 'Paciente', 'Prestador'] as PersonType[]).map(t => (
                                            <button key={t} onClick={() => setPersonTypeMap(prev => ({...prev, [name]: t}))} className={`px-2 py-1 rounded-md text-[7px] font-bold uppercase transition-all whitespace-nowrap ${currentType === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <div className="font-black text-slate-800 uppercase text-lg leading-tight">{name}</div>
                            
                            {activeTab === 'attendees' && (
                                <div className="mt-2 text-xs font-bold text-violet-600 bg-violet-50 p-2 rounded-lg inline-block">
                                    <i className="fas fa-layer-group mr-2"></i> Encontrado em {attendeeCount} aulas
                                </div>
                            )}

                            {activeTab === 'people' && (
                                <div className="space-y-1 mt-2">
                                    {sources.class > 0 && <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 p-1.5 rounded flex items-center gap-2 w-fit"><i className="fas fa-chalkboard-teacher"></i> Encontrado em: {sources.class} Aulas</div>}
                                    {sources.study > 0 && <div className="text-[10px] font-bold text-blue-600 bg-blue-50 p-1.5 rounded flex items-center gap-2 w-fit"><i className="fas fa-book-open"></i> Encontrado em: {sources.study} Estudos</div>}
                                    {sources.visit > 0 && <div className="text-[10px] font-bold text-rose-600 bg-rose-50 p-1.5 rounded flex items-center gap-2 w-fit"><i className="fas fa-hand-holding-heart"></i> Encontrado em: {sources.visit} Visitas</div>}
                                    <div className="text-[10px] text-slate-500 font-bold flex items-start gap-2 bg-white/50 p-2 rounded-lg border border-slate-100">
                                        <i className="fas fa-map-marker-alt text-slate-400 mt-0.5"></i>
                                        <span>{sectors.length > 0 ? `Visto em: ${sectors.join(', ')}` : <span className="italic text-slate-400">Local não registrado</span>}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CENTRO: A SETA */}
                        <div className="hidden xl:block text-slate-300">
                            <i className={`fas fa-arrow-right text-xl transition-colors ${activeTab === 'attendees' ? 'group-hover:text-violet-400' : activeTab === 'people' ? 'group-hover:text-rose-400' : 'group-hover:text-blue-400'}`}></i>
                        </div>

                        {/* LADO DIREITO: A SOLUÇÃO */}
                        <div className="flex-1 w-full xl:w-2/3 flex flex-col md:flex-row gap-3">
                            {activeTab === 'people' && currentType !== 'Colaborador' ? (
                                <>
                                    {currentType === 'Ex-Colaborador' ? (
                                        <div className="flex-1"><Autocomplete options={officialSectorOptions} value={sectorMap[name] || ''} onChange={(val) => setSectorMap(prev => ({...prev, [name]: val}))} onSelectOption={(val) => setSectorMap(prev => ({...prev, [name]: val}))} placeholder="Selecione o Último Setor Conhecido..." className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-rose-500" /></div>
                                    ) : (
                                        <div className="flex-1 p-4 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-between"><span className="text-xs font-bold text-slate-600 uppercase"><i className={`fas ${currentType === 'Paciente' ? 'fa-procedures' : 'fa-briefcase'} mr-2`}></i>Criar {currentType}</span><span className="text-[9px] text-slate-400 font-bold uppercase">Gera ID Automático</span></div>
                                    )}
                                </>
                            ) : (
                                <div className="flex-1">
                                    <Autocomplete 
                                        options={(activeTab === 'people' || activeTab === 'attendees') ? officialStaffOptions : officialSectorOptions}
                                        value={targetMap[name] || ''}
                                        onChange={(val) => setTargetMap(prev => ({...prev, [name]: val}))}
                                        onSelectOption={(label) => setTargetMap(prev => ({...prev, [name]: label}))}
                                        placeholder={(activeTab === 'people' || activeTab === 'attendees') ? "Buscar no RH (Inclui Inativos)..." : "Selecione o Setor Oficial..."}
                                        className={`w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all ${activeTab === 'attendees' ? 'focus:border-violet-500 group-hover:border-violet-200' : activeTab === 'people' ? 'focus:border-rose-500 group-hover:border-rose-200' : 'focus:border-blue-500 group-hover:border-blue-200'}`}
                                    />
                                </div>
                            )}
                            
                            <button 
                                onClick={() => activeTab === 'sectors' ? handleHealSector(name) : handleProcessPerson(name)}
                                disabled={(!targetMap[name] && (activeTab !== 'people' || currentType === 'Colaborador')) || (activeTab === 'people' && currentType === 'Ex-Colaborador' && !sectorMap[name]) || isProcessing}
                                className={`px-8 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap 
                                    ${activeTab === 'attendees' ? 'bg-violet-500 hover:bg-violet-600' : activeTab === 'people' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                            >
                                {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check-circle"></i>}
                                <span>{(activeTab === 'people' && currentType !== 'Colaborador') ? (currentType === 'Ex-Colaborador' ? 'Criar Inativo' : 'Criar & Vincular') : (activeTab === 'attendees' ? 'Vincular' : 'Unificar')}</span>
                            </button>
                        </div>
                    </div>
                  );
              })
          )}
        </div>
      </div>
    </div>
  );
};

export default DataHealer;
