import React, { useState, useMemo } from 'react';
import { ProStaff, ProGroup, ProSector, Unit } from '../../types';
import { usePro } from '../../contexts/ProContext';
import { useApp } from '../../hooks/useApp';
import { useToast } from '../../contexts/ToastContext';
import { Edit2, Save, X } from 'lucide-react';
import { normalizeString } from '../../utils/formatters';

interface PGLeadersProps {
  unit: Unit;
}

const PGLeaders: React.FC<PGLeadersProps> = ({ unit }) => {
  const { proStaff, proGroups, proSectors } = usePro();
  const { saveRecord } = useApp();
  const { showToast } = useToast();
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const leaders = useMemo(() => {
    const sectorsById = new Map(proSectors.map(s => [s.id, s]));

    // Vínculo por ID é a fonte primária (imune a homônimo/apelido/erro de digitação);
    // o mapa por nome só cobre PGs cujo líder ainda não tem leaderStaffId gravado.
    const groupsByLeaderId = new Map<string, ProGroup>();
    const groupsByLeaderName = new Map<string, ProGroup>();
    proGroups.forEach(g => {
      if (g.leaderStaffId) groupsByLeaderId.set(g.leaderStaffId, g);
      else if (g.currentLeader) groupsByLeaderName.set(g.currentLeader, g);
    });

    return proStaff
      .filter(s => s.unit === unit && s.active !== false)
      .filter(s => groupsByLeaderId.has(s.id) || groupsByLeaderName.has(s.name))
      .filter(s => normalizeString(s.name).includes(normalizeString(searchTerm)) || s.id.includes(searchTerm))
      .map(s => {
        const group = groupsByLeaderId.get(s.id) || groupsByLeaderName.get(s.name);
        const sector = sectorsById.get(s.sectorId);
        return {
          ...s,
          groupName: group?.name || 'Sem PG',
          sectorName: sector?.name || 'Sem Setor'
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [proStaff, proGroups, proSectors, unit, searchTerm]);

  const handleEdit = (staff: ProStaff) => {
    setEditingStaffId(staff.id);
    setNewWhatsapp(staff.whatsapp || '');
  };

  const handleSave = async (staff: ProStaff, now: number) => {
    try {
      const success = await saveRecord('proStaff', { ...staff, whatsapp: newWhatsapp, updatedAt: now });
      if (!success) {
        showToast('Erro ao atualizar WhatsApp.', 'warning');
        return;
      }
      showToast('WhatsApp atualizado!', 'success');
      setEditingStaffId(null);
    } catch (e) {
      showToast('Erro ao atualizar WhatsApp.', 'warning');
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
      <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6">Gestão de Líderes</h2>
      <input 
        type="text" 
        placeholder="Buscar por nome ou matrícula..." 
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full p-4 mb-6 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="space-y-2">
        {leaders.map(leader => (
          <div key={leader.id} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="col-span-4">
              <p className="text-xs font-black text-slate-800">{leader.name}</p>
              <p className="text-[10px] text-slate-500 font-bold">{leader.groupName} • {leader.sectorName}</p>
            </div>
            <div className="col-span-6">
              {editingStaffId === leader.id ? (
                <input
                  type="text"
                  value={newWhatsapp}
                  onChange={e => setNewWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              ) : (
                <p className="text-xs font-mono text-slate-600">{leader.whatsapp || 'Sem WhatsApp'}</p>
              )}
            </div>
            <div className="col-span-2 flex justify-end">
              {editingStaffId === leader.id ? (
                <div className="flex gap-2">
                  <button onClick={() => handleSave(leader, Date.now())} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save size={16} /></button>
                  <button onClick={() => setEditingStaffId(null)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => handleEdit(leader)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PGLeaders;
