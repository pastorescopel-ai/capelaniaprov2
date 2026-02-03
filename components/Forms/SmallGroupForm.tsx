
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Unit, SmallGroup, User, UserRole, MasterLists } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete, { AutocompleteOption } from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';
import { normalizeString } from '../../utils/formatters';

interface FormProps {
  unit: Unit;
  groupsList?: string[];
  users: User[];
  currentUser: User;
  masterLists: MasterLists;
  history: SmallGroup[];
  editingItem?: SmallGroup;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: SmallGroup) => void;
  onSubmit: (data: any) => void;
}

const SmallGroupForm: React.FC<FormProps> = ({ unit, groupsList = [], users, currentUser, history, editingItem, isLoading, onSubmit, onDelete, onEdit }) => {
  const { proSectors, proGroups, proStaff, saveRecord } = useApp();
  const defaultState = { id: '', date: new Date().toISOString().split('T')[0], sector: '', groupName: '', leader: '', shift: 'Manhã', participantsCount: 0, observations: '' };
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();

  const sectorOptions = useMemo(() => {
    return proSectors.filter(s => s.unit === unit).map(s => ({value: s.name, label: s.name})).sort((a,b) => a.label.localeCompare(b.label));
  }, [proSectors, unit]);

  const pgOptions = useMemo(() => {
    return proGroups.filter(g => g.unit === unit).map(g => ({value: g.name, label: g.name})).sort((a,b) => a.label.localeCompare(b.label));
  }, [proGroups, unit]);

  const staffOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    
    // Banco Oficial
    proStaff.filter(s => s.unit === unit).forEach(staff => {
      const sector = proSectors.find(sec => sec.id === staff.sectorId);
      options.push({
        value: staff.name,
        label: `${staff.name} (${staff.id.split('-')[1] || staff.id})`,
        subLabel: sector ? sector.name : 'Setor não informado',
        category: 'RH'
      });
    });

    // Líderes históricos
    const uniqueHistoryNames = new Set<string>();
    history.forEach(g => {
      if (g.leader && !uniqueHistoryNames.has(normalizeString(g.leader))) {
        uniqueHistoryNames.add(normalizeString(g.leader));
        options.push({
          value: g.leader.trim(),
          label: g.leader.trim(),
          subLabel: g.sector,
          category: 'History'
        });
      }
    });

    return options;
  }, [proStaff, proSectors, unit, history]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        ...editingItem, 
        date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0],
        observations: editingItem.observations || ''
      });
    } else {
      setFormData(defaultState);
    }
  }, [editingItem]);

  const handleSelectPG = (pgName: string) => {
      const pgMaster = proGroups.find(g => g.name === pgName && g.unit === unit);
      if (pgMaster) {
          const sector = pgMaster.sectorId ? proSectors.find(s => s.id === pgMaster.sectorId) : null;
          setFormData(prev => ({ 
            ...prev, 
            groupName: pgName, 
            leader: pgMaster.currentLeader || prev.leader,
            sector: sector ? sector.name : prev.sector
          }));
          if (pgMaster.currentLeader || sector) {
              showToast(`PG identificado. Líder/Setor carregados.`, "success");
          }
      } else {
          setFormData(prev => ({ ...prev, groupName: pgName }));
      }
  };

  const handleSelectLeader = (val: string) => {
    const match = val.match(/\((.*?)\)$/);
    if (match) {
        const rawId = match[1];
        const staff = proStaff.find(s => s.id === `${unit}-${rawId}` || s.id === rawId);
        if (staff && staff.sectorId) {
          const sector = proSectors.find(s => s.id === staff.sectorId);
          if (sector) {
             setFormData(prev => ({ ...prev, leader: staff.name, sector: sector.name }));
             showToast(`Setor "${sector.name}" carregado via líder.`, "info");
             return;
          }
        }
    }
    const nameOnly = val.split(' (')[0].trim();
    setFormData(prev => ({ ...prev, leader: nameOnly }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.groupName || !formData.leader) {
      showToast("Preencha todos os campos obrigatórios.");
      return;
    }
    const pgMaster = proGroups.find(g => g.name === formData.groupName && g.unit === unit);
    if (pgMaster && pgMaster.currentLeader !== formData.leader) {
        try {
            await saveRecord('proGroups', { ...pgMaster, currentLeader: formData.leader });
        } catch (err) {}
    }
    onSubmit({...formData, unit});
    setFormData(defaultState);
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Pequeno Grupo</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidade {unit}</p>
          </div>
          <button type="button" onClick={() => setFormData(defaultState)} className="text-[9px] font-black text-rose-500 uppercase bg-rose-50 px-5 py-2.5 rounded-xl border border-rose-100">Limpar Campos</button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data do Encontro *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do Grupo *</label>
            <Autocomplete options={pgOptions} value={formData.groupName} onChange={v => setFormData({...formData, groupName: v})} onSelectOption={handleSelectPG} placeholder="Selecione o PG..." />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Líder Atual *</label>
            <Autocomplete 
                options={staffOptions} 
                value={formData.leader} 
                onChange={v => setFormData({...formData, leader: v})} 
                onSelectOption={handleSelectLeader}
                placeholder="Busque o líder no banco..." 
            />
          </div>

          <div className="space-y-1">
             <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Localização *</label>
             <Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Onde o PG se reúne?" isStrict={true} />
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nº de Participantes *</label><input type="number" value={formData.participantsCount || ''} onChange={e => setFormData({...formData, participantsCount: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" placeholder="0" /></div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Turno</label>
            <select value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold">
              <option>Manhã</option>
              <option>Tarde</option>
              <option>Noite</option>
            </select>
          </div>

          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Relato / Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium" /></div>
        </div>
        <button type="submit" className="w-full py-6 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs active:scale-95 transition-all hover:bg-emerald-700">Salvar Registro de PG</button>
      </form>

      <HistorySection<SmallGroup>
        data={history}
        users={users}
        currentUser={currentUser}
        isLoading={isLoading}
        searchFields={['groupName', 'leader']}
        renderItem={(item) => (
          <HistoryCard 
            key={item.id} 
            icon="🏠" 
            color="text-emerald-600" 
            title={item.groupName} 
            subtitle={`${item.sector} • ${item.participantsCount} participantes • Líder: ${item.leader}`} 
            chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} 
            isLocked={isRecordLocked(item.date, currentUser.role)}
            onEdit={() => onEdit?.(item)} 
            onDelete={() => onDelete(item.id)} 
          />
        )}
      />
    </div>
  );
};

export default SmallGroupForm;
