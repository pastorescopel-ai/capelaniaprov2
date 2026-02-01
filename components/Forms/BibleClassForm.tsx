import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Unit, RecordStatus, BibleClass, User, UserRole, MasterLists } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { resolveDynamicName } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';

interface FormProps {
  unit: Unit;
  sectors: string[];
  users: User[];
  currentUser: User;
  masterLists: MasterLists;
  history: BibleClass[];
  allHistory?: BibleClass[];
  editingItem?: BibleClass;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: BibleClass) => void;
  onSubmit: (data: any) => void;
  onTransfer?: (type: string, id: string, newUserId: string) => void;
}

const BibleClassForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, masterLists, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit, onTransfer }) => {
  const defaultState = { id: '', date: new Date().toISOString().split('T')[0], sector: '', students: [] as string[], guide: '', lesson: '', status: RecordStatus.INICIO, observations: '' };
  const [formData, setFormData] = useState(defaultState);
  const [newStudent, setNewStudent] = useState('');
  const { showToast } = useToast();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const classGuides = useMemo(() => {
    const guides = new Set<string>();
    allHistory
      .filter(c => c.userId === currentUser.id)
      .forEach(c => { if(c.guide) guides.add(c.guide.trim()); });
    return Array.from(guides);
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

  const handleSelectClass = (guideName: string) => {
    const lastClass = [...allHistory]
      .filter(c => c.userId === currentUser.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .find(c => c.guide.trim().toLowerCase() === guideName.trim().toLowerCase());

    if (lastClass) {
      setFormData({
        ...lastClass,
        id: lastClass.id,
        date: new Date().toISOString().split('T')[0],
        status: lastClass.status === RecordStatus.TERMINO ? RecordStatus.TERMINO : RecordStatus.CONTINUACAO,
        lesson: lastClass.status === RecordStatus.TERMINO ? lastClass.lesson : (parseInt(lastClass.lesson) + 1).toString(),
        observations: ''
      });
    }
  };

  const addStudent = () => { if (newStudent.trim()) { setFormData({...formData, students: [...formData.students, newStudent.trim()]}); setNewStudent(''); } };

  const handleClear = () => {
    setFormData(defaultState);
    setNewStudent('');
    showToast("Campos da classe limpos.", "success");
    firstInputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.guide || !formData.lesson || formData.students.length === 0) {
      showToast("Atenção: Data, Setor, Classe, Lição e pelo menos um Aluno são obrigatórios!");
      return;
    }
    onSubmit({...formData, unit});
    setFormData(defaultState);
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Classe Bíblica ({unit})</h2>
          <button 
            type="button" 
            onClick={handleClear} 
            className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 px-4 py-2 rounded-full border border-rose-100 hover:bg-rose-100 transition-colors"
          >
            <i className="fas fa-eraser mr-1"></i> Limpar Campos
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data *</label><input ref={firstInputRef} type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Escolha o setor..." isStrict={true} /></div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lista de Presença *</label>
            <div className="flex gap-2">
              <input value={newStudent} onChange={e => setNewStudent(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addStudent())} placeholder="Nome do aluno" className="flex-1 p-4 rounded-2xl bg-slate-50 border-none" />
              <button type="button" onClick={addStudent} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg hover:bg-indigo-700 transition-all"><i className="fas fa-plus"></i></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {formData.students.map((s, i) => (
                <div key={i} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm border border-indigo-100 animate-in fade-in duration-300">
                  {s} <button type="button" onClick={() => setFormData({...formData, students: formData.students.filter((_, idx) => idx !== i)})} className="hover:text-rose-500 transition-colors"><i className="fas fa-times-circle"></i></button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome da Classe (Suas Classes) *</label>
            <Autocomplete 
              options={classGuides} 
              value={formData.guide} 
              onChange={v => setFormData({...formData, guide: v})} 
              onSelectOption={handleSelectClass}
              placeholder="Digite para buscar sua classe..." 
            />
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lição Ministrada *</label><input type="number" min="1" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 font-black" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status da Classe *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest active:scale-95 transition-all">
          {formData.id ? 'Atualizar Classe Existente' : 'Salvar Nova Classe'}
        </button>
      </form>

      <HistorySection<BibleClass>
        title="Histórico de Classes"
        data={history}
        users={users}
        currentUser={currentUser}
        isLoading={isLoading}
        searchFields={['guide', 'students']} 
        renderItem={(item) => {
          const namesList = item.students.slice(0, 2).join(', ');
          const remaining = item.students.length > 2 ? ` (+${item.students.length - 2})` : '';
          const nominalSubtitle = `${namesList}${remaining}`;

          return (
            <HistoryCard 
              key={item.id} 
              icon="👥" 
              color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-indigo-600"} 
              title={item.guide || 'Classe Bíblica'} 
              subtitle={`${resolveDynamicName(item.sector, item.unit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA)} • ${nominalSubtitle} • ${item.status}`} 
              chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
              isLocked={isRecordLocked(item.date, currentUser.role)}
              isAdmin={currentUser.role === UserRole.ADMIN}
              users={users}
              onTransfer={(newUid) => onTransfer?.('class', item.id, newUid)}
              onEdit={() => onEdit?.(item)} 
              onDelete={() => onDelete(item.id)} 
            />
          );
        }}
      />
    </div>
  );
};

export default BibleClassForm;