import React from 'react';
import { motion } from 'motion/react';

interface AuditoriaPGCoverageTabProps {
  pgSectorChanges: any[];
  proGroups: any[];
  targetMap: Record<string, string>;
  setTargetMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleTransferPGSectorChange: (item: any, targetGroupId: string) => void;
  handleKeepPGSectorChange: (item: any) => void;
  isProcessing: boolean;
}

const formatMonthLabel = (iso: string) => {
  if (!iso) return '';
  const [year, month] = iso.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]}/${year}`;
};

const AuditoriaPGCoverageTab: React.FC<AuditoriaPGCoverageTabProps> = ({
  pgSectorChanges,
  proGroups,
  targetMap,
  setTargetMap,
  handleTransferPGSectorChange,
  handleKeepPGSectorChange,
  isProcessing
}) => {
  if (pgSectorChanges.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-12 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-check text-3xl text-emerald-600"></i>
        </div>
        <h3 className="text-xl font-bold text-emerald-900 mb-2">Tudo em Ordem!</h3>
        <p className="text-emerald-600">Nenhum colaborador mudou de setor desde o último fechamento sem que o PG acompanhasse.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-teal-100 rounded-xl">
            <i className="fas fa-map-marker-alt text-teal-600"></i>
          </div>
          <div>
            <h4 className="font-bold text-teal-900">Mudança de Setor Detectada</h4>
            <p className="text-sm text-teal-700 mt-1">
              Compara o setor do colaborador no último mês fechado com o setor atual. Quem mudou de setor e cuja matrícula de PG não aponta para o novo setor aparece aqui. Se o PG atual já cobre o novo setor na prática, é só manter; senão, transfira.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pgSectorChanges.map((item, idx) => {
          const targetOptions = proGroups.filter((g: any) => String(g.sectorId) === String(item.sectorId) && g.active !== false);
          const mapKey = `pgsectorchange:${item.staffId}`;
          return (
            <motion.div
              key={item.staffId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-rose-100 text-rose-600">
                    <i className="fas fa-user-clock"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{item.staffName}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Era <span className="font-bold text-slate-600">{item.oldSectorName}</span> em {formatMonthLabel(item.lastHistoryMonth)} · agora é <span className="font-bold text-slate-600">{item.sectorName}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {item.currentGroupName ? <>Matriculado em: <span className="font-bold text-slate-600">{item.currentGroupName}</span></> : 'Sem matrícula ativa em PG algum'}
                    </p>
                  </div>
                </div>
                <div className="flex-1 max-w-md flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row gap-3">
                    <select
                      value={targetMap[mapKey] || ''}
                      onChange={(e) => setTargetMap(prev => ({ ...prev, [mapKey]: e.target.value }))}
                      className="flex-1 p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-teal-500"
                    >
                      <option value="">Selecione o PG do novo setor...</option>
                      {targetOptions.map((g: any) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleTransferPGSectorChange(item, targetMap[mapKey])}
                      disabled={isProcessing || !targetMap[mapKey]}
                      className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest disabled:opacity-50 transition-all whitespace-nowrap"
                    >
                      Transferir
                    </button>
                  </div>
                  {item.currentGroupName && (
                    <button
                      onClick={() => handleKeepPGSectorChange(item)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all self-start"
                    >
                      Manter em {item.currentGroupName}
                    </button>
                  )}
                </div>
              </div>
              {targetOptions.length === 0 && (
                <p className="text-[10px] font-bold text-amber-500 uppercase mt-3">Nenhum PG cadastrado para o setor novo ainda.</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AuditoriaPGCoverageTab;
