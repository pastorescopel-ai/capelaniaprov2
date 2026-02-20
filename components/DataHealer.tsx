
import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { normalizeString } from '../utils/formatters';
import { ParticipantType } from '../types';
import Autocomplete from './Shared/Autocomplete';

const DataHealer: React.FC = () => {
  const { bibleClasses, bibleStudies, staffVisits, proStaff, proSectors, unifyStudentIdentity } = useApp();
  const { showToast } = useToast();
  
  const [targetMap, setTargetMap] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // --- LÓGICA DE DIAGNÓSTICO GLOBAL (AGORA COM SETORES) ---
  const orphans = useMemo(() => {
    // Mapa: Nome do Órfão -> Conjunto de Setores onde foi visto
    const orphanMap = new Map<string, Set<string>>();
    
    // Cria um Set de nomes normalizados do RH para comparação rápida
    const officialNamesNormalized = new Set(proStaff.map(s => normalizeString(s.name)));
    
    // Helper para verificar e adicionar
    const checkAndAdd = (rawName: string, sourceSector?: string) => {
        if (!rawName) return;
        const cleanName = rawName.split(' (')[0].trim();
        const norm = normalizeString(cleanName);
        
        // Se não está no RH e não tem matrícula válida no texto
        if (!officialNamesNormalized.has(norm) && !rawName.match(/\(\d+\)$/)) {
            if (!orphanMap.has(cleanName)) {
                orphanMap.set(cleanName, new Set());
            }
            if (sourceSector && sourceSector.trim()) {
                orphanMap.get(cleanName)!.add(sourceSector.trim());
            }
        }
    };

    // 1. Varredura em Classes Bíblicas
    bibleClasses.forEach(cls => {
        if (cls.students && Array.isArray(cls.students)) {
            cls.students.forEach(student => checkAndAdd(student, cls.sector));
        }
    });

    // 2. Varredura em Estudos Bíblicos (Apenas Colaboradores)
    bibleStudies.forEach(study => {
        if (study.participantType === ParticipantType.STAFF || !study.participantType) {
            checkAndAdd(study.name, study.sector);
        }
    });

    // 3. Varredura em Visitas (Apenas Colaboradores)
    staffVisits.forEach(visit => {
        if (visit.participantType === ParticipantType.STAFF || !visit.participantType) { // Fallback para staff se undefined
            checkAndAdd(visit.staffName, visit.sector);
        }
    });
    
    // Converte o Mapa para Array ordenado para renderização
    return Array.from(orphanMap.entries())
        .map(([name, sectorSet]) => ({
            name,
            sectors: Array.from(sectorSet).sort()
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

  }, [bibleClasses, bibleStudies, staffVisits, proStaff]);

  // --- OPÇÕES PARA O AUTOCOMPLETE (Oficiais do RH) ---
  const officialStaffOptions = useMemo(() => {
      return proStaff.map(s => {
          const idStr = String(s.id).replace(/\D/g, '');
          return {
              value: s.id, 
              label: `${s.name} (${idStr})`,
              subLabel: proSectors.find(sec => sec.id === s.sectorId)?.name || 'Sem Setor',
              category: 'RH' as const
          };
      });
  }, [proStaff, proSectors]);

  // --- AÇÃO DE CURA GLOBAL ---
  const handleHeal = async (orphanName: string) => {
      const targetLabel = targetMap[orphanName]; // Ex: "João Silva (1020)"
      if (!targetLabel) return;
      
      const targetId = targetLabel.match(/\((\d+)\)$/)?.[1]; // Extrai "1020"
      if (!targetId) {
          showToast("Selecione um colaborador com matrícula válida (escolha na lista).", "warning");
          return;
      }

      setIsProcessing(true);
      try {
          // Chama a função que agora atualiza TODAS as tabelas
          const result = await unifyStudentIdentity(orphanName, targetId);
          showToast(result, "success");
          
          // Limpa o mapeamento local para atualizar a UI
          setTargetMap(prev => { 
              const n = {...prev}; 
              delete n[orphanName]; 
              return n; 
          });
      } catch (e: any) {
          showToast("Erro ao curar dados: " + e.message, "warning");
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32 max-w-5xl mx-auto">
      
      {/* HEADER DA FERRAMENTA */}
      <div className="bg-rose-50 border-l-8 border-rose-500 p-8 rounded-r-[3rem] shadow-sm flex items-center justify-between">
        <div>
            <h2 className="text-3xl font-black text-rose-900 uppercase tracking-tighter flex items-center gap-3">
            <i className="fas fa-hospital-user"></i> Centro de Cura Global
            </h2>
            <p className="text-rose-800 text-xs font-bold mt-2 uppercase tracking-widest leading-relaxed">
            Unificação de nomes em Classes, Estudos e Visitas Pastorais.
            </p>
        </div>
        <div className="text-center bg-white/50 p-4 rounded-2xl border border-rose-200">
            <span className="block text-4xl font-black text-rose-600">{orphans.length}</span>
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Nomes Pendentes</span>
        </div>
      </div>

      {/* LISTA DE TRATAMENTO */}
      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Fila de Tratamento</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase"><i className="fas fa-info-circle mr-1"></i> A correção será aplicada em todo o histórico</span>
        </div>
        
        <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto custom-scrollbar">
          {orphans.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-4xl animate-bounce">
                      <i className="fas fa-check-double"></i>
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-sm tracking-widest">
                      Banco de dados 100% higienizado!
                  </p>
              </div>
          ) : (
              orphans.map((orphanData, index) => (
              <div key={index} className="p-6 flex flex-col lg:flex-row items-center gap-6 hover:bg-slate-50 transition-colors group">
                  
                  {/* LADO ESQUERDO: O PROBLEMA */}
                  <div className="flex-1 w-full lg:w-auto">
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[9px] font-black uppercase mb-2">
                          <i className="fas fa-exclamation-triangle"></i> Não Oficial
                      </span>
                      <div className="font-black text-slate-800 uppercase text-lg leading-tight">{orphanData.name}</div>
                      
                      {/* NOVA LINHA: EXIBIÇÃO DOS SETORES */}
                      <div className="text-[10px] text-slate-500 font-bold mt-2 flex items-start gap-2 bg-white/50 p-2 rounded-lg border border-slate-100">
                           <i className="fas fa-map-marker-alt text-rose-400 mt-0.5"></i>
                           <span>
                             {orphanData.sectors.length > 0 
                               ? `Visto em: ${orphanData.sectors.join(', ')}` 
                               : <span className="italic text-slate-400">Local não registrado</span>}
                           </span>
                      </div>
                  </div>

                  {/* CENTRO: A SETA */}
                  <div className="hidden lg:block text-slate-300">
                      <i className="fas fa-arrow-right text-xl group-hover:text-blue-400 transition-colors"></i>
                  </div>

                  {/* LADO DIREITO: A SOLUÇÃO */}
                  <div className="flex-1 w-full lg:w-auto flex flex-col md:flex-row gap-3">
                      <div className="flex-1">
                          <Autocomplete 
                              options={officialStaffOptions}
                              value={targetMap[orphanData.name] || ''}
                              onChange={(val) => setTargetMap(prev => ({...prev, [orphanData.name]: val}))}
                              onSelectOption={(label) => setTargetMap(prev => ({...prev, [orphanData.name]: label}))}
                              placeholder="Vincular ao Cadastro RH..."
                              className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm focus:border-blue-500 outline-none shadow-sm group-hover:border-blue-200 transition-all"
                          />
                      </div>
                      <button 
                          onClick={() => handleHeal(orphanData.name)}
                          disabled={!targetMap[orphanData.name] || isProcessing}
                          className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                      >
                          {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-band-aid"></i>}
                          <span>Unificar</span>
                      </button>
                  </div>
              </div>
          )))}
        </div>
      </div>
    </div>
  );
};

export default DataHealer;
