import { useState, useEffect, useMemo, useCallback } from 'react';
import { Unit, RecordStatus, BibleClass, ParticipantType, User } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../contexts/AppContext';
import { normalizeString, formatWhatsApp } from '../utils/formatters';
import { AutocompleteOption } from '../components/Shared/Autocomplete';
import { useIdentityGuard } from './useIdentityGuard';

interface UseBibleClassFormProps {
  unit: Unit;
  history: BibleClass[];
  allHistory?: BibleClass[];
  editingItem?: BibleClass;
  currentUser: User;
  onSubmit: (data: any) => void;
}

export const useBibleClassForm = ({ unit, history, allHistory = [], editingItem, currentUser, onSubmit }: UseBibleClassFormProps) => {
  const { proStaff, proSectors, syncMasterContact } = useApp();
  const { showToast } = useToast();
  const { checkOwnershipConflict } = useIdentityGuard();
  
  const getToday = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const defaultState = useMemo(() => ({ 
    id: '', date: getToday(), sector: '', students: [] as string[], 
    guide: '', lesson: '', status: RecordStatus.INICIO, 
    participantType: ParticipantType.STAFF, observations: '', representativePhone: '' 
  }), [getToday]);
  
  const [formData, setFormData] = useState(defaultState);
  const [newStudent, setNewStudent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownershipConflict, setOwnershipConflict] = useState<{show: boolean, message: string}>({show: false, message: ''});

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
            // STRICT OWNERSHIP CHECK: Verifica se a classe do setor pertence a outro
            const ownership = checkOwnershipConflict(formData.sector, 'class', unit, currentUser.id, currentUser.role);
            if (ownership.hasConflict) {
                setOwnershipConflict({ show: true, message: ownership.message });
                setFormData(prev => ({ ...prev, sector: '', students: [], guide: '', lesson: '', status: RecordStatus.INICIO }));
                return;
            }

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
            setFormData(prev => ({ ...prev, students: [], guide: nextGuide || prev.guide, lesson: nextLesson || prev.lesson, status: nextStatus }));
        }
    }
  }, [formData.sector, proSectors, proStaff, unit, allHistory, editingItem, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        ...editingItem, 
        participantType: editingItem.participantType || ParticipantType.STAFF, 
        date: editingItem.date ? editingItem.date.split('T')[0] : getToday(), 
        representativePhone: editingItem.observations?.match(/\[Rep\. WhatsApp: (.*?)\]/)?.[1] || '' 
      });
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

      // Verifica se o aluno está em um estudo ativo com outro capelão
      const ownership = checkOwnershipConflict(nameToAdd, 'study', unit, currentUser.id, currentUser.role);
      if (ownership.hasConflict) {
          setOwnershipConflict({ show: true, message: ownership.message });
          setNewStudent('');
          return;
      }

      let peersToAdd: string[] = [];
      let nextGuide = formData.guide;
      let nextLesson = formData.lesson;
      let nextStatus = formData.status;
      let nextPhone = formData.representativePhone;

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
      
      // Garante que não haja duplicatas na lista final
      const updatedStudents = Array.from(new Set([...formData.students, finalString, ...peersToAdd]));
      
      setFormData(prev => ({ 
        ...prev, 
        students: updatedStudents, 
        guide: nextGuide, 
        lesson: nextLesson, 
        status: nextStatus, 
        representativePhone: nextPhone 
      })); 
      setNewStudent(''); 
    } 
  };

  const handleClear = () => {
    setFormData({ ...defaultState, date: formData.date });
    showToast("Campos limpos!", "info");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (formData.students.length < 2) { showToast("É necessário pelo menos 2 alunos presentes para salvar a classe.", "warning"); return; }
    if (!formData.guide || !formData.lesson) { showToast("Preencha Guia e Lição."); return; }

    // Verifica se a classe (guide) pertence a outro capelão
    const classOwnership = checkOwnershipConflict(formData.guide, 'class', unit, currentUser.id, currentUser.role);
    if (classOwnership.hasConflict) {
        setOwnershipConflict({ show: true, message: classOwnership.message });
        return;
    }

    if (formData.participantType === ParticipantType.STAFF) {
        if (!formData.sector) { showToast("Para colaboradores, o Setor é obrigatório.", "warning"); return; }
        if (!proSectors.some(s => s.name === formData.sector && s.unit === unit)) { showToast("Selecione um setor oficial válido da lista.", "warning"); return; }
    } else {
        if (!formData.representativePhone || formData.representativePhone.length < 10) { showToast("O WhatsApp do Representante é obrigatório para este grupo.", "warning"); return; }
    }

    setIsSubmitting(true);
    try {
      let finalObservations = formData.observations;
      if (formData.participantType !== ParticipantType.STAFF) {
          const repName = formData.students[0].split(' (')[0].trim();
          await syncMasterContact(repName, formData.representativePhone, unit, formData.participantType, formData.sector);
          if (formData.representativePhone) finalObservations = `[Rep. WhatsApp: ${formData.representativePhone}]\n${finalObservations}`;
      } else {
          await Promise.all(formData.students.map(studentStr => {
              const nameOnly = studentStr.split(' (')[0].trim();
              return syncMasterContact(nameOnly, "", unit, ParticipantType.STAFF, formData.sector).catch(console.error);
          }));
      }
      await onSubmit({ ...formData, unit, participantType: formData.participantType, observations: finalObservations });
      setFormData({ ...defaultState, date: getToday() });
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData, setFormData,
    newStudent, setNewStudent,
    isSubmitting,
    lastClassStudents, callList,
    guideOptions, studentSearchOptions,
    addStudent, handleClear, handleFormSubmit,
    defaultState,
    ownershipConflict, setOwnershipConflict
  };
};
