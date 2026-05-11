
import React, { useState, useMemo } from 'react';
import { Unit, ProGroupMember, ProGroupProviderMember } from '../../types';
import { usePro } from '../../contexts/ProContext';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { cleanID } from '../../utils/formatters';

interface PGDuplicateResolverProps {
  unit: Unit;
}

const PGDuplicateResolver: React.FC<PGDuplicateResolverProps> = ({ unit }) => {
  const { proGroupMembers, proGroupProviderMembers, proGroups, proStaff, proProviders } = usePro();
  const { saveRecord, config } = useApp();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisMonth, setAnalysisMonth] = useState(config.activeCompetenceMonth || new Date().toISOString().split('T')[0].substring(0, 7) + '-01');

  // ID Cleaning helper
  const clean = cleanID;

  const duplicates = useMemo(() => {
    const unitGroups = new Set(proGroups.filter(g => g.unit === unit).map(g => g.id));
    const staffMap = new Map(proStaff.filter(s => s.unit === unit).map(s => [cleanID(s.id), s.name]));
    const providerMap = new Map(proProviders.filter(p => p.unit === unit).map(p => [cleanID(p.id), p.name]));
    const groupNameMap = new Map(proGroups.filter(g => g.unit === unit).map(g => [g.id, g.name]));

    const findDuplicates = (members: any[], idField: string, nameMap: Map<string, string>, type: 'staff' | 'provider') => {
      const activeByPerson = new Map<string, any[]>();
      
      members.forEach(m => {
        if (m.cycleMonth === analysisMonth && !m.leftAt && !m.isError && unitGroups.has(m.groupId)) {
          const personId = cleanID(m[idField]);
          if (!activeByPerson.has(personId)) activeByPerson.set(personId, []);
          activeByPerson.get(personId)?.push(m);
        }
      });

      const results: any[] = [];
      activeByPerson.forEach((records, personId) => {
        if (records.length > 1) {
          results.push({
            personId,
            name: nameMap.get(personId) || `Colaborador (${personId})`,
            type,
            records: records.map(r => ({
              id: r.id,
              groupId: r.groupId,
              groupName: groupNameMap.get(r.groupId) || `PG ${r.groupId}`,
              joinedAt: r.joinedAt
            }))
          });
        }
      });
      return results;
    };

    return [
      ...findDuplicates(proGroupMembers, 'staffId', staffMap, 'staff'),
      ...findDuplicates(proGroupProviderMembers, 'providerId', providerMap, 'provider')
    ];
  }, [proGroupMembers, proGroupProviderMembers, proGroups, proStaff, proProviders, unit, analysisMonth]);

  const handleResolve = async (personId: string, keepRecordId: string, type: 'staff' | 'provider') => {
    const person = duplicates.find(d => d.personId === personId && d.type === type);
    if (!person) return;

    setIsProcessing(true);
    try {
      const collection = type === 'staff' ? 'proGroupMembers' : 'proGroupProviderMembers';
      const membersList = type === 'staff' ? proGroupMembers : proGroupProviderMembers;
      
      // Encontra todos os registros ativos desta pessoa no mês
      const recordsToProcess = membersList.filter(m => 
        clean(m[type === 'staff' ? 'staffId' : 'providerId']) === clean(personId) && 
        m.cycleMonth === analysisMonth && 
        !m.leftAt && 
        !m.isError
      );

      const updates = recordsToProcess.map(r => {
        if (r.id === keepRecordId) return null; // Mantém intacto
        return {
          ...r,
          leftAt: 1, // "Mata" retroativamente
          isError: true,
          updatedAt: Date.now()
        };
      }).filter(Boolean) as any[];

      if (updates.length > 0) {
        const success = await saveRecord(collection, updates);
        if (success) {
          showToast(`Inconsistência resolvida para ${person.name}!`, "success");
        }
      }
    } catch (e) {
      showToast("Erro ao resolver duplicidade.", "warning");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderMonthSelector = () => (
    <div className="flex flex-col sm:flex-row gap-4 items-center mb-8 bg-white/50 p-4 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs">
          <i className="fas fa-calendar-alt"></i>
        </div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mês de Análise</p>
      </div>
      <input 
        type="month" 
        value={analysisMonth.substring(0, 7)}
        onChange={(e) => setAnalysisMonth(e.target.value + '-01')}
        className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-xs font-black uppercase text-slate-800 focus:border-slate-800 outline-none transition-all shadow-sm"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {renderMonthSelector()}

      {duplicates.length === 0 ? (
        <div className="bg-emerald-50/50 p-8 rounded-[3rem] border border-emerald-100 flex items-center gap-6 animate-in fade-in duration-500">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-xl shadow-sm">
            <i className="fas fa-check-shield"></i>
          </div>
          <div>
            <h2 className="text-lg font-black text-emerald-900 uppercase tracking-tighter">Base de Dados Íntegra</h2>
            <p className="text-[10px] text-emerald-700/60 font-bold uppercase tracking-widest">Nenhuma duplicidade de matrícula detectada em {new Date(analysisMonth + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      ) : (
        <div className="bg-rose-50 p-8 rounded-[3rem] border border-rose-100 shadow-sm animate-in slide-in-from-bottom duration-500">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg shadow-rose-200">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div>
              <h2 className="text-xl font-black text-rose-900 uppercase tracking-tighter">Inconsistências Detectadas</h2>
              <p className="text-[10px] text-rose-700/60 font-bold uppercase tracking-widest">{duplicates.length} Colaboradores em mais de um PG no mês de {new Date(analysisMonth + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="space-y-4">
            {duplicates.map((dup) => (
              <div key={`${dup.type}-${dup.personId}`} className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${dup.type === 'staff' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {dup.type === 'staff' ? 'CLT' : 'Prestador'}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase">ID: {dup.personId}</span>
                  </div>
                  <h4 className="font-black text-slate-800 uppercase text-sm">{dup.name}</h4>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">Este colaborador está matriculado simultaneamente nos PGs abaixo:</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {dup.records.map((rec: any) => (
                    <div key={rec.id} className="flex flex-col gap-2">
                      <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 min-w-[200px]">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pequeno Grupo</p>
                        <p className="text-xs font-black text-slate-700 uppercase">{rec.groupName}</p>
                        {rec.joinedAt && (
                          <p className="text-[8px] text-slate-400 font-bold mt-1">
                            Desde: {new Date(rec.joinedAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleResolve(dup.personId, rec.id, dup.type)}
                        disabled={isProcessing}
                        className="w-full py-2 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-lg shadow-md hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                      >
                        Manter neste PG
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PGDuplicateResolver;
