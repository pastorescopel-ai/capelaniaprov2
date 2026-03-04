
import React, { useEffect } from 'react';
import { Unit, SmallGroup, User } from '../../types';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
import Button from '../Shared/Button';
import { isRecordLocked } from '../../utils/validators';
import { formatWhatsApp } from '../../utils/formatters';
import { useSmallGroupForm } from '../../hooks/useSmallGroupForm';

interface FormProps {
  unit: Unit;
  groupsList?: string[];
  users: User[];
  currentUser: User;
  history: SmallGroup[];
  editingItem?: SmallGroup;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: SmallGroup) => void;
  onSubmit: (data: any) => void;
}

const SmallGroupForm: React.FC<FormProps> = ({ unit, groupsList = [], users, currentUser, history, editingItem, isLoading, onSubmit, onDelete, onEdit }) => {
  const {
    formData, setFormData,
    isSectorLocked, setIsSectorLocked,
    isSubmitting,
    sectorOptions, pgOptions, staffOptions,
    handleSelectPG, handleSelectLeader, handleClear, handleFormSubmit
  } = useSmallGroupForm({ unit, history, editingItem, currentUser, onSubmit });

  // Refs para controle de foco
  const phoneInputRef = React.useRef<HTMLInputElement>(null);
  const participantsInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingItem && (editingItem as any).isMission) {
      setTimeout(() => {
        if (!formData.leaderPhone) {
          phoneInputRef.current?.focus();
        } else {
          participantsInputRef.current?.focus();
        }
      }, 500);
    }
  }, [editingItem, formData.leaderPhone]);

  const headerActions = (
    <button type="button" onClick={handleClear} className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 transition-all flex items-center justify-center text-lg shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
  );

  const historySection = (
    <HistorySection<SmallGroup> data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['groupName', 'leader']} renderItem={(item) => (
      <HistoryCard key={item.id} icon="🏠" color="text-emerald-600" title={item.groupName} subtitle={`${item.sector} • ${item.participantsCount} participantes • Líder: ${item.leader}`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} />
    )} />
  );

  return (
    <FormScaffold title="Pequeno Grupo" subtitle={`Unidade ${unit}`} headerActions={headerActions} history={historySection}>
      <form onSubmit={handleFormSubmit} className="space-y-4 md:space-y-6">
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data do Encontro *</label><input type="date" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do Grupo *</label><Autocomplete options={pgOptions} value={formData.groupName || ''} onChange={v => setFormData({...formData, groupName: v})} onSelectOption={handleSelectPG} placeholder="Selecione o PG..." isStrict={true} /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Líder Atual *</label><Autocomplete options={staffOptions} value={formData.leader || ''} onChange={v => { setFormData({...formData, leader: v}); if(!v) setIsSectorLocked(false); }} onSelectOption={handleSelectLeader} placeholder="Busque o líder no banco..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">WhatsApp do Líder *</label><input ref={phoneInputRef} placeholder="(00) 00000-0000" value={formData.leaderPhone || ''} onChange={e => setFormData({...formData, leaderPhone: formatWhatsApp(e.target.value)})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all" /></div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Localização *</label>
            {isSectorLocked ? (<div className="w-full p-3 md:p-4 rounded-2xl bg-slate-100 border border-slate-200 font-bold text-slate-500 cursor-not-allowed flex justify-between items-center"><span>{formData.sector || ''}</span><i className="fas fa-lock text-slate-400"></i></div>) : (<Autocomplete options={sectorOptions} value={formData.sector || ''} onChange={v => setFormData({...formData, sector: v})} placeholder="Onde o PG se reúne?" isStrict={true} />)}
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nº de Participantes *</label><input ref={participantsInputRef} type="number" value={formData.participantsCount || ''} onChange={e => setFormData({...formData, participantsCount: parseInt(e.target.value)})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-black focus:ring-2 focus:ring-emerald-500/20 transition-all" placeholder="0" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Turno *</label><select value={formData.shift || 'Manhã'} onChange={e => setFormData({...formData, shift: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all"><option>Manhã</option><option>Tarde</option><option>Noite</option></select></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Relato / Observações</label><textarea value={formData.observations || ''} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all" /></div>
        </div>
        <Button 
          type="submit" 
          variant="success"
          isLoading={isSubmitting}
          className="w-full py-4 md:py-6 text-xs"
        >
          Salvar Registro de PG
        </Button>
      </form>
    </FormScaffold>
  );
};

export default SmallGroupForm;
