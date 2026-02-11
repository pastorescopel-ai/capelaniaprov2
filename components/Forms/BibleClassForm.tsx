
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, RecordStatus, BibleClass, User, UserRole, ParticipantType } from '../../types';
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
  const { proStaff, proSectors, syncMasterContact } = useApp();
  const { showToast } = useToast();
  
  const getToday = () => new Date().toLocaleDateString('en-CA');
  const defaultState = { id: '', date: getToday(), sector: '', students: [] as string[], guide: '', lesson: '', status: RecordStatus.INICIO, participantType: ParticipantType.STAFF, observations: '' };
  
  const [formData, setFormData] = useState(defaultState);
  const [newStudent, setNewStudent] = useState('');

  // --- RESET INTELIGENTE AO ENTRAR NA ABA ---
  useEffect(() => {
    if (!editingItem) {
      setFormData(prev => ({ ...defaultState, date: prev.date || getToday() }));
    }
  }, []); // Executa apenas na montagem (entrada na aba)

  // --- SUGESTÕES DE GUIAS ---
  const guideOptions = useMemo(() => {
    const uniqueGuides = new Set<string>();
    allHistory.forEach(c => { if (c.guide) uniqueGuides.add(c.guide); });
    return Array.from(uniqueGuides).sort().map(g => ({ value: g, label: g }));
  }, [allHistory]);

  const studentSearchOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const filterSectorId = formData.sector ? proSectors.find(s => s.name === formData.sector && s.unit === unit)?.id : null;
    
    proStaff.filter(s => s.unit === unit).forEach(staff => {
      const sector = proSectors.find(sec => sec.id === staff.sectorId);
      options.push({ value: staff.name, label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`, subLabel: sector ? sector.name : 'Setor não informado', category: 'RH' });
    });

    const uniqueHistoryNames = new Set<string>();
    allHistory.forEach(c => {
       if (Array.isArray(c.students)) {
         c.students.forEach(s => {
           const norm = normalizeString(s);
           if (!uniqueHistoryNames.has(norm)) {
             uniqueHistoryNames.add(norm);
             options.push({ value: s.trim(), label: s.trim(), subLabel: c.sector, category: 'History' });
           }
         });
       }
    });
    return options;
  }, [proStaff, proSectors, unit, allHistory, formData.sector]);

  // --- O IMÃ DE SETORES: Carga Automática + Continuidade ---
  useEffect(() => {
    if (formData.sector && !editingItem && formData.participantType === ParticipantType.STAFF) {
        const sectorObj = proSectors.find(s => s.name === formData.sector && s.unit === unit);
        
        if (sectorObj) {
            // 1. CARGA AUTOMÁTICA DA CLASSE
            // Puxa todos os colaboradores ativos deste setor
            const staffInSector = proStaff.filter(s => s.sectorId === sectorObj.id && s.active);
            const autoStudents = staffInSector.map(s => `${s.name} (${String(s.id).split('-')[1] || s.id})`);
            
            if (autoStudents.length > 0) {
                // 2. CONTINUIDADE INTELIGENTE
                // Busca o último registro de classe feito neste setor para sugerir lição
                const lastClass = [...allHistory]
                    .filter(c => c.sector === formData.sector && c.unit === unit)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                
                let nextLesson = '';
                let nextGuide = '';
                let nextStatus = RecordStatus.INICIO; // Padrão
                
                if (lastClass) {
                    nextGuide = lastClass.guide;
                    const lastNum = parseInt(lastClass.lesson);
                    nextLesson = !isNaN(lastNum) ? (lastNum + 1).toString() : lastClass.lesson;
                    
                    // Lógica de Status Automático: Se já tem histórico no setor, muda para Continuação
                    nextStatus = RecordStatus.CONTINUACAO;
                }

                if (formData.students.length === 0) {
                    setFormData(prev => ({
                        ...prev,
                        students: autoStudents,
                        guide: nextGuide || prev.guide,
                        lesson: nextLesson || prev.lesson,
                        status: nextStatus
                    }));
                    showToast(`${autoStudents.length} alunos carregados do setor.`, "info");
                }
            }
        }
    }
  }, [formData.sector, proSectors, proStaff, unit, allHistory, editingItem, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ ...editingItem, participantType: editingItem.participantType || ParticipantType.STAFF, date: editingItem.date ? editingItem.date.split('T')[0] : getToday() });
    }
  }, [editingItem]);

  const addStudent = (val?: string) => { 
    const inputVal = val || newStudent;
    const nameToAdd = inputVal.split(' (')[0].trim();
    
    // Strict Mode para alunos na Classe Bíblica (se for Colaborador/RH)
    if (formData.participantType === ParticipantType.STAFF) {
        const staffExists = proStaff.some(s => normalizeString(s.name) === normalizeString(nameToAdd) && s.unit === unit);
        if (!staffExists) {
            showToast("Aluno não encontrado no banco de colaboradores. Busque novamente.", "warning");
            setNewStudent('');
            return;
        }
    }

    const fullLabel = studentSearchOptions.find(o => o.value === nameToAdd || o.label === inputVal)?.label;
    const finalString = fullLabel || nameToAdd;

    if (finalString) { 
      if (formData.students.includes(finalString)) {
        showToast("Aluno já está na lista.");
        return;
      }
      setFormData({...formData, students: [...formData.students, finalString]}); 
      setNewStudent(''); 
    } 
  };

  const handleClear = () => {
    setFormData({ ...defaultState, date: formData.date });
    showToast("Campos limpos!", "info");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sector || formData.students.length === 0 || !formData.guide || !formData.lesson) {
        showToast("Preencha todos os campos obrigatórios.");
        return;
    }

    // --- VALIDAÇÃO RESTRITA (STRICT MODE) ---
    // Colaborador e Paciente: Setor deve estar na lista oficial
    if (formData.participantType === ParticipantType.STAFF || formData.participantType === ParticipantType.PATIENT) {
        const sectorExists = proSectors.some(s => s.name === formData.sector && s.unit === unit);
        if (!sectorExists) {
            showToast("Selecione um setor oficial válido da lista.", "warning");
            return;
        }
    }

    // --- CURA DE DADOS (DATA HEALING) ---
    if (formData.participantType === ParticipantType.STAFF) {
        formData.students.forEach(studentStr => {
            const nameOnly = studentStr.split(' (')[0].trim();
            syncMasterContact(nameOnly, "", unit, ParticipantType.STAFF, formData.sector).catch(console.error);
        });
    }

    onSubmit({...formData, unit, participantType: formData.participantType });
    setFormData({ ...defaultState, date: getToday() });
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Classe Bíblica</h2>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start">
                {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
                <button key={type} type="button" onClick={() => setFormData({...formData, participantType: type, students: []})} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === type ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>{type}</button>
                ))}
            </div>
            <button type="button" onClick={handleClear} className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 transition-all flex items-center justify-center text-lg shadow-sm" title="Limpar Campos">
                <i className="fas fa-eraser"></i>
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Local</label><Autocomplete options={sectors.map(s => ({value: s, label: s}))} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local..." isStrict={formData.participantType !== ParticipantType.PROVIDER} /></div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Chamada de Presença</label>
            <div className="flex gap-2">
              <div className="flex-1"><Autocomplete options={studentSearchOptions} value={newStudent} onChange={setNewStudent} onSelectOption={addStudent} required={false} placeholder="Buscar por nome..." isStrict={formData.participantType === ParticipantType.STAFF} /></div>
              <button type="button" onClick={() => addStudent()} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg hover:bg-indigo-700 transition-all"><i className="fas fa-plus"></i></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 max-h-40 overflow-y-auto no-scrollbar">
              {formData.students.map((s, i) => (
                <div key={i} className="pl-4 pr-2 py-2 rounded-xl flex items-center gap-3 font-black text-[9px] uppercase border bg-indigo-50 text-indigo-700 border-indigo-100 animate-in zoom-in duration-200">
                  <span>{s}</span>
                  <button type="button" onClick={() => setFormData({...formData, students: formData.students.filter((_, idx) => idx !== i)})} className="w-6 h-6 hover:bg-rose-100 rounded-lg text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center"><i className="fas fa-times text-[10px]"></i></button>
                </div>
              ))}
              {formData.students.length === 0 && <span className="text-xs text-slate-400 italic px-2">Nenhum aluno selecionado. Escolha um setor para carregar automaticamente.</span>}
            </div>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome da Classe</label><Autocomplete options={guideOptions} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Ex: Classe Sábado" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Lição nº</label><input type="number" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Status</label><div className="flex gap-2">{STATUS_OPTIONS.map(opt => (<button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>{opt}</button>))}</div></div>
        </div>
        <button type="submit" className="w-full py-6 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs hover:bg-indigo-700">Salvar Classe Bíblica</button>
      </form>
      <HistorySection<BibleClass> title="Histórico de Classes" data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['guide', 'students']} renderItem={(item) => (
          <HistoryCard key={item.id} icon="👥" color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-indigo-600"} title={item.guide || 'Classe Bíblica'} subtitle={`${item.sector} • ${item.students.length} alunos`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} isAdmin={currentUser.role === UserRole.ADMIN} users={users} onTransfer={(newUid) => onTransfer?.('class', item.id, newUid)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} />
        )}
      />
    </div>
  );
};

export default BibleClassForm;
