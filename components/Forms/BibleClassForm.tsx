
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Unit, RecordStatus, BibleClass, User, UserRole, MasterLists, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';
import { getFirstName } from '../../utils/formatters';

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

const BibleClassForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit, onTransfer }) => {
  const { proStaff } = useApp();
  const defaultState = { 
    id: '', 
    date: new Date().toISOString().split('T')[0], 
    sector: '', 
    students: [] as string[], 
    guide: '', 
    lesson: '', 
    status: RecordStatus.INICIO, 
    participantType: ParticipantType.STAFF,
    observations: '' 
  };
  
  const [formData, setFormData] = useState(defaultState);
  const [newStudent, setNewStudent] = useState('');
  const { showToast } = useToast();

  const classGuides = useMemo(() => {
    const guides = new Set<string>();
    allHistory
      .filter(c => c.userId === currentUser.id)
      .forEach(c => { if(c.guide) guides.add(c.guide.trim()); });
    return Array.from(guides);
  }, [allHistory, currentUser.id]);

  const staffOptions = useMemo(() => {
    if (formData.participantType !== ParticipantType.STAFF) return [];
    return proStaff
      .filter(s => s.unit === unit)
      .map(s => `${s.name} (${s.id})`)
      .sort();
  }, [proStaff, unit, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        ...editingItem, 
        participantType: editingItem.participantType || ParticipantType.STAFF,
        date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0],
        observations: editingItem.observations || ''
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setFormData(defaultState);
    }
  }, [editingItem]);

  const addStudent = (val?: string) => { 
    const nameToAdd = (val || newStudent).split(' (')[0].trim();
    if (nameToAdd) { 
      if (formData.students.includes(nameToAdd)) {
        showToast("Aluno já está na lista.");
        return;
      }
      setFormData({...formData, students: [...formData.students, nameToAdd]}); 
      setNewStudent(''); 
    } 
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isFreeMode = formData.participantType !== ParticipantType.STAFF;

    if (!formData.date || (!isFreeMode && !formData.sector) || !formData.guide || !formData.lesson || formData.students.length === 0) {
      showToast("Preencha os campos obrigatórios!");
      return;
    }

    const finalData = { 
        ...formData, 
        unit,
        sector: isFreeMode && !formData.sector ? 'Atendimento Externo/Geral' : formData.sector 
    };

    onSubmit(finalData);
    setFormData(defaultState);
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">Classe Bíblica ({unit})</h2>
          
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 self-start">
             {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
               <button
                 key={type}
                 type="button"
                 onClick={() => setFormData({...formData, participantType: type})}
                 className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${formData.participantType === type ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {type}
               </button>
             ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor {formData.participantType === ParticipantType.STAFF ? '*' : '(Opcional)'}</label>
            <Autocomplete 
                options={sectors} 
                value={formData.sector} 
                onChange={v => setFormData({...formData, sector: v})} 
                placeholder={formData.participantType === ParticipantType.STAFF ? "Local da classe..." : "Opcional p/ externos"} 
                isStrict={formData.participantType === ParticipantType.STAFF} 
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lista de Presença (Busca por Nome ou Matrícula) *</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Autocomplete 
                  options={staffOptions} 
                  value={newStudent} 
                  onChange={setNewStudent} 
                  onSelectOption={addStudent}
                  placeholder={formData.participantType === ParticipantType.STAFF ? "Digite o nome do aluno..." : "Digite o nome e clique em +"} 
                />
              </div>
              <button type="button" onClick={() => addStudent()} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg hover:bg-indigo-700 transition-all"><i className="fas fa-plus"></i></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {formData.students.map((s, i) => (
                <div key={i} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase border border-indigo-100 animate-in fade-in">
                  {s} <button type="button" onClick={() => setFormData({...formData, students: formData.students.filter((_, idx) => idx !== i)})} className="hover:text-rose-500"><i className="fas fa-times-circle"></i></button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome da Classe *</label><Autocomplete options={classGuides} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Ex: Classe Adventista" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lição Ministrada *</label><input type="number" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs active:scale-95 transition-all">Salvar Classe</button>
      </form>

      <HistorySection<BibleClass>
        title="Histórico de Classes"
        data={history}
        users={users}
        currentUser={currentUser}
        isLoading={isLoading}
        searchFields={['guide', 'students']} 
        renderItem={(item) => (
          <HistoryCard 
            key={item.id} 
            icon="👥" 
            color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-indigo-600"} 
            title={item.guide || 'Classe Bíblica'} 
            subtitle={`${item.sector} • ${item.students.length} alunos • ${item.status}`} 
            chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
            isLocked={isRecordLocked(item.date, currentUser.role)}
            isAdmin={currentUser.role === UserRole.ADMIN}
            users={users}
            onTransfer={(newUid) => onTransfer?.('class', item.id, newUid)}
            onEdit={() => onEdit?.(item)} 
            onDelete={() => onDelete(item.id)} 
            middle={
              <div className="flex flex-col items-center gap-1">
                {item.participantType && item.participantType !== ParticipantType.STAFF && (
                  <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${item.participantType === ParticipantType.PATIENT ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.participantType}
                  </span>
                )}
                <div className="flex flex-wrap gap-1">
                    {item.students.slice(0, 3).map((s, idx) => (
                    <span key={idx} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">{getFirstName(s)}</span>
                    ))}
                    {item.students.length > 3 && <span className="text-[8px] text-slate-300 font-bold">+{item.students.length - 3}</span>}
                </div>
              </div>
            }
          />
        )}
      />
    </div>
  );
};

export default BibleClassForm;
