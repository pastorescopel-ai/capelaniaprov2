import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Unit, RecordStatus, BibleClass, ParticipantType, User } from '../types';
import { useToast } from '../contexts/ToastProvider';
import { useApp } from '../hooks/useApp';
import { normalizeString, formatWhatsApp, ensureISODate } from '../utils/formatters';
import { isRecordLocked } from '../utils/validators';
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
  const { proStaff, proPatients, proProviders, proSectors, syncMasterContact, editAuthorizations } = useApp();
  const { showToast } = useToast();
  const { checkOwnershipConflict } = useIdentityGuard();
  
  const getToday = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const defaultState = useMemo(() => ({ 
    id: '', userId: currentUser.id, date: getToday(), sector: '', students: [] as string[], 
    guide: '', lesson: '', status: RecordStatus.INICIO, 
    participantType: ParticipantType.STAFF, observations: '', representativePhone: '' 
  }), [getToday, currentUser.id]);
  
  const [formData, setFormData] = useState(defaultState);
  const [newStudent, setNewStudent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownershipConflict, setOwnershipConflict] = useState<{show: boolean, message: string}>({show: false, message: ''});

  const lastClassStudents = useMemo(() => {
    if (!formData.sector || !unit) return [];
    
    // Busca a última classe DESTE SETOR e DESTE TIPO DE PARTICIPANTE
    const lastClass = [...allHistory]
      .filter(c => c.sector === formData.sector && c.unit === unit && (c.participantType || ParticipantType.STAFF) === formData.participantType)
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      })[0];
      
    return lastClass?.students || [];
  }, [formData.sector, allHistory, unit, formData.participantType]);

  const sectorStaff = useMemo(() => {
    if (!formData.sector || !unit || formData.participantType !== ParticipantType.STAFF) return [];
    const sectorObj = proSectors.find(s => s.name === formData.sector && s.unit === unit);
    if (!sectorObj) return [];
    return proStaff
      .filter(s => s.sectorId === sectorObj.id && s.active)
      .map(s => `${s.name} (${String(s.id).split('-')[1] || s.id})`);
  }, [formData.sector, proSectors, proStaff, unit, formData.participantType]);

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
      setFormData(prev => ({ ...defaultState, userId: currentUser.id, date: prev.date || getToday() }));
    }
  }, [editingItem, defaultState, getToday, currentUser.id]);

  const guideOptions = useMemo(() => {
    const uniqueGuides = new Set<string>();
    allHistory.forEach(c => { if (c.guide && c.unit === unit) uniqueGuides.add(c.guide); });
    return Array.from(uniqueGuides).sort().map(g => ({ value: g, label: g }));
  }, [allHistory, unit]);

  const sectorOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const myClasses = new Set<string>();
    
    const filteredHistory = allHistory.filter(c => (c.participantType || ParticipantType.STAFF) === formData.participantType && c.unit === unit);

    // 1. Setores onde o capelão logado deu classe (Destaque Amarelo)
    filteredHistory.filter(c => c.userId === currentUser.id).forEach(c => {
      if (c.sector && !myClasses.has(c.sector)) {
        myClasses.add(c.sector);
        options.push({
          value: c.sector,
          label: c.sector,
          subLabel: 'Minha Classe',
          category: 'MyClasses',
          highlight: true
        });
      }
    });

    // 2. Restante dos setores oficiais
    proSectors.filter(s => s.unit === unit).forEach(s => {
      if (!myClasses.has(s.name)) {
        options.push({
          value: s.name,
          label: s.name,
          category: 'RH'
        });
      }
    });

    return options;
  }, [allHistory, currentUser.id, proSectors, unit, formData.participantType]);

  const studentSearchOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const officialSet = new Set<string>();
    
    if (formData.participantType === ParticipantType.STAFF) {
        proStaff.filter(s => s.unit === unit).forEach(staff => {
          const sector = proSectors.find(sec => sec.id === staff.sectorId);
          options.push({ value: staff.name, label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`, subLabel: sector ? sector.name : 'Setor não informado', category: 'RH' });
          officialSet.add(normalizeString(staff.name));
        });
    } else if (formData.participantType === ParticipantType.PATIENT) {
        // Se houver proPatients no AppContext, poderia usar aqui
    } else {
        // Se houver proProviders no AppContext, poderia usar aqui
    }

    const uniqueHistoryNames = new Set<string>();
    const filteredHistory = allHistory.filter(c => (c.participantType || ParticipantType.STAFF) === formData.participantType && c.unit === unit);
    const otherHistory = allHistory.filter(c => (c.participantType || ParticipantType.STAFF) !== formData.participantType && c.unit === unit);
    
    // 1. Alunos das classes do capelão logado (Destaque Amarelo)
    filteredHistory.filter(c => c.userId === currentUser.id).forEach(c => {
       if (Array.isArray(c.students)) {
         c.students.forEach(s => {
           const norm = normalizeString(s);
           if (!uniqueHistoryNames.has(norm)) {
             uniqueHistoryNames.add(norm);
             options.push({ 
               value: s.trim(), 
               label: s.trim(), 
               subLabel: c.sector, 
               category: 'MyStudents',
               highlight: true 
             });
           }
         });
       }
    });

    // 2. Resto do histórico geral
    filteredHistory.forEach(c => {
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

    // 3. Alunos de outras abas (Migração)
    otherHistory.forEach(c => {
       if (Array.isArray(c.students)) {
         c.students.forEach(s => {
           const norm = normalizeString(s);
           if (!uniqueHistoryNames.has(norm) && !officialSet.has(norm)) {
             uniqueHistoryNames.add(norm);
             options.push({ value: s.trim(), label: s.trim(), subLabel: `${c.sector || 'Sem setor'} (Migrar)`, category: 'Migration' });
           }
         });
       }
    });

    return options;
  }, [proStaff, proSectors, unit, allHistory, currentUser.id, formData.participantType]);

  const handleSelectSector = useCallback((sectorName: string) => {
    if (!sectorName) return;

    // 1. Ownership Check (Apenas para Staff/Setores Oficiais)
    const sectorObj = proSectors.find(s => s.name === sectorName && s.unit === unit);
    if (sectorObj && formData.participantType === ParticipantType.STAFF) {
        const ownership = checkOwnershipConflict(sectorName, 'class', unit, currentUser.id, currentUser.role);
        if (ownership.hasConflict) {
            setOwnershipConflict({ show: true, message: ownership.message });
            setFormData(prev => ({ ...prev, sector: '', students: [], guide: '', lesson: '', status: RecordStatus.INICIO }));
            return;
        }
    }

    // 2. Auto-fill logic
    const lastClass = [...allHistory]
        .filter(c => c.sector === sectorName && c.unit === unit && (c.participantType || ParticipantType.STAFF) === formData.participantType)
        .sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return (b.createdAt || 0) - (a.createdAt || 0);
        })[0];

    let nextLesson = '';
    let nextGuide = '';
    let nextStatus = RecordStatus.INICIO;

    if (lastClass) {
        nextGuide = lastClass.guide;
        const lastNum = parseInt(lastClass.lesson);
        nextLesson = !isNaN(lastNum) ? (lastNum + 1).toString() : lastClass.lesson;
        nextStatus = RecordStatus.CONTINUACAO;
    }

    setFormData(prev => ({
        ...prev,
        sector: sectorName,
        students: [], // Limpa alunos ao trocar de setor manualmente
        guide: nextGuide || prev.guide,
        lesson: nextLesson || prev.lesson,
        status: nextStatus
    }));
  }, [formData.participantType, allHistory, unit, currentUser.id, currentUser.role, proSectors, checkOwnershipConflict]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        id: editingItem.id || '',
        userId: editingItem.userId || currentUser.id,
        date: ensureISODate(editingItem.date) || getToday(),
        sector: editingItem.sector || '',
        students: editingItem.students || [],
        guide: editingItem.guide || '',
        lesson: editingItem.lesson || '',
        status: editingItem.status || RecordStatus.INICIO,
        participantType: editingItem.participantType || ParticipantType.STAFF,
        observations: editingItem.observations || '',
        representativePhone: editingItem.observations?.match(/\[Rep\. WhatsApp: (.*?)\]/)?.[1] || '' 
      });
    }
  }, [editingItem, getToday, currentUser.id]);

  const addStudent = (val?: string) => { 
    const inputVal = val || newStudent;
    const nameToAdd = inputVal.split(' (')[0].trim();
    // FLEXIBILIZAR: Removido bloqueio de aluno não encontrado no Banco de RH
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
          let lastClassWithStudent = [...allHistory]
              .filter(c => c.students && c.students.includes(finalString) && (c.participantType || ParticipantType.STAFF) === formData.participantType && c.unit === unit)
              .sort((a, b) => {
                  const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
                  if (dateDiff !== 0) return dateDiff;
                  return (b.createdAt || 0) - (a.createdAt || 0);
              })[0];
          
          if (!lastClassWithStudent) {
              // Se não achou na aba atual, busca em qualquer aba (Migração)
              lastClassWithStudent = [...allHistory]
                  .filter(c => c.students && c.students.includes(finalString) && c.unit === unit)
                  .sort((a, b) => {
                      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
                      if (dateDiff !== 0) return dateDiff;
                      return (b.createdAt || 0) - (a.createdAt || 0);
                  })[0];
          }

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
    
    const lessonNum = parseInt(formData.lesson);
    if (isNaN(lessonNum) || lessonNum < 1) { 
        showToast("O número da lição deve ser pelo menos 1.", "warning"); 
        return; 
    }

    // Validação de Tipo de Participante (Evitar misturar Colaboradores/Prestadores/Pacientes)
    const currentType = formData.participantType;
    const conflicts: string[] = [];

    formData.students.forEach(studentStr => {
        const nameOnly = studentStr.split(' (')[0].trim();
        const normName = normalizeString(nameOnly);

        if (currentType === ParticipantType.STAFF) {
            const isProvider = proProviders.some(p => normalizeString(p.name) === normName && p.unit === unit);
            if (isProvider) conflicts.push(`${nameOnly} (é Prestador)`);
            const isPatient = proPatients.some(p => normalizeString(p.name) === normName && p.unit === unit);
            if (isPatient) conflicts.push(`${nameOnly} (é Paciente)`);
        } else if (currentType === ParticipantType.PROVIDER) {
            const isStaff = proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);
            if (isStaff) conflicts.push(`${nameOnly} (é Colaborador)`);
            const isPatient = proPatients.some(p => normalizeString(p.name) === normName && p.unit === unit);
            if (isPatient) conflicts.push(`${nameOnly} (é Paciente)`);
        } else if (currentType === ParticipantType.PATIENT) {
            const isStaff = proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);
            if (isStaff) conflicts.push(`${nameOnly} (é Colaborador)`);
            const isProvider = proProviders.some(p => normalizeString(p.name) === normName && p.unit === unit);
            if (isProvider) conflicts.push(`${nameOnly} (é Prestador)`);
        }
    });

    if (conflicts.length > 0) {
        showToast(`Não é possível salvar: ${conflicts.join(', ')}. Remova-os ou altere o tipo do grupo.`, "error");
        return;
    }

    // Verifica se a classe (guide) pertence a outro capelão
    const classOwnership = checkOwnershipConflict(formData.guide, 'class', unit, currentUser.id, currentUser.role);
    if (classOwnership.hasConflict) {
        setOwnershipConflict({ show: true, message: classOwnership.message });
        return;
    }

    if (formData.participantType === ParticipantType.STAFF) {
        if (!formData.sector) { showToast("Para colaboradores, o Setor é obrigatório.", "warning"); return; }
        // FLEXIBILIZAR: Removido bloqueio de setor oficial
    } else {
        if (!formData.representativePhone || formData.representativePhone.length < 10) { showToast("O WhatsApp do Representante é obrigatório para este grupo.", "warning"); return; }
    }

    if (isRecordLocked(formData.date, currentUser.role, 'bibleClasses', editAuthorizations)) {
        showToast("Este período está bloqueado para lançamentos.", "error");
        return;
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
    guideOptions, studentSearchOptions, sectorOptions,
    editAuthorizations,
    handleSelectSector,
    addStudent, handleClear, handleFormSubmit,
    handleContinueClass: (item: BibleClass) => {
        // Busca a última classe DESTE SETOR e DESTE TIPO DE PARTICIPANTE para garantir que pegamos a mais recente
        const lastClass = [...allHistory]
            .filter(c => c.sector === item.sector && c.unit === unit && (c.participantType || ParticipantType.STAFF) === (item.participantType || ParticipantType.STAFF))
            .sort((a, b) => {
                const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
                if (dateDiff !== 0) return dateDiff;
                return (b.createdAt || 0) - (a.createdAt || 0);
            })[0];
        
        const baseItem = lastClass || item;

        setFormData(prev => ({
            ...prev,
            id: '', // CRITICAL: Clear ID to ensure a new record is created
            sector: baseItem.sector || '',
            participantType: baseItem.participantType || ParticipantType.STAFF,
            students: baseItem.students || [],
            guide: baseItem.guide || '',
            lesson: !isNaN(parseInt(baseItem.lesson)) ? (parseInt(baseItem.lesson) + 1).toString() : (baseItem.lesson || ''),
            status: RecordStatus.CONTINUACAO,
            representativePhone: baseItem.observations?.match(/\[Rep\. WhatsApp: (.*?)\]/)?.[1] || ''
        }));
        showToast(`Continuando classe de ${baseItem.sector}`, "info");
    },
    defaultState,
    ownershipConflict, setOwnershipConflict
  };
};
