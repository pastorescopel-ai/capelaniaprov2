
import React, { useMemo, useState } from 'react';
import { Unit } from '../../types';
import { usePro } from '../../contexts/ProContext';
import { useApp } from '../../hooks/useApp';
import { auditStaffData } from '../../utils/staffAuditLogic';
import { useToast } from '../../contexts/ToastContext';

interface StaffAuditorProps {
  unit: Unit;
}

const StaffAuditor: React.FC<StaffAuditorProps> = ({ unit }) => {
  const { proStaff, saveRecord, proMonthlyStats } = usePro();
  const { showToast } = useToast();
  const [isCleaning, setIsCleaning] = useState(false);
  const { config } = useApp();

  const expectedValues = useMemo(() => ({
    'HAB': 1514,
    'HABA': 178
  } as Record<string, number>), []);

  const audit = useMemo(() => {
    return auditStaffData(unit, proStaff, expectedValues[unit] || 0);
  }, [unit, proStaff, expectedValues]);

  const handleDeactivateDuplicate = async (id: string, name: string) => {
    if (!confirm(`Deseja marcar o registro "${name}" (ID: ${id}) como INATIVO?\nIsso removerá ele da contagem do dashboard.`)) return;
    setIsCleaning(true);
    try {
      const record = proStaff.find(s => String(s.id) === String(id));
      if (record) {
        await saveRecord('proStaff', { ...record, active: false, leftAt: Date.now() });
        showToast("Registro desativado com sucesso.", "success");
      }
    } catch (e) {
      showToast("Erro ao desativar registro.", "error");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleBulkFix = async () => {
    if (!confirm(`ATENÇÃO: Você deseja tentar sincronizar a contagem de ${audit.dbCount} para ${audit.expectedCount}?\n\nIsso desativará ${audit.duplicates.length} grupos de registros duplicados identificados.`)) return;
    
    setIsCleaning(true);
    try {
      let cleaned = 0;
      for (const dup of audit.duplicates) {
        // Mantém apenas o primeiro
        const toDeactivate = dup.records.slice(1);
        for (const rec of toDeactivate) {
          await saveRecord('proStaff', { ...rec, active: false, leftAt: Date.now() });
          cleaned++;
        }
      }
      showToast(`${cleaned} duplicatas desativadas com sucesso.`, "success");
    } catch (e) {
      showToast("Erro no processamento em massa.", "error");
    } finally {
      setIsCleaning(false);
    }
  };

  const copySQLAudit = () => {
    const sql = `-- 1. RASTREIO DE DUPLICATAS ATIVAS (POR NOME/UNIDADE)
-- Este script identifica quem está sendo contado mais de uma vez na unidade selecionada
SELECT 
  unit, 
  name, 
  count(*) as ocorrencias, 
  array_agg(id) as IDs_detectados
FROM pro_staff
WHERE active = true 
  AND unit = '${unit}'
GROUP BY unit, name
HAVING count(*) > 1;

-- 2. CONTAGEM REAL (ABRIL/2026) - ESPELHO DO DASHBOARD
-- Este script deve retornar exatamente 1514 (HAB) ou 178 (HABA)
SELECT 
  unit, 
  count(DISTINCT id) as total_colaboradores_reais
FROM pro_staff
WHERE unit = '${unit}' 
  AND active = true
  AND (created_at <= '2026-04-30T23:59:59Z' OR created_at IS NULL)
  AND (left_at > '2026-04-01T00:00:00Z' OR left_at IS NULL)
GROUP BY unit;

-- 3. VALIDAR IDs COM MÚLTIPLAS UNIDADES (CAUSA DE INFLAÇÃO)
SELECT id, name, count(DISTINCT unit) as unidades
FROM pro_staff
WHERE active = true
GROUP BY id, name
HAVING count(DISTINCT unit) > 1;`;
    
    navigator.clipboard.writeText(sql);
    showToast("Script SQL de Rastreio (Abril) copiado!", "info");
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50"></div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[8px] font-black uppercase tracking-widest border border-blue-500/30">
                Tracking de Integridade
              </span>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Sistema de Rastreio Supabase</h3>
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight">Rastreador de Inconsistências</h2>
            <p className="text-slate-400 text-xs font-bold mt-1">Auditando por que o Dashboard mostra <span className="text-rose-400">{audit.dbCount}</span> em vez de <span className="text-blue-400">{audit.expectedCount}</span></p>
          </div>

          <div className="flex gap-4">
             <div className="text-center px-6 py-5 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-md">
                <span className="block text-3xl font-black text-white">{audit.expectedCount}</span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Planilha Mestre</span>
             </div>
             <div className={`text-center px-6 py-5 rounded-[2rem] border backdrop-blur-md ${audit.difference === 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                <span className={`block text-3xl font-black ${audit.difference === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {audit.dbCount}
                </span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Banco Supabase</span>
             </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 items-center">
            {audit.difference !== 0 && (
                <div className="flex-1 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                        <i className="fas fa-search-location"></i>
                    </div>
                    <p className="text-xs font-bold text-rose-200">
                        Detectamos <span className="text-white font-black">{Math.abs(audit.difference)}</span> registros divergentes. 
                        {audit.duplicates.length > 0 && ` Sendo ${audit.duplicates.reduce((acc, d) => acc + d.records.length - 1, 0)} duplicatas óbvias.`}
                    </p>
                </div>
            )}
            
            <div className="flex gap-2">
                <button 
                  onClick={copySQLAudit}
                  className="px-6 py-4 bg-slate-800 text-slate-300 font-bold rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 border border-slate-700"
                >
                  <i className="fas fa-terminal"></i> Script SQL de Rastreio
                </button>
                
                {audit.duplicates.length > 0 && (
                    <button 
                      onClick={handleBulkFix}
                      disabled={isCleaning}
                      className="px-6 py-4 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
                    >
                      <i className={`fas ${isCleaning ? 'fa-circle-notch fa-spin' : 'fa-magic'}`}></i>
                      Corrigir Ativos
                    </button>
                )}
            </div>
        </div>
      </div>

      {audit.crossUnitDuplicates.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-rose-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-base-50 flex items-center justify-center text-rose-600 border border-rose-100">
              <i className="fas fa-random text-xs"></i>
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-800 uppercase tracking-tight">Rastreado: Conflito de Unidade (Transferências)</h4>
              <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">Mesma matrícula ativa em múltiplas unidades</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {audit.crossUnitDuplicates.map((dup, i) => (
              <div key={i} className="p-4 bg-rose-50/30 border border-rose-100 rounded-2xl">
                <h5 className="font-black text-slate-800 text-sm uppercase">{dup.name}</h5>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] font-black bg-white px-2 py-1 rounded border border-rose-200 text-rose-600">ID: {dup.id}</span>
                  <div className="flex gap-1">
                    {dup.units.map(u => (
                      <span key={u} className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${u === unit ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                        {u}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-[9px] font-bold text-rose-400 mt-2 italic">Atenção: Este colaborador está inflando a contagem de ambas as unidades simultaneamente.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {audit.futureRecords.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-blue-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
              <i className="fas fa-forward text-xs"></i>
            </div>
            <div>
              <h4 className="text-sm font-black text-blue-800 uppercase tracking-tight">Rastreado: Registros Criados em Maio</h4>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Colaboradores criados após 30/04 mas aparecendo em Abril</p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl">
            <p className="text-[10px] text-slate-500 font-medium italic mb-3">
              Estes registros foram criados após 30/04/2026. Se eles aparecem em Abril, é devido ao filtro de redundância de migração do dashboard.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {audit.futureRecords.slice(0, 8).map((s, idx) => (
                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                  {s.name}
                </div>
              ))}
            </div>
            {audit.futureRecords.length > 8 && <p className="text-[10px] text-blue-500 font-black mt-2">+{audit.futureRecords.length - 8} outros</p>}
          </div>
        </div>
      )}

      {audit.duplicates.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                <i className="fas fa-user-friends"></i>
                </div>
                <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Rastreado: Duplicatas por Nome</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nomes idênticos com matrículas/IDs distintos</p>
                </div>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[9px] font-black uppercase">{audit.duplicates.length} Grupos</span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {audit.duplicates.map((dup, i) => (
              <div key={i} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl group hover:border-blue-200 transition-all flex flex-col justify-between">
                <div>
                  <h5 className="font-black text-slate-800 text-sm uppercase leading-tight mb-3">{dup.name}</h5>
                  <div className="space-y-2">
                    {dup.records.map((r, idx) => (
                      <div key={r.id} className={`flex items-center justify-between p-2 rounded-xl border ${idx === 0 ? 'bg-white border-blue-100' : 'bg-slate-100/50 border-slate-200 opacity-60'}`}>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase">ID</span>
                            <span className="text-xs font-bold text-slate-700">{r.id}</span>
                        </div>
                        {idx > 0 && (
                            <button 
                                onClick={() => handleDeactivateDuplicate(String(r.id), r.name)}
                                className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all flex items-center justify-center text-[10px]"
                                title="Desativar esta duplicata"
                            >
                                <i className="fas fa-trash-alt"></i>
                            </button>
                        )}
                        {idx === 0 && <span className="text-[8px] font-black text-blue-500 uppercase">Principal</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {audit.inactiveButMarkedActive.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100">
              <i className="fas fa-user-slash text-xs"></i>
            </div>
            <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Rastreado: Registros de Saída Pendentes</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Colaboradores marcados como inativos manualmente</p>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
             <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
                    Note que o sistema ignora estes records no dashboard se "active: false". 
                    Se eles ainda estão aumentando o total, verifique se existem outros duplicados que ainda constam como "active: true".
             </p>
             <div className="mt-4 flex flex-wrap gap-1.5 ">
                {audit.inactiveButMarkedActive.slice(0, 15).map((s, idx) => (
                    <span key={idx} className="px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-400 uppercase">
                        {s.name}
                    </span>
                ))}
                {audit.inactiveButMarkedActive.length > 15 && (
                    <span className="text-[9px] font-black text-slate-300 uppercase py-1">+{audit.inactiveButMarkedActive.length - 15} mais</span>
                )}
             </div>
          </div>
        </div>
      )}

      {audit.difference === 0 && (
        <div className="bg-emerald-50 p-10 rounded-[4rem] border border-emerald-100 flex flex-col md:flex-row items-center gap-10 shadow-sm transition-all duration-1000 animate-in zoom-in-95">
           <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-emerald-500 text-4xl shadow-xl shadow-emerald-200/50 border border-emerald-100">
             <i className="fas fa-check-circle"></i>
           </div>
           <div className="text-center md:text-left">
             <h4 className="text-2xl font-black text-emerald-900 uppercase tracking-tighter">Sincronia Total Confirmada</h4>
             <p className="text-emerald-800/60 text-sm font-bold mt-2 leading-relaxed">
               Excelente! O rastreador confirmou que a população do banco de dados para <span className="text-emerald-600 font-black">{unit}</span> é de <span className="bg-white px-2 py-1 rounded-lg text-emerald-600">{audit.dbCount}</span>, exatamente o total da planilha mestre.
             </p>
             <div className="mt-4 flex items-center justify-center md:justify-start gap-4">
                <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                    <i className="fas fa-shield-check"></i> Integridade SQL 100%
                </span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">• Registros em conformidade</span>
             </div>
           </div>
        </div>
      )}

      {/* Guia de Recuperação de Historico */}
      <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 flex gap-6 items-center">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <i className="fas fa-history"></i>
          </div>
          <div className="flex-1">
            <h4 className="text-blue-900 font-black uppercase text-xs tracking-tight">Como Corrigir o Mês de Abril?</h4>
            <p className="text-[10px] text-blue-800/70 font-medium leading-relaxed mt-1">
              Se você corrigiu os registros acima mas o gráfico de <span className="font-black">ABRIL</span> ainda mostra os valores antigos: 
              <br/>
              1. Vá na aba <span className="font-black">FECHAMENTO</span>.
              2. Selecione o mês de <span className="font-black">ABRIL/2026</span>.
              3. Use o botão <span className="font-black">REABRIR MÊS</span>.
              4. Clique em <span className="font-black">EXECUTAR FECHAMENTO</span> novamente (isso atualizará o histórico com os novos valores corrigidos).
            </p>
          </div>
      </div>
    </div>
  );
};

export default StaffAuditor;
