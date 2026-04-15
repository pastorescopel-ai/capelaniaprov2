import React from 'react';
import { motion } from 'motion/react';

interface HealerMembershipsTabProps {
  duplicateMemberships: any[];
  handleFixDuplicateMembership: (personId: string, type: 'staff' | 'provider', keepId: string) => Promise<void>;
  isProcessing: boolean;
  proGroups: any[];
}

const HealerMembershipsTab: React.FC<HealerMembershipsTabProps> = ({ 
  duplicateMemberships, 
  handleFixDuplicateMembership, 
  isProcessing,
  proGroups
}) => {
  if (duplicateMemberships.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-12 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-check text-3xl text-emerald-600"></i>
        </div>
        <h3 className="text-xl font-bold text-emerald-900 mb-2">Tudo em Ordem!</h3>
        <p className="text-emerald-600">Não foram encontradas matrículas duplicadas ativas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-100 rounded-xl">
            <i className="fas fa-info-circle text-emerald-600"></i>
          </div>
          <div>
            <h4 className="font-bold text-emerald-900">Sobre Duplicidades de Matrícula</h4>
            <p className="text-sm text-emerald-700 mt-1">
              Este módulo identifica colaboradores ou prestadores que possuem mais de uma matrícula ativa (sem data de saída e sem erro) no sistema. 
              Isso geralmente ocorre por falhas no processo de transferência ou ajustes de ciclo.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {duplicateMemberships.map((dup, idx) => (
          <motion.div 
            key={`${dup.type}-${dup.personId}-${dup.month}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${dup.type === 'staff' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                  <i className={`fas ${dup.type === 'staff' ? 'fa-user-tie' : 'fa-user-gear'}`}></i>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{dup.personName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${dup.type === 'staff' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                      {dup.type === 'staff' ? 'CLT' : 'Prestador'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 text-slate-500">
                      Mês: {dup.month}
                    </span>
                    <span className="text-xs text-slate-400">ID: {dup.personId}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 max-w-md">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Matrículas Ativas Encontradas</p>
                <div className="space-y-2">
                  {dup.memberships.map((m: any) => {
                    const group = proGroups.find(g => g.id === m.groupId);
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-xs text-slate-400 border border-slate-100">
                            <i className="fas fa-users"></i>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">{group?.name || 'Grupo Desconhecido'}</p>
                            <p className="text-[10px] text-slate-400">Desde: {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'N/D'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleFixDuplicateMembership(dup.personId, dup.type, m.id)}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                        >
                          Manter Esta
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default HealerMembershipsTab;
