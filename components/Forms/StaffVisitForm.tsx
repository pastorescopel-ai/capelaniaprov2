
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, StaffVisit, User, UserRole, MasterLists, VisitReason, ProStaff, ParticipantType } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete, { AutocompleteOption } from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';
import { normalizeString, formatWhatsApp } from '../../utils/formatters';

interface FormProps {
  unit: Unit;
  users: User[];
  currentUser: User;
  masterLists: MasterLists;
  history: StaffVisit[];
  editingItem?: StaffVisit;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: StaffVisit) => void;
  onSubmit: (data: any) => void;
  onToggleReturn?: (id: string) => void;
}

const StaffVisitForm: React.FC<FormProps> = ({ unit, users, currentUser, history, editingItem, isLoading, onSubmit, onDelete, onEdit, onToggleReturn }) => {
  const { proStaff, proSectors, syncMasterContact } = useApp();
  
  const getToday = () => new Date().toLocaleDateString('en-CA');

  const defaultState = { 
    id: '', 
    date: getToday(), 
    sector: '', 
    reason: VisitReason.ROTINA, 
    staffName: '', 
    whatsapp: '', // Novo campo para #ESTRUTURA_PRO
    requiresReturn: false, 
    returnDate: getToday(), 
    returnCompleted: false, 
    observations: '' 
  };
  
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();

  const sectorOptions = useMemo(() => {
    return proSectors.filter(s => s.unit === unit).map(s => ({value: s.name, label: s.name})).sort((a,b) => a.label.localeCompare(b.label));
  }, [proSectors, unit]);

  const staffOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    proStaff.filter(s => s.unit === unit).forEach(staff => {
      const sector = proSectors.find(sec => sec.id === staff.sectorId);
      const staffIdStr = String(staff.id);
      options.push({
        value: staff.name,
        label: `${staff.name} (${staffIdStr.split('-')[1] || staffIdStr})`,
        subLabel: sector ? sector.name : 'Setor não informado',
        category: 'RH'
      });
    });

    const uniqueNames = new Set<string>();
    history.forEach(v => {
      if (v.staffName && !uniqueNames.has(normalizeString(v.staffName))) {
        uniqueNames.add(normalizeString(v.staffName));
        options.push({
          value: v.staffName.trim(),
          label: v.staffName.trim(),
          subLabel: v.sector,
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
        whatsapp: (editingItem as any).whatsapp || '',
        date: editingItem.date ? editingItem.date.split('T')[0] : getToday(), 
        returnDate: editingItem.returnDate ? editingItem.returnDate.split('T')[0] : getToday(),
        observations: editingItem.observations || ''
      });
    } else {
      setFormData({ ...defaultState, date: getToday(), returnDate: getToday() });
    }
  }, [editingItem]);

  const handleSelectStaff = (label: string) => {
      const nameOnly = label.split(' (')[0].trim();
      const match = label.match(/\((.*?)\)$/);
      
      if (match) {
          const rawId = match[1];
          const staff = proStaff.find(s => s.id === `${unit}-${rawId}` || s.id === rawId || s.id === rawId.padStart(6, '0'));
          if (staff) {
              const sector = proSectors.find(s => s.id === staff.sectorId);
              setFormData(prev => ({ 
                ...prev, 
                staffName: staff.name, 
                whatsapp: staff.whatsapp ? formatWhatsApp(staff.whatsapp) : prev.whatsapp,
                sector: sector ? sector.name : prev.sector 
              }));
              return;
          }
      }
      setFormData(prev => ({ ...prev, staffName: nameOnly }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date) { showToast("O campo 'Data da Visita' é obrigatório."); return; }
    if (!formData.staffName) { showToast("O campo 'Colaborador Atendido' é obrigatório."); return; }
    if (!formData.sector) { showToast("O campo 'Setor / Localização' é obrigatório."); return; }
    if (!formData.reason) { showToast("O campo 'Motivo da Visita' é obrigatório."); return; }
    if (formData.requiresReturn && !formData.returnDate) { showToast("O campo 'Agendar Retorno para' é obrigatório quando a opção de retorno está marcada."); return; }
    
    // #ESTRUTURA_PRO: Sincronização automática do contato com o RH
    if (formData.whatsapp) {
        await syncMasterContact(formData.staffName, formData.whatsapp, unit, ParticipantType.STAFF);
    }
    
    onSubmit({...formData, unit});
    setFormData({ ...defaultState, date: getToday(), returnDate: getToday() });
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Visita Pastoral</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidade {unit}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data da Visita *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Colaborador Atendido *</label><Autocomplete options={staffOptions} value={formData.staffName} onChange={v => setFormData({...formData, staffName: v})} onSelectOption={handleSelectStaff} placeholder="Busque por nome ou matrícula..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">WhatsApp (Opcional)</label><input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Motivo da Visita *</label><select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value as VisitReason})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold">{Object.values(VisitReason).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Localização *</label><Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local da visita..." isStrict={true} /></div>
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-rose-100 transition-all cursor-pointer" onClick={() => setFormData({...formData, requiresReturn: !formData.requiresReturn})}>
              <input type="checkbox" checked={formData.requiresReturn} readOnly className="w-6 h-6 rounded-lg text-rose-600 cursor-pointer" />
              <div><label className="font-black text-slate-700 text-xs uppercase tracking-widest cursor-pointer block">Necessita Retorno?</label></div>
            </div>
          </div>
          {formData.requiresReturn && (<div className="space-y-1 md:col-span-2 animate-in slide-in-from-left duration-300"><label className="text-[10px] font-black text-rose-500 ml-2 uppercase tracking-widest">Agendar Retorno para *</label><input type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full p-4 rounded-2xl border-2 border-rose-100 text-rose-700 font-black text-lg" /></div>)}
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Observações da Visita</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium" /></div>
        </div>
        <button type="submit" className="w-full py-6 bg-rose-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs hover:bg-rose-700 transition-all">Registrar Visita Pastoral</button>
      </form>

      <HistorySection<StaffVisit> data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['staffName']} renderItem={(item) => (<HistoryCard key={item.id} icon="🤝" color="text-rose-600" title={item.staffName} subtitle={`${item.sector} • ${item.reason}`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} />)} />
    </div>
  );
};

export default StaffVisitForm;
