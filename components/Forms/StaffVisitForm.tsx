import React, { useState, useEffect, useRef } from 'react';
import { Unit, StaffVisit, User, UserRole, MasterLists, VisitReason } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { resolveDynamicName } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';

interface FormProps {
  unit: Unit;
  sectors: string[];
  staffList?: string[];
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

const StaffVisitForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, masterLists, staffList = [], history, editingItem, isLoading, onSubmit, onDelete, onEdit, onToggleReturn }) => {
  const defaultState = { id: '', date: new Date().toISOString().split('T')[0], sector: '', reason: VisitReason.AGENDAMENTO, staffName: '', requiresReturn: false, returnDate: new Date().toISOString().split('T')[0], returnCompleted: false, observations: '' };
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        ...editingItem, 
        date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0], 
        returnDate: editingItem.returnDate ? editingItem.returnDate.split('T')[0] : new Date().toISOString().split('T')[0],
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
    showToast("Campos de visita limpos.", "success");
    firstInputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.staffName) {
      showToast("Atenção: Data, Setor e Colaborador são obrigatórios!");
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
          <button 
            type="button" 
            onClick={handleClear} 
            className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 px-4 py-2 rounded-full border border-rose-100 hover:bg-rose-100 transition-colors"
          >
            <i className="fas fa-eraser mr-1"></i> Limpar / Nova Visita
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data Atendimento *</label><input ref={firstInputRef} type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local da visita..." isStrict={true} /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Colaborador *</label><Autocomplete options={staffList} value={formData.staffName} onChange={v => setFormData({...formData, staffName: v})} placeholder="Nome do colaborador..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Motivo *</label>
            <select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value as VisitReason})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold">
              {Object.values(VisitReason).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-rose-100 transition-colors">
              <input type="checkbox" id="requiresReturn" checked={formData.requiresReturn} onChange={e => setFormData({...formData, requiresReturn: e.target.checked})} className="w-6 h-6 rounded-lg text-rose-600 focus:ring-rose-500 cursor-pointer" />
              <label htmlFor="requiresReturn" className="font-black text-slate-700 text-xs uppercase tracking-widest cursor-pointer">Necessita Retorno?</label>
            </div>
          </div>
          {formData.requiresReturn && (
            <div className="space-y-1 md:col-span-2 animate-in slide-in-from-left duration-300">
              <label className="text-[10px] font-black text-rose-500 ml-2 uppercase">Agendar Retorno para *</label>
              <input type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full p-4 rounded-2xl bg-rose border-2 border-rose-100 text-rose-700 font-bold" />
            </div>
          )}
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-rose-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs">Salvar Visita</button>
      </form>

      <HistorySection<StaffVisit>
        title="Histórico de Visitas"
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
            title={resolveDynamicName(item.staffName, item.unit === Unit.HAB ? masterLists.staffHAB : masterLists.staffHABA)} 
            subtitle={`${resolveDynamicName(item.sector, item.unit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA)} • ${item.reason}`} 
            chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
            isLocked={isRecordLocked(item.date, currentUser.role)}
            onEdit={() => onEdit?.(item)} 
            onDelete={() => onDelete(item.id)} 
            middle={item.requiresReturn && !item.returnCompleted && item.returnDate && (
              <div className="bg-rose-500 text-white px-5 py-3 rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 border-white animate-in zoom-in">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80 mb-1 leading-none">Retorno em</span>
                <span className="text-base md:text-lg font-black tracking-tighter leading-none">{item.returnDate.split('-').reverse().join('/')}</span>
              </div>
            )}
            extra={
              <div className="flex gap-2">
                {item.requiresReturn && (
                  <button onClick={() => onToggleReturn?.(item.id)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md ${item.returnCompleted ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-500 animate-pulse'}`}>
                    <i className={`fas ${item.returnCompleted ? 'fa-check' : 'fa-flag'} text-base`}></i>
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