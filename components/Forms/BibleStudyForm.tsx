import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Unit, RecordStatus, BibleStudy, User, UserRole, MasterLists } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { formatWhatsApp, resolveDynamicName } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';

interface FormProps {
  unit: Unit;
  sectors: string[];
  users: User[];
  currentUser: User;
  masterLists: MasterLists;
  history: BibleStudy[];
  allHistory?: BibleStudy[];
  editingItem?: BibleStudy;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: BibleStudy) => void;
  onSubmit: (data: any) => void;
  onTransfer?: (type: string, id: string, newUserId: string) => void;
}

const BibleStudyForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, masterLists, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit, onTransfer }) => {
  const defaultState = { id: '', date: new Date().toISOString().split('T')[0], sector: '', name: '', whatsapp: '', status: RecordStatus.INICIO, guide: '', lesson: '', observations: '' };
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();
  const firstInputRef = useRef<HTMLInputElement>(null);
  
  const studySuggestions = ["Ouvindo a voz de Deus", "Verdade e Vida", "Apocalipse", "Daniel"];

  const studentNames = useMemo(() => {
    const names = new Set<string>();
    allHistory
      .filter(s => s.userId === currentUser.id)
      .forEach(s => { if(s.name) names.add(s.name.trim()); });
    return Array.from(names);
  }, [allHistory, currentUser.id]);

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

  const handleSelectStudent = (name: string) => {
    const lastRecord = [...allHistory]
      .filter(s => s.userId === currentUser.id) 
      .sort((a, b) => b.createdAt - a.createdAt)
      .find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());

    if (lastRecord) {
      setFormData({
        ...lastRecord,
        id: lastRecord.id,
        date: new Date().toISOString().split('T')[0],
        status: lastRecord.status === RecordStatus.TERMINO ? RecordStatus.TERMINO : RecordStatus.CONTINUACAO,
        lesson: lastRecord.status === RecordStatus.TERMINO ? lastRecord.lesson : (parseInt(lastRecord.lesson) + 1).toString(),
        observations: ''
      });
    }
  };

  const handleClear = () => {
    setFormData(defaultState);
    showToast("Formulário resetado para novo registro.", "success");
    firstInputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.name || !formData.whatsapp || !formData.guide || !formData.lesson) {
      showToast("Atenção: Todos os campos com (*) são obrigatórios!");
      return;
    }
    onSubmit({ ...formData, unit });
    setFormData(defaultState);
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Estudo Bíblico ({unit})</h2>
          <button 
            type="button" 
            onClick={handleClear} 
            className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 px-4 py-2 rounded-full border border-rose-100 hover:bg-rose-100 transition-colors"
          >
            <i className="fas fa-eraser mr-1"></i> Limpar / Novo Aluno
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data Atendimento *</label><input ref={firstInputRef} type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Selecione o setor..." isStrict={true} /></div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome do Aluno (Seus Alunos) *</label>
            <Autocomplete 
              options={studentNames} 
              value={formData.name} 
              onChange={v => setFormData({...formData, name: v})} 
              onSelectOption={handleSelectStudent}
              placeholder="Digite para buscar seu aluno..." 
            />
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">WhatsApp *</label><input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-mono" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Guia de Estudo *</label><Autocomplete options={studySuggestions} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Selecione ou digite o guia..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lição Atual *</label><input type="number" min="1" placeholder="Ex: 5" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-black" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-50 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações do Encontro</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest active:scale-95 transition-all">
          {formData.id ? 'Atualizar Progresso do Aluno' : 'Salvar Novo Aluno'}
        </button>
      </form>

      <HistorySection<BibleStudy>
        data={history}
        users={users}
        currentUser={currentUser}
        isLoading={isLoading}
        searchFields={['name']}
        renderItem={(item) => (
          <HistoryCard 
            key={item.id} 
            icon="📖" 
            color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-blue-600"} 
            title={item.name} 
            subtitle={`${resolveDynamicName(item.sector, item.unit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA)} • Lição ${item.lesson} • ${item.status}`} 
            chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
            isLocked={isRecordLocked(item.date, currentUser.role)}
            isAdmin={currentUser.role === UserRole.ADMIN}
            users={users}
            onTransfer={(newUid) => onTransfer?.('study', item.id, newUid)}
            onEdit={() => onEdit?.(item)} 
            onDelete={() => onDelete(item.id)} 
            extra={
              <div className="flex gap-2">
                {item.status === RecordStatus.TERMINO && <span className="text-[8px] bg-rose-50 text-rose-600 px-2 py-1 rounded-lg font-black uppercase flex items-center">Concluído</span>}
              </div>
            }
          />
        )}
      />
    </div>
  );
};

export default BibleStudyForm;