
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Unit, SmallGroup, User, UserRole, MasterLists } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';

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

const SmallGroupForm: React.FC<FormProps> = ({ unit, groupsList = [], users, currentUser, masterLists, history, editingItem, isLoading, onSubmit, onDelete, onEdit }) => {
  const { proSectors, proGroups, proStaff, saveRecord } = useApp();
  const defaultState = { id: '', date: new Date().toISOString().split('T')[0], sector: '', groupName: '', leader: '', shift: 'Manhã', participantsCount: 0, observations: '' };
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();

  const sectorOptions = useMemo(() => {
    return proSectors.filter(s => s.unit === unit).map(s => s.name).sort();
  }, [proSectors, unit]);

  const pgOptions = useMemo(() => {
    return proGroups.filter(g => g.unit === unit).map(g => g.name).sort();
  }, [proGroups, unit]);

  const staffOptions = useMemo(() => {
    return proStaff
      .filter(s => s.unit === unit)
      .map(s => `${s.name} (${s.id.split('-')[1] || s.id})`)
      .sort();
  }, [proStaff, unit]);

  const highlightOptions = useMemo(() => {
    return proStaff.filter(s => s.unit === unit).map(s => `${s.name} (${s.id.split('-')[1] || s.id})`);
  }, [proStaff, unit]);

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
          setFormData(prev => ({ 
            ...prev, 
            groupName: pgName, 
            leader: pgMaster.currentLeader || '' // Carrega líder salvo no cadastro mestre
          }));
          if (pgMaster.currentLeader) {
              showToast(`Líder "${pgMaster.currentLeader}" carregado automaticamente.`, "success");
          }
      } else {
          setFormData(prev => ({ ...prev, groupName: pgName }));
      }
  };

  const handleSelectLeader = (val: string) => {
    const nameOnly = val.split(' (')[0].trim();
    setFormData(prev => ({ ...prev, leader: nameOnly }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.groupName || !formData.leader) {
      showToast("Preencha todos os campos obrigatórios.");
      return;
    }

    // LÓGICA DE VÍNCULO AUTOMÁTICO:
    // Se o líder no formulário for diferente do líder gravado no cadastro mestre do PG, atualizamos o mestre.
    const pgMaster = proGroups.find(g => g.name === formData.groupName && g.unit === unit);
    if (pgMaster && pgMaster.currentLeader !== formData.leader) {
        try {
            await saveRecord('proGroups', { ...pgMaster, currentLeader: formData.leader });
            console.log(`Liderança do PG ${formData.groupName} atualizada para: ${formData.leader}`);
        } catch (err) {
            console.error("Erro ao atualizar líder mestre:", err);
        }
    }

    onSubmit({...formData, unit});
    setFormData(defaultState);
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Pequeno Grupo ({unit})</h2>
          <button type="button" onClick={() => setFormData(defaultState)} className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 px-4 py-2 rounded-full border border-rose-100">Limpar</button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local do PG..." isStrict={true} /></div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome do Grupo *</label>
            <Autocomplete options={pgOptions} value={formData.groupName} onChange={v => setFormData({...formData, groupName: v})} onSelectOption={handleSelectPG} placeholder="Selecione o PG..." />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Líder (Busca Colaborador) *</label>
            <Autocomplete 
                options={staffOptions} 
                highlightOptions={highlightOptions} 
                value={formData.leader} 
                onChange={v => setFormData({...formData, leader: v})} 
                onSelectOption={handleSelectLeader}
                placeholder="Busque o líder na lista oficial..." 
            />
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nº de Participantes *</label><input type="number" value={formData.participantsCount || ''} onChange={e => setFormData({...formData, participantsCount: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" placeholder="0" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs active:scale-95 transition-all">Salvar PG</button>
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
