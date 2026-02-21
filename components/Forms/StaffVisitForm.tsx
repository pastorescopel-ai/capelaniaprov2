
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, StaffVisit, User, VisitReason, ProStaff, ParticipantType } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete, { AutocompleteOption } from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';
import { normalizeString, formatWhatsApp } from '../../utils/formatters';

interface FormProps {
  unit: Unit;
  users: User[];
  currentUser: User;
  history: StaffVisit[];
  editingItem?: StaffVisit;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: StaffVisit) => void;
  onSubmit: (data: any) => void;
  onToggleReturn?: (id: string) => void;
}

const StaffVisitForm: React.FC<FormProps> = ({ unit, users, currentUser, history, editingItem, isLoading, onSubmit, onDelete, onEdit }) => {
  const { proStaff, proProviders, proSectors, syncMasterContact } = useApp();
  
  const getToday = () => new Date().toLocaleDateString('en-CA');
  const defaultState = { id: '', date: getToday(), sector: '', reason: VisitReason.ROTINA, staffName: '', whatsapp: '', participantType: ParticipantType.STAFF, providerRole: '', requiresReturn: false, returnDate: getToday(), returnCompleted: false, observations: '' };
  
  const [formData, setFormData] = useState(defaultState);
  const [isSectorLocked, setIsSectorLocked] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!editingItem) {
      setFormData(prev => ({ ...defaultState, date: prev.date || getToday(), participantType: prev.participantType }));
      setIsSectorLocked(false);
    }
  }, []);

  const sectorOptions = useMemo(() => proSectors.filter(s => s.unit === unit).map(s => ({value: s.name, label: s.name})).sort((a,b) => a.label.localeCompare(b.label)), [proSectors, unit]);

  const nameOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const officialSet = new Set<string>();
    
    if (formData.participantType === ParticipantType.STAFF) {
        proStaff.filter(s => s.unit === unit).forEach(staff => {
          const sector = proSectors.find(sec => sec.id === staff.sectorId);
          options.push({ value: staff.name, label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`, subLabel: sector ? sector.name : 'Setor não informado', category: 'RH' });
          officialSet.add(normalizeString(staff.name));
        });
    } else {
        proProviders.filter(p => p.unit === unit).forEach(provider => {
            options.push({ value: provider.name, label: provider.name, subLabel: provider.sector || 'Sem setor fixo', category: 'RH' });
            officialSet.add(normalizeString(provider.name));
        });
    }

    const uniqueNames = new Set<string>();
    history.forEach(v => {
      const historyType = (v as any).participantType || ParticipantType.STAFF;
      if (historyType === formData.participantType && v.staffName) {
         const norm = normalizeString(v.staffName);
         if (!uniqueNames.has(norm) && !officialSet.has(norm)) {
             uniqueNames.add(norm);
             options.push({ value: v.staffName, label: v.staffName, subLabel: v.sector, category: 'History' });
         }
      }
    });
    return options;
  }, [proStaff, proProviders, proSectors, unit, history, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ ...editingItem, whatsapp: (editingItem as any).whatsapp || '', participantType: (editingItem as any).participantType || ParticipantType.STAFF, providerRole: (editingItem as any).providerRole || '', date: editingItem.date ? editingItem.date.split('T')[0] : getToday(), returnDate: editingItem.returnDate ? editingItem.returnDate.split('T')[0] : getToday(), observations: editingItem.observations || '' });
      if (editingItem.participantType === ParticipantType.STAFF || !editingItem.participantType) {
          const staff = proStaff.find(s => normalizeString(s.name) === normalizeString(editingItem.staffName) && s.unit === unit);
          setIsSectorLocked(!!staff);
      } else {
          setIsSectorLocked(false);
      }
    }
  }, [editingItem, unit, proStaff]);

  const handleSelectName = (label: string) => {
      const nameOnly = label.split(' (')[0].trim();
      const match = label.match(/\((.*?)\)$/);
      let foundSector = formData.sector;
      let foundWhatsapp = formData.whatsapp;
      let lockSector = false;

      if (formData.participantType === ParticipantType.STAFF) {
          let staff: ProStaff | undefined;
          if (match) staff = proStaff.find(s => s.id === `${unit}-${match[1]}` || s.id === match[1] || s.id === match[1].padStart(6, '0'));
          if (!staff) staff = proStaff.find(s => normalizeString(s.name) === normalizeString(nameOnly) && s.unit === unit);

          if (staff) {
              const sector = proSectors.find(s => s.id === staff.sectorId);
              if (sector) { foundSector = sector.name; lockSector = true; } else { lockSector = false; }
              if (staff.whatsapp) foundWhatsapp = formatWhatsApp(staff.whatsapp);
          } else { lockSector = false; }
      } else {
          const provider = proProviders.find(p => normalizeString(p.name) === normalizeString(nameOnly) && p.unit === unit);
          if (provider) {
              if (provider.sector) foundSector = provider.sector;
              if (provider.whatsapp) foundWhatsapp = formatWhatsApp(provider.whatsapp);
          }
          lockSector = false;
      }

      setFormData(prev => ({ ...prev, staffName: nameOnly, whatsapp: foundWhatsapp, sector: foundSector }));
      setIsSectorLocked(lockSector);
      if (lockSector) showToast("Setor vinculado ao cadastro oficial.", "info");
  };

  const handleClear = () => {
    setFormData({ ...defaultState, date: formData.date, participantType: formData.participantType });
    setIsSectorLocked(false);
    showToast("Campos limpos!", "info");
  };

  const handleChangeName = (v: string) => {
      setFormData({...formData, staffName: v});
      if (!v) setIsSectorLocked(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date) { showToast("Data obrigatória."); return; }
    if (!formData.staffName) { showToast("Nome obrigatório."); return; }
    if (!formData.reason) { showToast("Motivo obrigatório."); return; }
    
    const isStaff = formData.participantType === ParticipantType.STAFF;

    if (isStaff) {
        if (!formData.sector) { showToast("Setor é obrigatório para colaboradores.", "warning"); return; }
        if (!proSectors.some(s => s.name === formData.sector && s.unit === unit)) { showToast("Setor inválido.", "warning"); return; }
        if (!proStaff.some(s => normalizeString(s.name) === normalizeString(formData.staffName) && s.unit === unit)) { showToast("Colaborador não encontrado no RH.", "warning"); return; }
        if (formData.whatsapp) await syncMasterContact(formData.staffName, formData.whatsapp, unit, ParticipantType.STAFF);
    } else {
        if (!formData.whatsapp || formData.whatsapp.length < 10) { showToast("WhatsApp é obrigatório para prestadores.", "warning"); return; }
        await syncMasterContact(formData.staffName, formData.whatsapp, unit, ParticipantType.PROVIDER, formData.sector);
    }
    
    onSubmit({...formData, unit});
    setFormData({ ...defaultState, date: getToday(), returnDate: getToday(), participantType: formData.participantType });
    setIsSectorLocked(false);
  };

  const isStaff = formData.participantType === ParticipantType.STAFF;

  const headerActions = (
    <>
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start">
        <button type="button" onClick={() => { setFormData({...defaultState, date: formData.date, participantType: ParticipantType.STAFF}); setIsSectorLocked(false); }} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === ParticipantType.STAFF ? 'bg-white shadow-lg text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}>Colaborador</button>
        <button type="button" onClick={() => { setFormData({...defaultState, date: formData.date, participantType: ParticipantType.PROVIDER}); setIsSectorLocked(false); }} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === ParticipantType.PROVIDER ? 'bg-white shadow-lg text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}>Prestador</button>
      </div>
      <button type="button" onClick={handleClear} className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 transition-all flex items-center justify-center text-lg shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
    </>
  );

  const historySection = (
    <HistorySection<StaffVisit> data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['staffName']} renderItem={(item) => (
      <HistoryCard key={item.id} icon="🤝" color="text-rose-600" title={item.staffName} subtitle={`${item.sector} • ${item.reason}`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} middle={(item as any).participantType === ParticipantType.PROVIDER && (<span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Prestador</span>)} />
    )} />
  );

  return (
    <FormScaffold title="Visita Pastoral" subtitle={`Unidade ${unit}`} headerActions={headerActions} history={historySection}>
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data da Visita *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">{isStaff ? 'Colaborador Atendido *' : 'Nome do Prestador *'}</label><Autocomplete options={nameOptions} value={formData.staffName} onChange={handleChangeName} onSelectOption={handleSelectName} placeholder={isStaff ? "Busque por nome ou matrícula..." : "Busque ou digite o nome..."} isStrict={isStaff} /></div>

          {!isStaff && (
              <div className="space-y-1 md:col-span-2 animate-in slide-in-from-top-2 duration-300"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Função / Especialidade</label><input placeholder="Ex: Médico Cardiologista, Técnico de TI..." value={formData.providerRole} onChange={e => setFormData({...formData, providerRole: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-700" /></div>
          )}

          <div className="space-y-1"><label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${!isStaff ? 'text-rose-600' : 'text-slate-400'}`}>WhatsApp {!isStaff ? '(Obrigatório)' : '(Opcional)'}</label><input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className={`w-full p-4 rounded-2xl border-none font-bold transition-all ${!isStaff ? 'bg-rose-50 text-rose-900 ring-2 ring-rose-100 focus:ring-rose-300' : 'bg-slate-50'}`} /></div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Motivo da Visita *</label><select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value as VisitReason})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold">{Object.values(VisitReason).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          
          <div className="space-y-1 md:col-span-2">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${isStaff ? 'text-slate-400' : 'text-slate-300'}`}>Setor / Local {isStaff ? '(Obrigatório)' : '(Opcional)'}</label>
              {isSectorLocked ? (
                  <div className="w-full p-4 rounded-2xl bg-slate-100 border border-slate-200 font-bold text-slate-500 cursor-not-allowed flex justify-between items-center group relative" title="Vínculo oficial do RH"><span>{formData.sector}</span><i className="fas fa-lock text-slate-400"></i><span className="absolute -top-2 right-2 bg-blue-100 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">RH Link</span></div>
              ) : (
                  <Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local da visita..." isStrict={isStaff} />
              )}
          </div>
          
          <div className="space-y-1 md:col-span-2"><div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-rose-100 transition-all cursor-pointer" onClick={() => setFormData({...formData, requiresReturn: !formData.requiresReturn})}><input type="checkbox" checked={formData.requiresReturn} readOnly className="w-6 h-6 rounded-lg text-rose-600 cursor-pointer" /><div><label className="font-black text-slate-700 text-xs uppercase tracking-widest cursor-pointer block">Necessita Retorno?</label></div></div></div>
          {formData.requiresReturn && (<div className="space-y-1 md:col-span-2 animate-in slide-in-from-left duration-300"><label className="text-[10px] font-black text-rose-500 ml-2 uppercase tracking-widest">Agendar Retorno para *</label><input type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full p-4 rounded-2xl border-2 border-rose-100 text-rose-700 font-black text-lg" /></div>)}
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Observações da Visita</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium" /></div>
        </div>
        <button type="submit" className="w-full py-6 bg-rose-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs hover:bg-rose-700 transition-all">Registrar Visita Pastoral</button>
      </form>
    </FormScaffold>
  );
};

export default StaffVisitForm;
