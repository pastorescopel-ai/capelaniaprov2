import React, { useEffect } from 'react';
import { useAmbassadorHealer } from '../../hooks/useAmbassadorHealer';

const HealerAmbassadorsTab: React.FC = () => {
  const { invalidAmbassadors, isLoading, fetchInvalidAmbassadors, deleteInvalidAmbassadors } = useAmbassadorHealer();

  useEffect(() => {
    console.log("Fetching invalid ambassadors...");
    fetchInvalidAmbassadors();
  }, [fetchInvalidAmbassadors]);

  if (isLoading) return <div className="p-8 text-center text-slate-400">Carregando embaixadores...</div>;
  if (invalidAmbassadors.length === 0) return <div className="p-8 text-center text-slate-400">Nenhum embaixador inválido encontrado.</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Embaixadores Inválidos ({invalidAmbassadors.length})</h3>
        <button 
          onClick={deleteInvalidAmbassadors}
          className="bg-rose-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-600 transition-colors"
        >
          Apagar Todos Inválidos
        </button>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead className="bg-slate-50">
            <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <th className="p-4">Matrícula</th>
              <th className="p-4">Nome</th>
              <th className="p-4">Setor</th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-600 divide-y divide-slate-50">
            {invalidAmbassadors.map(amb => (
              <tr key={amb.id}>
                <td className="p-4 font-mono text-xs text-slate-400">{amb.registration_id || '-'}</td>
                <td className="p-4 font-bold text-slate-700">{amb.name}</td>
                <td className="p-4 text-xs">{amb.sector_id ? 'Identificado' : 'Não identificado'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HealerAmbassadorsTab;
