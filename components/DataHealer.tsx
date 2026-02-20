
import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { normalizeString } from '../utils/formatters';
import { ParticipantType, ProStaff } from '../types';
import Autocomplete from './Shared/Autocomplete';

type HealerTab = 'people' | 'sectors';
type PersonType = 'Colaborador' | 'Ex-Colaborador' | 'Paciente' | 'Prestador';

const DataHealer: React.FC = () => {
  const { bibleClasses, bibleStudies, smallGroups, staffVisits, proStaff, proSectors, unifyStudentIdentity, createAndLinkIdentity, healSectorConnection, saveRecord } = useApp();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<HealerTab>('people');
  const [targetMap, setTargetMap] = useState<Record<string, string>>({});
  const [sectorMap, setSectorMap] = useState<Record<string, string>>({}); // Para selecionar setor do Ex-Colaborador
  
  // Estado local para armazenar o tipo selecionado para cada registro
  const [personTypeMap, setPersonTypeMap] = useState<Record<string, PersonType>>({});
  
  // Estado para UX Otimista: Itens resolvidos somem da tela imediatamente
  const [resolvedItems, setResolvedItems] = useState<Set<string>>(new Set());
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // --- LÓGICA DE DIAGNÓSTICO: PESSOAS ÓRFÃS ---
  const peopleOrphans = useMemo(() => {
    const orphanMap = new Map<string, Set<string>>();
    const officialNamesNormalized = new Set(proStaff.map(s => normalizeString(s.name)));
    
    // Função auxiliar para verificar e adicionar à lista
    const checkAndAdd = (rawName: string, sourceSector?: string, type?: string) => {
        if (!rawName) return;
        
        const cleanName = rawName.split(' (')[0].trim();
        
        // FILTRO OTIMISTA: Se já foi resolvido nesta sessão, ignora
        if (resolvedItems.has(cleanName)) return;

        const norm = normalizeString(cleanName);
        
        // Se NÃO estiver na lista oficial OU se o usuário quiser ver todos
        // E se não for explicitamente Paciente/Prestador já resolvido
        if ((!officialNamesNormalized.has(norm) || showAllHistory) && !rawName.match(/\(\d+\)$/)) {
            // Se for paciente/prestador, só mostra se o usuário pedir 'showAllHistory' ou se tiver algum erro
            if (type && type !== 'Colaborador' && !showAllHistory) return;

            if (!orphanMap.has(cleanName)) orphanMap.set(cleanName, new Set());
            if (sourceSector && sourceSector.trim()) orphanMap.get(cleanName)!.add(sourceSector.trim());
        }
    };

    // Varre ALUNOS
    bibleClasses.forEach(cls => {
        // Alunos de classe não tem 'participantType' explícito na tabela antiga, assume-se Colaborador ou Paciente
        cls.students?.forEach(s => checkAndAdd(s, cls.sector, 'Colaborador'));
    });

    // Varre ESTUDOS (Verifica staff_id nulo implicitamente pela lógica do componente pai ou filtro aqui)
    bibleStudies.forEach(s => { 
        // Filtra: Só mostra se staff_id for nulo (pendente) OU se for um tipo 'Colaborador' sem match
        // Para simplificar: mostramos nomes que não batem com RH.
        if (s.participantType === ParticipantType.STAFF || !s.participantType || showAllHistory) {
             checkAndAdd(s.name, s.sector, s.participantType); 
        }
    });

    // Varre VISITAS
    staffVisits.forEach(v => { 
        if (v.participantType === ParticipantType.STAFF || !v.participantType || showAllHistory) {
            checkAndAdd(v.staffName, v.sector, v.participantType);
        }
    });
    
    return Array.from(orphanMap.entries())
        .map(([name, sectorSet]) => ({ name, sectors: Array.from(sectorSet).sort() }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [bibleClasses, bibleStudies, staffVisits, proStaff, showAllHistory, resolvedItems]);

  // --- LÓGICA DE DIAGNÓSTICO: SETORES ÓRFÃOS ---
  const sectorOrphans = useMemo(() => {
      const historySet = new Set<string>();
      const officialNamesNormalized = new Set(proSectors.map(s => normalizeString(s.name)));

      const checkSector = (sector: string) => {
          if (!sector) return;
          const clean = sector.trim();
          if (!clean) return;
          
          // FILTRO OTIMISTA
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

  // --- OPÇÕES AUTOCOMPLETE (ATUALIZADO: INCLUI INATIVOS) ---
  const officialStaffOptions = useMemo(() => {
      return proStaff.map(s => {
          const idStr = String(s.id).replace(/\D/g, '');
          const isInactive = s.active === false;
          
          return {
              value: s.id, 
              // Adiciona etiqueta visual se estiver inativo para facilitar a busca histórica
              label: `${s.name} (${idStr})${isInactive ? ' ⚠️ [INATIVO]' : ''}`,
              subLabel: proSectors.find(sec => sec.id === s.sectorId)?.name || 'Sem Setor',
              category: 'RH' as const
          };
      });
  }, [proStaff, proSectors]);

  const officialSectorOptions = useMemo(() => {
      return proSectors.map(s => ({
          value: s.name, // CORREÇÃO: Valor deve ser o nome para exibição e busca
          label: `${s.name}`,
          subLabel: `Unidade ${s.unit}`,
          category: 'RH' as const
      }));
  }, [proSectors]);

  // --- AÇÕES ---
  const handleProcessPerson = async (orphanName: string) => {
      const selectedType = personTypeMap[orphanName] || 'Colaborador';

      if (selectedType === 'Colaborador') {
          // Lógica de Vínculo com RH Existente
          const targetLabel = targetMap[orphanName];
          if (!targetLabel) { showToast("Selecione o colaborador correspondente no RH.", "warning"); return; }
          const targetId = targetLabel.match(/\((\d+)\)/)?.[1]; // Pega apenas os números dentro dos parênteses
          if (!targetId) { showToast("Matrícula inválida.", "warning"); return; }

          setIsProcessing(true);
          try {
              const result = await unifyStudentIdentity(orphanName, targetId);
              showToast(result, "success");
              
              setResolvedItems(prev => new Set(prev).add(orphanName));
              setTargetMap(prev => { const n = {...prev}; delete n[orphanName]; return n; });
          } catch (e: any) { showToast("Erro: " + e.message, "warning"); } 
          finally { setIsProcessing(false); }

      } else if (selectedType === 'Ex-Colaborador') {
          // Lógica de Criação de Inativo (Legacy)
          const sectorName = sectorMap[orphanName];
          const sector = proSectors.find(s => s.name === sectorName);
          
          if (!sector) { showToast("Selecione um setor para vincular o histórico do ex-colaborador.", "warning"); return; }
          
          if (!confirm(`Criar registro de inativo para "${orphanName}" no setor ${sector.name}?`)) return;

          setIsProcessing(true);
          try {
              // 1. Gera ID Legado (Faixa 7B)
              const legacyId = (7000000000 + Math.floor(Math.random() * 1000000)).toString();
              
              // 2. Cria no Banco
              const newLegacyStaff: ProStaff = {
                  id: legacyId,
                  name: orphanName,
                  sectorId: sector.id,
                  unit: sector.unit,
                  active: false, // MARCA COMO INATIVO
                  updatedAt: Date.now()
              };
              
              await saveRecord('proStaff', newLegacyStaff);

              // 3. Vincula Histórico
              const result = await unifyStudentIdentity(orphanName, legacyId);
              
              showToast(`Ex-Colaborador criado! ${result}`, "success");
              setResolvedItems(prev => new Set(prev).add(orphanName));
              setSectorMap(prev => { const n = {...prev}; delete n[orphanName]; return n; });

          } catch (e: any) { showToast("Erro: " + e.message, "warning"); }
          finally { setIsProcessing(false); }

      } else {
          // Lógica de Conversão (Paciente ou Prestador) -> CRIA REGISTRO COM ID ALTO
          if (!confirm(`Confirma que "${orphanName}" é um ${selectedType}? Um novo registro será criado com ID especial e vinculado ao histórico.`)) return;
          
          setIsProcessing(true);
          try {
              const result = await createAndLinkIdentity(orphanName, selectedType);
              showToast(result, "success");
              
              // REMOÇÃO OTIMISTA
              setResolvedItems(prev => new Set(prev).add(orphanName));
          } catch (e: any) { showToast("Erro: " + e.message, "warning"); }
          finally { setIsProcessing(false); }
      }
  };

  const handleHealSector = async (badName: string) => {
      const targetLabel = targetMap[badName];
      const selectedSector = proSectors.find(s => s.name === targetLabel);
      
      if (!selectedSector) { 
          showToast("Selecione um setor oficial da lista.", "warning"); 
          return; 
      }

      setIsProcessing(true);
      try {
          const result = await healSectorConnection(badName, selectedSector.id);
          showToast(result, "success");
          
          // REMOÇÃO OTIMISTA
          setResolvedItems(prev => new Set(prev).add(badName));
          
          setTargetMap(prev => { const n = {...prev}; delete n[badName]; return n; });
      } catch (e: any) { showToast("Erro: " + e.message, "warning"); }
      finally { setIsProcessing(false); }
  };

  const currentTheme = activeTab === 'people' ? 'rose' : 'blue';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32 max-w-5xl mx-auto">
      
      {/* HEADER DINÂMICO */}
      <div className={`bg-${currentTheme}-50 border-l-8 border-${currentTheme}-500 p-8 rounded-r-[3rem] shadow-sm flex items-center justify-between transition-colors duration-500`}>
        <div>
            <h2 className={`text-3xl font-black text-${currentTheme}-900 uppercase tracking-tighter flex items-center gap-3`}>
            <i className={`fas ${activeTab === 'people' ? 'fa-user-nurse' : 'fa-map-marked-alt'}`}></i> 
            Centro de Cura {activeTab === 'people' ? 'de Pessoas' : 'de Setores'}
            </h2>
            <p className={`text-${currentTheme}-800 text-xs font-bold mt-2 uppercase tracking-widest leading-relaxed`}>
            {activeTab === 'people' 
                ? 'Unificação de nomes e criação de identidades (IDs especiais).' 
                : 'Correção de nomes de setores e vínculo com IDs oficiais.'}
            </p>
        </div>
        <div className={`text-center bg-white/50 p-4 rounded-2xl border border-${currentTheme}-200`}>
            <span className={`block text-4xl font-black text-${currentTheme}-600`}>
                {activeTab === 'people' ? peopleOrphans.length : sectorOrphans.length}
            </span>
            <span className={`text-[10px] font-black text-${currentTheme}-400 uppercase tracking-widest`}>Pendentes</span>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 max-w-md mx-auto">
          <button 
            onClick={() => { setActiveTab('people'); setTargetMap({}); setPersonTypeMap({}); }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'people' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <i className="fas fa-users"></i> Pessoas
          </button>
          <button 
            onClick={() => { setActiveTab('sectors'); setTargetMap({}); }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'sectors' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <i className="fas fa-building"></i> Setores
          </button>
      </div>

      {/* CONTROLE DE FILTRO (Apenas para Pessoas) */}
      {activeTab === 'people' && (
          <div className="flex justify-center">
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors">
                  <input type="checkbox" checked={showAllHistory} onChange={e => setShowAllHistory(e.target.checked)} className="rounded text-rose-500 focus:ring-rose-500" />
                  <span className="text-[10px] font-black uppercase text-slate-500">Exibir todos (Mesmo os que parecem corretos)</span>
              </label>
          </div>
      )}

      {/* LISTA DE TRATAMENTO */}
      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Fila de Tratamento</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase"><i className="fas fa-magic mr-1"></i> Correção em massa no histórico</span>
        </div>
        
        <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto custom-scrollbar pb-72">
          {(activeTab === 'people' ? peopleOrphans : sectorOrphans).length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-4xl animate-bounce">
                      <i className="fas fa-check-double"></i>
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-sm tracking-widest">
                      Nenhum registro pendente nesta categoria!
                  </p>
              </div>
          ) : (
              (activeTab === 'people' ? peopleOrphans : sectorOrphans).map((item, index) => {
                  const name = activeTab === 'people' ? (item as any).name : (item as string);
                  const sectors = activeTab === 'people' ? (item as any).sectors : [];
                  const currentType = personTypeMap[name] || 'Colaborador';

                  return (
                    <div key={index} className="p-6 flex flex-col xl:flex-row items-center gap-6 hover:bg-slate-50 transition-colors group">
                        
                        {/* LADO ESQUERDO: O PROBLEMA */}
                        <div className="flex-1 w-full xl:w-1/3">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[9px] font-black uppercase">
                                    <i className="fas fa-exclamation-triangle"></i> {activeTab === 'people' ? 'Registro Pendente' : 'Setor Inválido'}
                                </span>
                                {activeTab === 'people' && (
                                    <div className="flex flex-wrap bg-slate-200 rounded-lg p-0.5">
                                        {(['Colaborador', 'Ex-Colaborador', 'Paciente', 'Prestador'] as PersonType[]).map(t => (
                                            <button 
                                                key={t}
                                                onClick={() => setPersonTypeMap(prev => ({...prev, [name]: t}))}
                                                className={`px-2 py-1 rounded-md text-[7px] font-bold uppercase transition-all whitespace-nowrap ${currentType === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <div className="font-black text-slate-800 uppercase text-lg leading-tight">{name}</div>
                            
                            {activeTab === 'people' && (
                                <div className="text-[10px] text-slate-500 font-bold mt-2 flex items-start gap-2 bg-white/50 p-2 rounded-lg border border-slate-100">
                                    <i className="fas fa-map-marker-alt text-rose-400 mt-0.5"></i>
                                    <span>
                                        {sectors.length > 0 ? `Visto em: ${sectors.join(', ')}` : <span className="italic text-slate-400">Local não registrado</span>}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* CENTRO: A SETA */}
                        <div className="hidden xl:block text-slate-300">
                            <i className={`fas fa-arrow-right text-xl transition-colors ${activeTab === 'people' ? 'group-hover:text-rose-400' : 'group-hover:text-blue-400'}`}></i>
                        </div>

                        {/* LADO DIREITO: A SOLUÇÃO */}
                        <div className="flex-1 w-full xl:w-2/3 flex flex-col md:flex-row gap-3">
                            {activeTab === 'people' && currentType !== 'Colaborador' ? (
                                <>
                                    {currentType === 'Ex-Colaborador' ? (
                                        <div className="flex-1">
                                            <Autocomplete 
                                                options={officialSectorOptions}
                                                value={sectorMap[name] || ''}
                                                onChange={(val) => setSectorMap(prev => ({...prev, [name]: val}))}
                                                onSelectOption={(val) => setSectorMap(prev => ({...prev, [name]: val}))}
                                                placeholder="Selecione o Último Setor Conhecido..."
                                                className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-rose-500"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex-1 p-4 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-600 uppercase">
                                                <i className={`fas ${currentType === 'Paciente' ? 'fa-procedures' : 'fa-briefcase'} mr-2`}></i>
                                                Criar {currentType}
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">Gera ID Automático</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex-1">
                                    <Autocomplete 
                                        options={activeTab === 'people' ? officialStaffOptions : officialSectorOptions}
                                        value={targetMap[name] || ''}
                                        onChange={(val) => setTargetMap(prev => ({...prev, [name]: val}))}
                                        onSelectOption={(label) => setTargetMap(prev => ({...prev, [name]: label}))}
                                        placeholder={activeTab === 'people' ? "Buscar no RH (Inclui Inativos)..." : "Selecione o Setor Oficial..."}
                                        className={`w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all ${activeTab === 'people' ? 'focus:border-rose-500 group-hover:border-rose-200' : 'focus:border-blue-500 group-hover:border-blue-200'}`}
                                    />
                                </div>
                            )}
                            
                            <button 
                                onClick={() => activeTab === 'people' ? handleProcessPerson(name) : handleHealSector(name)}
                                disabled={(activeTab === 'people' && currentType === 'Colaborador' && !targetMap[name]) || (activeTab === 'sectors' && !targetMap[name]) || (activeTab === 'people' && currentType === 'Ex-Colaborador' && !sectorMap[name]) || isProcessing}
                                className={`px-8 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'people' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                            >
                                {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check-circle"></i>}
                                <span>{activeTab === 'people' && currentType !== 'Colaborador' ? (currentType === 'Ex-Colaborador' ? 'Criar Inativo' : 'Criar & Vincular') : 'Unificar'}</span>
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
