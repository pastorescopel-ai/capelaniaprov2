import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Unit, SmallGroup, User, UserRole, MasterLists } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { resolveDynamicName } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';

interface FormProps {
  unit: Unit;
  sectors: string[];
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

const SmallGroupForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, masterLists, groupsList = [], history, editingItem, isLoading, onSubmit, onDelete, onEdit }) => {
  const defaultState = { id: '', date: new Date().toISOString().split('T')[0], sector: '', groupName: '', leader: '', shift: 'Manhã', participantsCount: 0, observations: '' };
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();
  const firstInputRef = useRef<HTMLInputElement>(null);

  // --- LÓGICA DE SUGESTÃO COM DESTAQUE (GLOW) ---
  
  // 1. Identifica especificamente os PGs que pertencem ao setor selecionado no Maestro
  const sectorLinkedNames = useMemo(() => {
    if (!formData.sector) return [];
    return groupsList
      .filter(g => g.includes('|'))
      .filter(g => {
        const parts = g.split('|');
        return parts.length > 1 && parts[1].trim() === formData.sector;
      })
      .map(g => g.split('|')[0].trim());
  }, [formData.sector, groupsList]);

  // 2. Monta a lista completa para o Autocomplete, priorizando os vinculados
  const pgOptions = useMemo(() => {
    const allNames = groupsList.map(g => g.includes('|') ? g.split('|')[0].trim() : g.trim());
    const uniqueNames = Array.from(new Set(allNames));
    
    return uniqueNames.sort((a, b) => {
      const aIsLinked = sectorLinkedNames.includes(a);
      const bIsLinked = sectorLinkedNames.includes(b);
      if (aIsLinked && !bIsLinked) return -1;
      if (!aIsLinked && bIsLinked) return 1;
      return a.localeCompare(b);
    });
  }, [sectorLinkedNames, groupsList]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        ...editingItem, 
        date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0],
        observations: editingItem.observations || ''
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => firstInputRef.current?.focus(), 100);
    } else {
      setFormData(defaultState);
    }
  }, [editingItem]);

  const handleClear = () => {
    setFormData(defaultState);
    showToast("Formulário de PG zerado.", "success");
    firstInputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.groupName || !formData.leader || formData.participantsCount === undefined) {
      showToast("Atenção: Preencha todos os campos obrigatórios (*)");
      return;
    }
    onSubmit({...formData, unit});
    setFormData(defaultState);
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Pequeno Grupo ({unit})</h2>
          <button 
            type="button" 
            onClick={handleClear} 
            className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 px-4 py-2 rounded-full border border-rose-100 hover:bg-rose-100 transition-colors"
          >
            <i className="fas fa-eraser mr-1"></i> Zerar Formulário
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data Atendimento *</label><input ref={firstInputRef} type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label>
            <Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local do PG..." isStrict={true} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome do Grupo *</label>
            <Autocomplete 
              options={pgOptions} 
              highlightOptions={sectorLinkedNames} 
              value={formData.groupName} 
              onChange={v => setFormData({...formData, groupName: v})} 
              placeholder="Digite ou selecione o PG..." 
              isStrict={false} 
            />
            {formData.sector && sectorLinkedNames.length > 0 && (
              <p className="text-[8px] text-blue-500 font-bold uppercase mt-1 ml-2 flex items-center gap-1">
                <i className="fas fa-magic animate-pulse"></i> PGs destacados pertencem a este setor.
              </p>
            )}
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Líder *</label><input placeholder="Líder do PG" value={formData.leader} onChange={e => setFormData({...formData, leader: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Participantes *</label><input type="number" min="0" value={formData.participantsCount || ''} onChange={e => setFormData({...formData, participantsCount: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs active:scale-95 transition-all">
          {formData.id ? 'Atualizar Registro' : 'Salvar PG'}
        </button>
      </form>

      <HistorySection<SmallGroup>
        data={history}
        users={users}
        currentUser={currentUser}
        isLoading={isLoading}
        searchFields={['groupName']}
        renderItem={(item) => (
          <HistoryCard 
            key={item.id} 
            icon="🏠" 
            color="text-emerald-600" 
            title={resolveDynamicName(item.groupName, item.unit === Unit.HAB ? masterLists.groupsHAB : masterLists.groupsHABA)} 
            subtitle={`${resolveDynamicName(item.sector, item.unit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA)} • ${item.participantsCount} participantes`} 
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