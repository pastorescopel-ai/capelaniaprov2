
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Unit, RecordStatus, BibleClass, User, UserRole, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
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
  
  const getToday = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const defaultState = useMemo(() => ({ id: '', date: getToday(), sector: '', students: [] as string[], guide: '', lesson: '', status: RecordStatus.INICIO, participantType: ParticipantType.STAFF, observations: '', representativePhone: '' }), [getToday]);
  
  const [formData, setFormData] = useState(defaultState);
  const [newStudent, setNewStudent] = useState('');

  const lastClassStudents = useMemo(() => {
    if (!formData.sector || !unit) return [];
    const lastClass = [...allHistory]
      .filter(c => c.sector === formData.sector && c.unit === unit)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return lastClass?.students || [];
  }, [formData.sector, allHistory, unit]);

  const sectorStaff = useMemo(() => {
    if (!formData.sector || !unit) return [];
    const sectorObj = proSectors.find(s => s.name === formData.sector && s.unit === unit);
    if (!sectorObj) return [];
    return proStaff
      .filter(s => s.sectorId === sectorObj.id && s.active)
      .map(s => `${s.name} (${String(s.id).split('-')[1] || s.id})`);
  }, [formData.sector, proSectors, proStaff, unit]);

  const callList = useMemo(() => {
    const present = formData.students;
    const potential = Array.from(new Set([...lastClassStudents, ...sectorStaff]));
    const absent = potential.filter(s => !present.includes(s));
    
    // Ordenação dos ausentes: alunos da última classe primeiro
    absent.sort((a, b) => {
      const aInLast = lastClassStudents.includes(a);
      const bInLast = lastClassStudents.includes(b);
      if (aInLast && !bInLast) return -1;
      if (!aInLast && bInLast) return 1;
      return a.localeCompare(b);
    });

    return [...present, ...absent];
  }, [formData.students, lastClassStudents, sectorStaff]);

  useEffect(() => {
    if (!editingItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({ ...defaultState, date: prev.date || getToday() }));
    }
  }, [editingItem, defaultState, getToday]);

  const guideOptions = useMemo(() => {
    const uniqueGuides = new Set<string>();
    allHistory.forEach(c => { if (c.guide) uniqueGuides.add(c.guide); });
    return Array.from(uniqueGuides).sort().map(g => ({ value: g, label: g }));
  }, [allHistory]);

  const studentSearchOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const officialSet = new Set<string>();
    
    proStaff.filter(s => s.unit === unit).forEach(staff => {
      const sector = proSectors.find(sec => sec.id === staff.sectorId);
      options.push({ value: staff.name, label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`, subLabel: sector ? sector.name : 'Setor não informado', category: 'RH' });
      officialSet.add(normalizeString(staff.name));
    });

    const uniqueHistoryNames = new Set<string>();
    allHistory.forEach(c => {
       if (Array.isArray(c.students)) {
         c.students.forEach(s => {
           const norm = normalizeString(s);
           if (!uniqueHistoryNames.has(norm) && !officialSet.has(norm)) {
             uniqueHistoryNames.add(norm);
             options.push({ value: s.trim(), label: s.trim(), subLabel: c.sector, category: 'History' });
           }
         });
       }
    });
    return options;
  }, [proStaff, proSectors, unit, allHistory]);

  useEffect(() => {
    if (formData.sector && !editingItem && formData.participantType === ParticipantType.STAFF) {
        const sectorObj = proSectors.find(s => s.name === formData.sector && s.unit === unit);
        if (sectorObj) {
            const lastClass = [...allHistory].filter(c => c.sector === formData.sector && c.unit === unit).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            let nextLesson = '';
            let nextGuide = '';
            let nextStatus = RecordStatus.INICIO; 
            
            if (lastClass) {
                nextGuide = lastClass.guide;
                const lastNum = parseInt(lastClass.lesson);
                nextLesson = !isNaN(lastNum) ? (lastNum + 1).toString() : lastClass.lesson;
                nextStatus = RecordStatus.CONTINUACAO;
            }
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData(prev => ({ ...prev, students: [], guide: nextGuide || prev.guide, lesson: nextLesson || prev.lesson, status: nextStatus }));
        }
    }
  }, [formData.sector, proSectors, proStaff, unit, allHistory, editingItem, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({ ...editingItem, participantType: editingItem.participantType || ParticipantType.STAFF, date: editingItem.date ? editingItem.date.split('T')[0] : getToday(), representativePhone: editingItem.observations?.match(/\[Rep\. WhatsApp: (.*?)\]/)?.[1] || '' });
    }
  }, [editingItem, getToday]);

  const addStudent = (val?: string) => { 
    const inputVal = val || newStudent;
    const nameToAdd = inputVal.split(' (')[0].trim();
    if (formData.participantType === ParticipantType.STAFF) {
        const staffExists = proStaff.some(s => normalizeString(s.name) === normalizeString(nameToAdd) && s.unit === unit);
        if (!staffExists) { showToast("Aluno não encontrado no banco de colaboradores.", "warning"); setNewStudent(''); return; }
    }
    const fullLabel = studentSearchOptions.find(o => o.value === nameToAdd || o.label === inputVal)?.label;
    const finalString = fullLabel || nameToAdd;

    if (finalString) { 
      if (formData.students.includes(finalString)) { showToast("Aluno já está na lista."); return; }
      let peersToAdd: string[] = [];
      let nextGuide = formData.guide;
      let nextLesson = formData.lesson;
      let nextStatus = formData.status;
      let nextPhone = formData.representativePhone;

      // Se for o primeiro aluno e o telefone estiver vazio, tenta buscar no RH
      if (formData.students.length === 0 && !nextPhone) {
          const match = finalString.match(/\((.*?)\)$/);
          let staff: any;
          if (match) staff = proStaff.find(s => s.id === `${unit}-${match[1]}` || s.id === match[1]);
          if (!staff) staff = proStaff.find(s => normalizeString(s.name) === normalizeString(nameToAdd) && s.unit === unit);
          
          if (staff && staff.whatsapp) {
              nextPhone = formatWhatsApp(staff.whatsapp);
              showToast(`WhatsApp de ${nameToAdd} vinculado.`, "info");
          }
      }

      if (formData.participantType !== ParticipantType.STAFF) {
          const lastClassWithStudent = [...allHistory].filter(c => c.students && c.students.includes(finalString)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          if (lastClassWithStudent) {
              peersToAdd = lastClassWithStudent.students.filter(s => s !== finalString && !formData.students.includes(s));
              nextGuide = lastClassWithStudent.guide;
              const lastNum = parseInt(lastClassWithStudent.lesson);
              nextLesson = !isNaN(lastNum) ? (lastNum + 1).toString() : lastClassWithStudent.lesson;
              nextStatus = RecordStatus.CONTINUACAO;
              if (peersToAdd.length > 0) showToast(`Histórico encontrado! Agrupando com ${peersToAdd.length} colega(s).`, "info");
          }
      }
      setFormData(prev => ({ ...prev, students: [...prev.students, finalString, ...peersToAdd], guide: nextGuide, lesson: nextLesson, status: nextStatus, representativePhone: nextPhone })); 
      setNewStudent(''); 
    } 
  };

  const handleClear = () => {
    setFormData({ ...defaultState, date: formData.date });
    showToast("Campos limpos!", "info");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.students.length < 2) { showToast("É necessário pelo menos 2 alunos presentes para salvar a classe.", "warning"); return; }
    if (!formData.guide || !formData.lesson) { showToast("Preencha Guia e Lição."); return; }
    if (formData.participantType === ParticipantType.STAFF) {
        if (!formData.sector) { showToast("Para colaboradores, o Setor é obrigatório.", "warning"); return; }
        if (!proSectors.some(s => s.name === formData.sector && s.unit === unit)) { showToast("Selecione um setor oficial válido da lista.", "warning"); return; }
    } else {
        if (!formData.representativePhone || formData.representativePhone.length < 10) { showToast("O WhatsApp do Representante é obrigatório para este grupo.", "warning"); return; }
    }

    let finalObservations = formData.observations;
    if (formData.participantType !== ParticipantType.STAFF) {
        const repName = formData.students[0].split(' (')[0].trim();
        await syncMasterContact(repName, formData.representativePhone, unit, formData.participantType, formData.sector);
        if (formData.representativePhone) finalObservations = `[Rep. WhatsApp: ${formData.representativePhone}]\n${finalObservations}`;
    } else {
        formData.students.forEach(studentStr => {
            const nameOnly = studentStr.split(' (')[0].trim();
            syncMasterContact(nameOnly, "", unit, ParticipantType.STAFF, formData.sector).catch(console.error);
        });
    }
    onSubmit({ ...formData, unit, participantType: formData.participantType, observations: finalObservations });
    setFormData({ ...defaultState, date: getToday() });
  };

  const isStaff = formData.participantType === ParticipantType.STAFF;

  const headerActions = (
    <>
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start">
          {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
          <button key={type} type="button" onClick={() => setFormData({...formData, participantType: type, students: [], sector: '', representativePhone: ''})} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === type ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>{type}</button>
          ))}
      </div>
      <button type="button" onClick={handleClear} className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 transition-all flex items-center justify-center text-lg shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
    </>
  );

  const historySection = (
    <HistorySection<BibleClass> title="Histórico de Classes" data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['guide', 'students']} renderItem={(item) => (
      <HistoryCard key={item.id} icon="👥" color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-indigo-600"} title={item.guide || 'Classe Bíblica'} subtitle={`${item.sector} • ${item.students.length} alunos`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} isAdmin={currentUser.role === UserRole.ADMIN} users={users} onTransfer={(newUid) => onTransfer?.('class', item.id, newUid)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} />
    )} />
  );

  return (
    <FormScaffold title="Classe Bíblica" headerActions={headerActions} history={historySection}>
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          
          <div className="space-y-1">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${isStaff ? 'text-slate-400' : 'text-slate-300'}`}>Setor / Local {isStaff ? '(Obrigatório)' : '(Opcional)'}</label>
              <Autocomplete options={sectors.map(s => ({value: s, label: s}))} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder={isStaff ? "Selecione o setor..." : "Leito, Quarto ou Área (Opcional)..."} isStrict={isStaff} />
          </div>

          <div className={`space-y-1 ${!isStaff ? 'order-first md:order-none col-span-2 md:col-span-2 animate-in slide-in-from-top-2' : ''}`}>
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${!isStaff ? 'text-indigo-600' : 'text-slate-400'}`}>WhatsApp do Representante {!isStaff ? '*' : '(Opcional)'}</label>
              <input type="text" placeholder="(00) 00000-0000" value={formData.representativePhone} onChange={e => setFormData({...formData, representativePhone: formatWhatsApp(e.target.value)})} className={`w-full p-4 rounded-2xl border-none font-bold transition-all ${!isStaff ? 'bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100 focus:ring-indigo-300' : 'bg-slate-50'}`}/>
          </div>
          
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Chamada de Presença {isStaff ? '' : '(Imã de Histórico Ativo 🧲)'}</label>
            <div className="flex gap-2">
              <div className="flex-1"><Autocomplete options={studentSearchOptions} value={newStudent} onChange={setNewStudent} onSelectOption={addStudent} required={false} placeholder={isStaff ? "Buscar colaborador..." : "Digite o nome e clique + (busca grupos anteriores)..."} isStrict={isStaff} /></div>
              <button type="button" onClick={() => addStudent()} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg hover:bg-indigo-700 transition-all"><i className="fas fa-plus"></i></button>
            </div>
            
            <div className="mt-6 border border-slate-200 rounded-[1.5rem] overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2 flex items-center gap-2"><i className="fas fa-clipboard-list text-indigo-400"></i> Lista de Alunos ({formData.students.length})</span></div>
              <div className="max-h-[20rem] overflow-y-auto custom-scrollbar">
                 {callList.map((s, i) => {
                    const isPresent = formData.students.includes(s);
                    const isFromLastClass = lastClassStudents.includes(s);
                    
                    return (
                      <div key={s} className={`flex items-center justify-between p-4 border-b border-slate-100 last:border-none transition-colors group ${isPresent ? 'bg-emerald-50/50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                          <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${isPresent ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {isPresent ? <i className="fas fa-check"></i> : i + 1}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-black uppercase leading-tight ${isPresent ? 'text-emerald-700' : 'text-slate-700'}`}>{s.split(' (')[0]}</span>
                                  {!isPresent && isFromLastClass && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Frequente</span>}
                                </div>
                                {s.includes('(') && <span className={`text-[9px] font-bold ${isPresent ? 'text-emerald-400' : 'text-slate-400'}`}>{s.match(/\((.*?)\)/)?.[0]}</span>}
                              </div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => {
                              if (isPresent) {
                                setFormData({...formData, students: formData.students.filter(student => student !== s)});
                              } else {
                                setFormData({...formData, students: [...formData.students, s]});
                              }
                            }} 
                            className={`px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-2 border ${isPresent ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-rose-500 hover:border-rose-500' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-600'}`}
                          >
                            <span className="text-[9px] font-black uppercase hidden sm:inline">{isPresent ? 'Presente' : 'Ausente'}</span>
                            <i className={`fas ${isPresent ? 'fa-user-check' : 'fa-user-plus'} text-xs`}></i>
                          </button>
                      </div>
                    );
                 })}
                 {callList.length === 0 && (<div className="p-10 text-center flex flex-col items-center gap-3"><div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 text-xl"><i className="fas fa-user-slash"></i></div><p className="text-xs text-slate-400 font-bold uppercase italic">{isStaff ? 'Nenhum aluno na lista. Selecione um setor para carregar.' : 'Adicione o primeiro aluno para buscar familiares/colegas.'}</p></div>)}
              </div>
            </div>
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome da Classe</label><Autocomplete options={guideOptions} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Ex: Classe Sábado" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Lição nº</label><input type="number" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Status</label><div className="flex gap-2">{STATUS_OPTIONS.map(opt => (<button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>{opt}</button>))}</div></div>
        </div>
        <button type="submit" className="w-full py-6 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs hover:bg-indigo-700">Salvar Classe Bíblica</button>
      </form>
    </FormScaffold>
  );
};

export default BibleClassForm;
