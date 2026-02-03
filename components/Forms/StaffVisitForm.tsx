
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Unit, StaffVisit, User, UserRole, MasterLists, VisitReason } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';

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

const StaffVisitForm: React.FC<FormProps> = ({ unit, users, currentUser, masterLists, history, editingItem, isLoading, onSubmit, onDelete, onEdit, onToggleReturn }) => {
  const { proStaff, proSectors } = useApp();
  const defaultState = { id: '', date: new Date().toISOString().split('T')[0], sector: '', reason: VisitReason.AGENDAMENTO, staffName: '', requiresReturn: false, returnDate: new Date().toISOString().split('T')[0], returnCompleted: false, observations: '' };
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();

  const sectorOptions = useMemo(() => {
    return proSectors.filter(s => s.unit === unit).map(s => s.name).sort();
  }, [proSectors, unit]);

  const staffOptions = useMemo(() => {
    const names = new Set<string>();
    proStaff.filter(s => s.unit === unit).forEach(s => {
        names.add(`${s.name} (${s.id.split('-')[1] || s.id})`);
    });
    return Array.from(names).sort();
  }, [proStaff, unit]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        ...editingItem, 
        date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0], 
        returnDate: editingItem.returnDate ? editingItem.returnDate.split('T')[0] : new Date().toISOString().split('T')[0],
        observations: editingItem.observations || ''
      });
    } else {
      setFormData(defaultState);
    }
  }, [editingItem]);

  const handleSelectStaff = (value: string) => {
      const match = value.match(/\((.*?)\)$/);
      if (match) {
          const rawId = match[1];
          const staff = proStaff.find(s => s.id === `${unit}-${rawId}` || s.id === rawId);
          if (staff && staff.sectorId) {
              const sector = proSectors.find(s => s.id === staff.sectorId);
              setFormData(prev => ({ ...prev, staffName: staff.name, sector: sector ? sector.name : prev.sector }));
              return;
          }
      }
      setFormData(prev => ({ ...prev, staffName: value.split(' (')[0] }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.staffName) {
      showToast("Preencha os campos obrigatórios.");
      return;
    }
    onSubmit({...formData, unit});
    setFormData(defaultState);
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Visita a Colaborador ({unit})</h2>
          <button type="button" onClick={() => setFormData(defaultState)} className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 px-4 py-2 rounded-full border border-rose-100">Limpar</button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Colaborador *</label><Autocomplete options={staffOptions} value={formData.staffName} onChange={v => setFormData({...formData, staffName: v})} onSelectOption={handleSelectStaff} placeholder="Nome ou Matrícula..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local da visita..." isStrict={true} /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Motivo *</label>
            <select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value as VisitReason})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold">
              {Object.values(VisitReason).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-transparent">
              <input type="checkbox" id="requiresReturn" checked={formData.requiresReturn} onChange={e => setFormData({...formData, requiresReturn: e.target.checked})} className="w-6 h-6 rounded-lg text-rose-600 cursor-pointer" />
              <label htmlFor="requiresReturn" className="font-black text-slate-700 text-xs uppercase tracking-widest cursor-pointer">Necessita Retorno?</label>
            </div>
          </div>
          {formData.requiresReturn && (
            <div className="space-y-1 md:col-span-2 animate-in slide-in-from-left duration-300">
              <label className="text-[10px] font-black text-rose-500 ml-2 uppercase">Agendar Retorno para *</label>
              <input type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full p-4 rounded-2xl border-2 border-rose-100 text-rose-700 font-bold" />
            </div>
          )}
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-rose-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs">Salvar Visita</button>
      </form>

      <HistorySection<StaffVisit>
        data={history}
        users={users}
        currentUser={currentUser}
        isLoading={isLoading}
        searchFields={['staffName']}
        renderItem={(item) => (
          <HistoryCard 
            key={item.id} 
            icon="🤝" 
            color="text-rose-600" 
            title={item.staffName} 
            subtitle={`${item.sector} • ${item.reason}`} 
            chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
            isLocked={isRecordLocked(item.date, currentUser.role)}
            onEdit={() => onEdit?.(item)} 
            onDelete={() => onDelete(item.id)} 
            extra={
              <div className="flex gap-2">
                {item.requiresReturn && (
                  <button onClick={() => onToggleReturn?.(item.id)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md ${item.returnCompleted ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-500'}`}>
                    <i className={`fas ${item.returnCompleted ? 'fa-check' : 'fa-flag'}`}></i>
                  </button>
                )}
              </div>
            }
          />
        )}
      />
    </div>
  );
};

export default StaffVisitForm;
