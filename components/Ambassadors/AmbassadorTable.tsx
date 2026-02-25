import React from 'react';
import { Trash2 } from 'lucide-react';
import { Ambassador, Unit, Sector } from '../../types';

interface AmbassadorTableProps {
  ambassadors: Ambassador[];
  currentUnit: Unit;
  proSectors: Sector[];
  deleteAmbassador: (id: string) => void;
}

const AmbassadorTable: React.FC<AmbassadorTableProps> = ({ ambassadors, currentUnit, proSectors, deleteAmbassador }) => {
  const filteredAmbassadors = ambassadors
    .filter(a => a.unit === currentUnit)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-black text-slate-700 uppercase tracking-tight">Lista de Embaixadores ({currentUnit})</h3>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total: {filteredAmbassadors.length}</div>
      </div>
      
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50">
            <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <th className="p-4">Matrícula</th>
              <th className="p-4">Nome</th>
              <th className="p-4">Setor</th>
              <th className="p-4">Data</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-600 divide-y divide-slate-50">
            {filteredAmbassadors.map(amb => {
              const sectorName = proSectors.find(s => String(s.id) === String(amb.sectorId))?.name || 'Não identificado';
              return (
                <tr key={amb.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4 font-mono text-xs text-slate-400">{amb.registrationId || '-'}</td>
                  <td className="p-4 font-bold text-slate-700">{amb.name}</td>
                  <td className="p-4 text-xs">{sectorName}</td>
                  <td className="p-4 text-xs font-mono">{new Date(amb.completionDate).toLocaleDateString()}</td>
                  <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => deleteAmbassador(amb.id)} 
                      className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors" 
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AmbassadorTable;
