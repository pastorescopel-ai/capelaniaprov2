
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, RecordStatus, BibleClass, User, UserRole, MasterLists, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete, { AutocompleteOption } from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';
import { getFirstName, normalizeString } from '../../utils/formatters';

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
  const { proStaff, proSectors } = useApp();
  
  const getToday = () => new Date().toLocaleDateString('en-CA');

  const defaultState = { 
    id: '', 
    date: getToday(), 
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
  
  // Estados para o Modal de Vinculação Manual
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [studentToLinkIndex, setStudentToLinkIndex] = useState<number | null>(null);
  const [studentToLinkName, setStudentToLinkName] = useState('');
  
  const { showToast } = useToast();

  const studentSearchOptions = useMemo(() => {
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

    const uniqueHistoryNames = new Set<string>();
    allHistory.forEach(c => {
       if (Array.isArray(c.students)) {
         c.students.forEach(s => {
           const norm = normalizeString(s);
           if (!uniqueHistoryNames.has(norm)) {
             uniqueHistoryNames.add(norm);
             options.push({
               value: s.trim(),
               label: s.trim(),
               subLabel: c.sector,
               category: 'History'
             });
           }
         });
       }
    });

    return options;
  }, [proStaff, proSectors, unit, allHistory]);

  // Opções apenas de RH para o Modal de Vinculação
  const rhOnlyOptions = useMemo(() => {
    return studentSearchOptions.filter(o => o.category === 'RH');
  }, [studentSearchOptions]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        ...editingItem, 
        participantType: editingItem.participantType || ParticipantType.STAFF,
        date: editingItem.date ? editingItem.date.split('T')[0] : getToday(),
        observations: editingItem.observations || ''
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setFormData({ ...defaultState, date: getToday() });
    }
  }, [editingItem]);

  const addStudent = (val?: string) => { 
    const inputVal = val || newStudent;
    const nameToAdd = inputVal.split(' (')[0].trim();
    
    // Se selecionou do autocomplete oficial, usa o label completo (com ID)
    const fullLabel = studentSearchOptions.find(o => o.value === nameToAdd || o.label === inputVal)?.label;
    const finalString = fullLabel || nameToAdd;

    if (finalString) { 
      if (formData.students.includes(finalString)) {
        showToast("Aluno já está na lista.");
        return;
      }

      if (formData.students.length === 0) {
          const lastRecord = [...allHistory]
            .filter(h => h.userId === currentUser.id && h.students && h.students.some(s => normalizeString(s).includes(normalizeString(nameToAdd.split(' ')[0]))))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          
          if (lastRecord) {
              const nextLesson = !isNaN(Number(lastRecord.lesson)) ? (Number(lastRecord.lesson) + 1).toString() : lastRecord.lesson;
              setFormData(prev => ({
                  ...prev,
                  students: [...prev.students, finalString],
                  guide: lastRecord.guide || prev.guide,
                  lesson: nextLesson
              }));
              showToast(`Histórico de estudo recuperado.`, "info");
              setNewStudent(''); 
              return;
          }
      }

      setFormData({...formData, students: [...formData.students, finalString]}); 
      setNewStudent(''); 
    } 
  };

  const openLinkModal = (index: number, currentName: string) => {
    setStudentToLinkIndex(index);
    setStudentToLinkName(currentName.split(' (')[0]); // Tenta limpar ID antigo se houver
    setLinkModalOpen(true);
  };

  const handleManualLinkSelection = (selectedLabel: string) => {
    if (studentToLinkIndex === null) return;

    const updatedStudents = [...formData.students];
    updatedStudents[studentToLinkIndex] = selectedLabel; // Substitui pelo oficial
    setFormData({ ...formData, students: updatedStudents });
    
    setLinkModalOpen(false);
    setStudentToLinkIndex(null);
    showToast("Aluno vinculado ao cadastro oficial!", "success");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.guide || !formData.lesson || formData.students.length === 0) {
      showToast("Preencha todos os campos obrigatórios!");
      return;
    }
    onSubmit({...formData, unit});
    setFormData({ ...defaultState, date: getToday() });
  };

  return (
    <div className="space-y-10 pb-20 relative">
      
      {/* MODAL DE VINCULAÇÃO MANUAL */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setLinkModalOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in duration-200 border-4 border-amber-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <i className="fas fa-link text-amber-500"></i> Vincular Aluno
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Quem é <strong className="text-slate-800">"{formData.students[studentToLinkIndex!]?.split(' (')[0]}"</strong> no banco oficial?
                </p>
              </div>
              <button onClick={() => setLinkModalOpen(false)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 flex items-center justify-center">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-2">Pesquisar Colaborador (RH)</label>
              <Autocomplete 
                options={rhOnlyOptions}
                value={studentToLinkName}
                onChange={setStudentToLinkName}
                onSelectOption={handleManualLinkSelection}
                placeholder="Digite o nome ou matrícula..."
                className="w-full p-4 rounded-2xl bg-amber-50 border-2 border-amber-100 focus:border-amber-400 focus:bg-white transition-all font-bold text-slate-700"
              />
              <p className="text-[9px] text-slate-400 text-center italic mt-2">
                Ao selecionar, o nome na lista será atualizado para o formato oficial.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Classe Bíblica</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidade {unit}</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start">
             {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
               <button
                 key={type}
                 type="button"
                 onClick={() => setFormData({...formData, participantType: type})}
                 className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === type ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {type}
               </button>
             ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Local *</label>
            <Autocomplete 
                options={sectors.map(s => ({value: s, label: s}))} 
                value={formData.sector} 
                onChange={v => setFormData({...formData, sector: v})} 
                placeholder="Local onde ocorre a classe..." 
                isStrict={true} 
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Chamada de Presença (Busca Inteligente) *</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Autocomplete 
                  options={studentSearchOptions} 
                  value={newStudent} 
                  onChange={setNewStudent} 
                  onSelectOption={addStudent}
                  required={false}
                  placeholder="Busque por nome ou matrícula..." 
                />
              </div>
              <button type="button" onClick={() => addStudent()} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg hover:bg-indigo-700 transition-all"><i className="fas fa-plus"></i></button>
            </div>
            
            {/* Lista de Alunos com Funcionalidade de Vínculo Manual */}
            <div className="flex flex-wrap gap-2 mt-4">
              {formData.students.map((s, i) => {
                // Verifica se tem formato oficial: Nome (ID)
                const isOfficialFormat = /\(.*\)$/.test(s);

                return (
                  <div key={i} className={`pl-4 pr-2 py-2 rounded-xl flex items-center gap-3 font-black text-[9px] uppercase border transition-all animate-in zoom-in duration-200 group ${
                    isOfficialFormat 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100' // OFICIAL (VERDE/AZUL)
                      : 'bg-amber-50 text-amber-700 border-amber-100'    // MANUAL (LARANJA)
                  }`}>
                    <span>{s}</span>
                    
                    {/* Botão de Vínculo (Aparece apenas se NÃO for oficial) */}
                    {!isOfficialFormat && (
                      <button 
                        type="button" 
                        onClick={() => openLinkModal(i, s)}
                        title="Vincular a um colaborador oficial do RH"
                        className="w-6 h-6 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-600 flex items-center justify-center transition-transform hover:scale-110"
                      >
                        <i className="fas fa-link text-[10px]"></i>
                      </button>
                    )}

                    {/* Check de Confirmado (Aparece se FOR oficial) */}
                    {isOfficialFormat && (
                         <i className="fas fa-check-circle text-indigo-400 text-xs"></i>
                    )}

                    <div className="w-px h-4 bg-black/5 mx-1"></div>

                    <button type="button" onClick={() => setFormData({...formData, students: formData.students.filter((_, idx) => idx !== i)})} className="w-6 h-6 hover:bg-rose-100 rounded-lg text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center">
                      <i className="fas fa-times text-[10px]"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome da Classe *</label><Autocomplete options={allHistory.map(h => ({value: h.guide, label: h.guide}))} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Ex: Classe de Sabado" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nº da Lição Ministrada *</label><input type="number" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Status *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium" /></div>
        </div>
        <button type="submit" className="w-full py-6 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs active:scale-95 transition-all hover:bg-indigo-700">Salvar Classe Bíblica</button>
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
