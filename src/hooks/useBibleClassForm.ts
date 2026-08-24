import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Unit, RecordStatus, BibleClass, ParticipantType, User } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../hooks/useApp';
import { normalizeString, formatWhatsApp, ensureISODate } from '../utils/formatters';
import { isRecordLocked, isValidWhatsApp } from '../utils/validators';
import { getValidSectorId } from '../utils/sectorValidation';
import { AutocompleteOption } from '../components/Shared/Autocomplete';
import { useIdentityGuard } from './useIdentityGuard';
import { supabase } from '../services/supabaseClient';

interface UseBibleClassFormProps {
  unit: Unit;
  history: BibleClass[];
  allHistory?: BibleClass[];
  editingItem?: BibleClass;
  currentUser: User;
  onSubmit: (data: any) => void;
  isActive?: boolean;
}

export const useBibleClassForm = ({ unit, history, allHistory = [], editingItem, currentUser, onSubmit, isActive = true }: UseBibleClassFormProps) => {
  const { proStaff, proPatients, proProviders, proSectors, syncMasterContact } = useApp();
  const { showToast } = useToast();
  const { checkOwnershipConflict } = useIdentityGuard();
  
  const getToday = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const defaultState = useMemo(() => ({
    id: '', userId: currentUser.id, date: getToday(), sector: '', location: '', students: [] as string[],
    adventistStudents: [] as string[],
    guide: '', lesson: '', status: RecordStatus.INICIO,
    participantType: ParticipantType.STAFF, observations: '', representativePhone: ''
  }), [getToday, currentUser.id]);
  
  const [formData, setFormData] = useState(defaultState);
  const [newStudent, setNewStudent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // A turma não é mais amarrada ao setor: assim que QUALQUER aluno já presente é reconhecido,
  // busca a última classe em que ele apareceu e traz os colegas dela pra lista de chamada — o
  // setor continua existindo só como atalho de busca (sectorStaff acima), não como obrigação.
  const linkedClassmates = useMemo(() => {
    if (formData.students.length === 0 || !unit) return [];
    const relevant = allHistory.filter(c => c.unit === unit && (c.participantType || ParticipantType.STAFF) === formData.participantType && Array.isArray(c.students));
    const names = new Set<string>();
    formData.students.forEach(presentName => {
      const lastClassOfThis = [...relevant]
        .filter(c => c.students.includes(presentName))
        .sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (b.createdAt || 0) - (a.createdAt || 0);
        })[0];
      if (lastClassOfThis) lastClassOfThis.students.forEach(s => names.add(s));
    });
    return Array.from(names);
  }, [formData.students, allHistory, unit, formData.participantType]);

  const callList = useMemo(() => {
    const present = formData.students;
    const potential = Array.from(new Set([...lastClassStudents, ...sectorStaff, ...linkedClassmates]));
    const absent = potential.filter(s => !present.includes(s));
    
    absent.sort((a, b) => {
      const aInLast = lastClassStudents.includes(a);
      const bInLast = lastClassStudents.includes(b);
      if (aInLast && !bInLast) return -1;
      if (!aInLast && bInLast) return 1;
      return a.localeCompare(b);
    });

    return [...present, ...absent];
  }, [formData.students, lastClassStudents, sectorStaff, linkedClassmates]);

  useEffect(() => {
    if (!editingItem) {
      setFormData(prev => ({ ...defaultState, userId: currentUser.id, date: prev.date || getToday() }));
    }
  }, [editingItem, defaultState, getToday, currentUser.id]);

  // Trocar a Unidade (HAB/HABA) descarta o registro em andamento, para evitar que um
  // formulário meio preenchido para uma unidade seja salvo acidentalmente na outra.
  const isFirstUnitRender = useRef(true);
  useEffect(() => {
    if (isFirstUnitRender.current) { isFirstUnitRender.current = false; return; }
    setFormData({ ...defaultState, userId: currentUser.id, date: getToday() });
  }, [unit]);

  // Sair desta aba do menu (o componente fica montado em segundo plano) descarta o
  // registro em andamento, para não achar que salvou algo que na real foi abandonado.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (wasActive.current && !isActive && !editingItem) {
      setFormData({ ...defaultState, userId: currentUser.id, date: getToday() });
    }
    wasActive.current = isActive;
  }, [isActive]);

  const guideOptions = useMemo(() => {
    const uniqueGuides = new Set<string>();
    allHistory.forEach(c => { if (c.guide && c.unit === unit) uniqueGuides.add(c.guide); });
    return Array.from(uniqueGuides).sort().map(g => ({ value: g, label: g }));
  }, [allHistory, unit]);

  const sectorOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const myClasses = new Set<string>();
    
    const filteredHistory = allHistory.filter(c => (c.participantType || ParticipantType.STAFF) === formData.participantType && c.unit === unit);

    // 1. Setores onde o capelão selecionado deu classe (Destaque Amarelo)
    filteredHistory.filter(c => c.userId === formData.userId).forEach(c => {
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
  }, [allHistory, formData.userId, proSectors, unit, formData.participantType]);

  const studentSearchOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const officialSet = new Set<string>();
    const currentSector = formData.sector;

    // Filtra histórico APENAS da categoria atual (Integridade Categórica) -- calculado ANTES do
    // pool RH/Pacientes/Prestadores pra poder priorizar quem já está em alguma classe (de
    // qualquer capelão, não só o selecionado) já na primeira passada, igual o Estudo Individual
    // já faz. A busca por aluno passa a ser o jeito principal de achar/continuar uma turma --
    // o setor continua existindo só como filtro secundário.
    const filteredHistory = allHistory.filter(c => (c.participantType || ParticipantType.STAFF) === formData.participantType && c.unit === unit);
    const namesInAnyClass = new Set<string>();
    filteredHistory.forEach(c => (c.students || []).forEach(s => namesInAnyClass.add(normalizeString(s))));

    // 1. Pool de Dados Categórico (Pool de Origem)
    if (formData.participantType === ParticipantType.STAFF) {
        proStaff.filter(s => s.unit === unit).forEach(staff => {
          const validSectorId = getValidSectorId(staff.sectorId, unit, proSectors);
          const sector = validSectorId ? proSectors.find(sec => sec.id === validSectorId) : null;
          const isFromCurrentSector = sector?.name === currentSector;
          const isInactive = staff.active === false;
          const isInSomeClass = namesInAnyClass.has(normalizeString(staff.name));

          options.push({
            value: staff.name,
            label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})${isInactive ? ' [INATIVO]' : ''}`,
            subLabel: sector ? sector.name : 'Setor não informado',
            category: isInSomeClass ? 'Meus Alunos' : isFromCurrentSector ? 'Setor Atual' : 'RH',
            highlight: (isInSomeClass || isFromCurrentSector) && !isInactive
          });
          officialSet.add(normalizeString(staff.name));
        });
    } else if (formData.participantType === ParticipantType.PATIENT) {
        proPatients.filter(p => p.unit === unit).forEach(patient => {
          const isInSomeClass = namesInAnyClass.has(normalizeString(patient.name));
          options.push({
            value: patient.name,
            label: `${patient.name} (${patient.id})`,
            subLabel: 'Paciente',
            category: isInSomeClass ? 'Meus Alunos' : 'Pacientes',
            highlight: isInSomeClass
          });
          officialSet.add(normalizeString(patient.name));
        });
    } else if (formData.participantType === ParticipantType.PROVIDER) {
        proProviders.filter(p => p.unit === unit).forEach(provider => {
          const isFromCurrentSector = provider.sector === currentSector;
          const isInSomeClass = namesInAnyClass.has(normalizeString(provider.name));
          options.push({
            value: provider.name,
            label: `${provider.name} (${provider.id})`,
            subLabel: provider.sector || 'Prestador',
            category: isInSomeClass ? 'Meus Alunos' : isFromCurrentSector ? 'Setor Atual' : 'Prestadores',
            highlight: isInSomeClass || isFromCurrentSector
          });
          officialSet.add(normalizeString(provider.name));
        });
    }

    const uniqueHistoryNames = new Set<string>();

    // 2. Alunos das classes do capelão selecionado (Destaque Amarelo)
    filteredHistory.filter(c => c.userId === formData.userId).forEach(c => {
       if (Array.isArray(c.students)) {
         c.students.forEach(s => {
           const norm = normalizeString(s);
           if (!uniqueHistoryNames.has(norm)) {
             uniqueHistoryNames.add(norm);
             const isFromCurrentSector = c.sector === currentSector;
             options.push({ 
               value: s.trim(), 
               label: s.trim(), 
               subLabel: c.sector, 
               category: isFromCurrentSector ? 'Setor Atual' : 'Meus Alunos',
               highlight: true 
             });
           }
         });
       }
    });

    // 3. Resto do histórico geral da categoria
    filteredHistory.forEach(c => {
       if (Array.isArray(c.students)) {
         c.students.forEach(s => {
           const norm = normalizeString(s);
           if (!uniqueHistoryNames.has(norm) && !officialSet.has(norm)) {
             uniqueHistoryNames.add(norm);
             const isFromCurrentSector = c.sector === currentSector;
             options.push({ 
               value: s.trim(), 
               label: s.trim(), 
               subLabel: c.sector, 
               category: isFromCurrentSector ? 'Setor Atual' : 'Histórico' 
             });
           }
         });
       }
    });

    // Ordenação Híbrida: Prioriza Setor Atual > Meus Alunos > Resto
    return options.sort((a, b) => {
      if (a.category === 'Setor Atual' && b.category !== 'Setor Atual') return -1;
      if (a.category !== 'Setor Atual' && b.category === 'Setor Atual') return 1;
      if (a.category === 'Meus Alunos' && b.category !== 'Meus Alunos') return -1;
      if (a.category !== 'Meus Alunos' && b.category === 'Meus Alunos') return 1;
      return a.label.localeCompare(b.label);
    });
  }, [proStaff, proPatients, proProviders, proSectors, unit, allHistory, formData.userId, formData.participantType, formData.sector]);

  const handleSelectSector = useCallback((sectorName: string) => {
    if (!sectorName) return;

    // 1. Desbloqueio de Concorrência: Removido checkOwnershipConflict para setores.
    // O setor agora é apenas o local da reunião, permitindo múltiplos capelães no mesmo local.

    // 2. Auto-fill logic baseado no histórico da categoria selecionada
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
    let nextPhone = '';

    if (lastClass) {
        nextGuide = lastClass.guide;
        const lastNum = parseInt(lastClass.lesson);
        nextLesson = !isNaN(lastNum) ? (lastNum + 1).toString() : lastClass.lesson;
        nextStatus = RecordStatus.CONTINUACAO;
        // PONTO 6: Recuperar WhatsApp do representante da última classe do setor
        nextPhone = lastClass.observations?.match(/\[Rep\. WhatsApp: (.*?)\]/)?.[1] || '';
    }

    setFormData(prev => ({
        ...prev,
        sector: sectorName,
        students: [], // Limpa alunos ao trocar de setor manualmente
        guide: nextGuide || prev.guide,
        lesson: nextLesson || prev.lesson,
        status: nextStatus,
        representativePhone: nextPhone || prev.representativePhone
    }));
  }, [formData.participantType, allHistory, unit]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        id: editingItem.id || '',
        userId: editingItem.userId || currentUser.id,
        date: ensureISODate(editingItem.date) || getToday(),
        sector: editingItem.sector || '',
        location: editingItem.location || '',
        students: editingItem.students || [],
        adventistStudents: editingItem.adventistStudents || [],
        guide: editingItem.guide || '',
        lesson: editingItem.lesson || '',
        status: editingItem.status || RecordStatus.INICIO,
        participantType: editingItem.participantType || ParticipantType.STAFF,
        observations: editingItem.observations || '',
        representativePhone: editingItem.observations?.match(/\[Rep\. WhatsApp: (.*?)\]/)?.[1] || '' 
      });
    }
  }, [editingItem, getToday, currentUser.id]);

  const [isLinkingClass, setIsLinkingClass] = useState(false);

  const addStudent = async (val?: string) => {
    const inputVal = val || newStudent;
    if (!inputVal.trim()) return;

    const nameToAdd = inputVal.split(' (')[0].trim();
    const normName = normalizeString(nameToAdd);
    
    // BUSCA ROBUSTA: Tenta encontrar a opção no Autocomplete (Case Insensitive)
    let fullLabel = studentSearchOptions.find(o => 
      normalizeString(o.value) === normName || 
      normalizeString(o.label) === normalizeString(inputVal)
    )?.label;

    // SEGUNDA CHANCE: Se não achou no autocomplete, busca direto nos dados brutos do RH/Prestadores/Pacientes
    if (!fullLabel) {
      if (formData.participantType === ParticipantType.STAFF) {
        const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
        if (staff) fullLabel = `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`;
      } else if (formData.participantType === ParticipantType.PATIENT) {
        const patient = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (patient) fullLabel = `${patient.name} (${patient.id})`;
      } else if (formData.participantType === ParticipantType.PROVIDER) {
        const provider = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (provider) fullLabel = `${provider.name} (${provider.id})`;
      }
    }

    const finalString = fullLabel || nameToAdd;

    if (finalString) { 
      if (formData.students.includes(finalString)) { showToast("Aluno já está na lista."); return; }

      const normName = normalizeString(nameToAdd);

      // AUTO-SWITCH: Se for Prestador, muda automaticamente (Ponto 3)
      const isProvider = proProviders.some(p => normalizeString(p.name) === normName && p.unit === unit);
      if (isProvider && formData.participantType !== ParticipantType.PROVIDER) {
          setFormData(prev => ({ ...prev, participantType: ParticipantType.PROVIDER }));
          showToast(`${nameToAdd} é um Prestador. Tipo do grupo alterado automaticamente.`, "info");
      }

      // CROSS-VALIDATION: Se for Colaborador mas selecionado em outra aba (Ponto 2)
      const isStaffInRH = proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);
      if (isStaffInRH && formData.participantType !== ParticipantType.STAFF) {
          showToast(`${nameToAdd} consta na lista de colaboradores. Por favor, mude o tipo para colaborador ou peça ao capelão para alterar.`, "warning");
      }

      // Avisa (sem bloquear) se o aluno já está em estudo individual com outro capelão
      const ownership = checkOwnershipConflict(nameToAdd, 'study', unit, currentUser.id, currentUser.role);
      if (ownership.hasConflict) {
          showToast(ownership.message, "warning", true);
      }

      let nextGuide = formData.guide;
      let nextLesson = formData.lesson;
      let nextStatus = formData.status;
      let nextPhone = formData.representativePhone;
      let nextSector = formData.sector;

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

      // A turma é reconhecida pelo aluno, não pelo setor: buscamos a última classe em que esta
      // pessoa apareceu (de qualquer setor) e trazemos o resto dela — vale pra Colaborador
      // também agora, não só Paciente/Prestador. O setor do registro é inferido dessa classe
      // encontrada em vez de precisar ser escolhido manualmente antes.
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

      // FALLBACK NO BANCO: o app só mantém em memória as presenças (bible_class_attendees) dos
      // últimos 45 dias (ver dataRepository.ts syncBackground) -- classes com a última reunião
      // mais antiga que isso ficam com `.students` vazio em memória, e a busca acima nunca
      // encontra a turma dele. Sem esse fallback, reconhecer um aluno de uma turma "antiga"
      // silenciosamente não trazia os colegas -- bug relatado pelo usuário.
      if (!lastClassWithStudent && supabase) {
          setIsLinkingClass(true);
          try {
              const { data: hitRows } = await supabase
                  .from('bible_class_attendees')
                  .select('class_id, student_name, date')
                  .ilike('student_name', `${nameToAdd}%`)
                  .eq('unit', unit)
                  .order('date', { ascending: false })
                  .limit(1);

              const foundClassId = hitRows?.[0]?.class_id;
              if (foundClassId) {
                  const classRecord = allHistory.find(c => c.id === foundClassId);
                  const { data: classmateRows } = await supabase
                      .from('bible_class_attendees')
                      .select('*')
                      .eq('class_id', foundClassId);

                  if (classRecord && classmateRows && classmateRows.length > 0) {
                      const studentsList = classmateRows.map((a: any) => {
                          const id = a.staff_id || a.participant_id;
                          if (id && !String(a.student_name).includes(`(${id})`)) return `${a.student_name} (${id})`;
                          return a.student_name;
                      });
                      const adventistList = classmateRows.filter((a: any) => a.is_adventist).map((a: any) => {
                          const id = a.staff_id || a.participant_id;
                          if (id && !String(a.student_name).includes(`(${id})`)) return `${a.student_name} (${id})`;
                          return a.student_name;
                      });
                      lastClassWithStudent = { ...classRecord, students: studentsList, adventistStudents: adventistList } as BibleClass;
                  }
              }
          } catch (err) {
              console.error('Erro ao buscar turma antiga do aluno:', err);
          } finally {
              setIsLinkingClass(false);
          }
      }

      let updatedStudents = Array.from(new Set([...formData.students, finalString]));
      let updatedAdventists = [...formData.adventistStudents];

      if (lastClassWithStudent) {
          const peersFound = lastClassWithStudent.students.filter(s => s !== finalString && !formData.students.includes(s));
          nextGuide = lastClassWithStudent.guide;
          const lastNum = parseInt(lastClassWithStudent.lesson);
          nextLesson = !isNaN(lastNum) ? (lastNum + 1).toString() : lastClassWithStudent.lesson;
          nextStatus = RecordStatus.CONTINUACAO;
          if (!nextSector) nextSector = lastClassWithStudent.sector || nextSector;

          // PONTO 6: Recuperar WhatsApp do representante do histórico do aluno
          const historyPhone = lastClassWithStudent.observations?.match(/\[Rep\. WhatsApp: (.*?)\]/)?.[1];
          if (historyPhone && (!nextPhone || nextPhone.length < 10)) {
              nextPhone = historyPhone;
          }

          // Turma reconhecida: os colegas da última vez entram direto como PRESENTES (a pedido
          // do usuário -- antes só apareciam como sugestão ausente pra marcar um a um). O selo
          // de Adventista de quem entra automaticamente também é herdado da última classe.
          if (peersFound.length > 0) {
              updatedStudents = Array.from(new Set([...updatedStudents, ...peersFound]));
              const inheritedAdventists = (lastClassWithStudent.adventistStudents || []).filter(s => updatedStudents.includes(s));
              updatedAdventists = Array.from(new Set([...updatedAdventists, ...inheritedAdventists]));
              showToast(`Turma reconhecida! ${peersFound.length} colega(s) da última vez já entraram como presentes.`, "success");
          }
      }

      setFormData(prev => ({
        ...prev,
        students: updatedStudents,
        adventistStudents: updatedAdventists,
        guide: nextGuide,
        lesson: nextLesson,
        status: nextStatus,
        representativePhone: nextPhone,
        sector: nextSector
      }));
      setNewStudent('');
    }
  };

  // Atalho pra chamada em continuidade: em vez de buscar aluno por aluno pra "reconhecer" a
  // turma de novo, um clique só adiciona todo mundo que já está na lista de chamada (callList,
  // que já reconhece a turma de qualquer setor -- ver linkedClassmates acima) de uma vez, e
  // puxa guia/lição/status/telefone da classe mais recente ligada a esses alunos, igual o
  // addStudent faz pra 1 aluno, só que aplicado pra lista inteira numa passada só.
  const addAllFromLastClass = () => {
    const toAdd = callList.filter(s => !formData.students.includes(s));
    if (toAdd.length === 0) {
      showToast('Não há mais alunos da turma anterior pra adicionar.', 'info');
      return;
    }

    let nextGuide = formData.guide;
    let nextLesson = formData.lesson;
    let nextStatus = formData.status;
    let nextPhone = formData.representativePhone;
    let nextSector = formData.sector;

    const relevant = allHistory.filter(c => c.unit === unit && (c.participantType || ParticipantType.STAFF) === formData.participantType && Array.isArray(c.students));
    const refClass = [...relevant]
      .filter(c => toAdd.some(name => c.students.includes(name)) || formData.students.some(name => c.students.includes(name)))
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      })[0];

    if (refClass) {
      nextGuide = refClass.guide;
      const lastNum = parseInt(refClass.lesson);
      nextLesson = !isNaN(lastNum) ? (lastNum + 1).toString() : refClass.lesson;
      nextStatus = RecordStatus.CONTINUACAO;
      if (!nextSector) nextSector = refClass.sector || nextSector;
      const historyPhone = refClass.observations?.match(/\[Rep\. WhatsApp: (.*?)\]/)?.[1];
      if (historyPhone && (!nextPhone || nextPhone.length < 10)) nextPhone = historyPhone;
    }

    setFormData(prev => ({
      ...prev,
      students: Array.from(new Set([...prev.students, ...toAdd])),
      guide: nextGuide,
      lesson: nextLesson,
      status: nextStatus,
      representativePhone: nextPhone,
      sector: nextSector,
    }));
    showToast(`${toAdd.length} aluno(s) adicionado(s) de uma vez.`, 'success');
  };

  // Liga/desliga o selo de Adventista pra um aluno da chamada -- ele continua contando
  // presença normalmente, só fica de fora do total de alunos dos relatórios (ver getUnitStats
  // em useReports.ts / ChaplainCard.tsx / useReportLogic.ts, que agora excluem quem está aqui).
  const toggleAdventist = (studentName: string) => {
    setFormData(prev => ({
      ...prev,
      adventistStudents: prev.adventistStudents.includes(studentName)
        ? prev.adventistStudents.filter(s => s !== studentName)
        : [...prev.adventistStudents, studentName],
    }));
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

    // ENRIQUECIMENTO DE DADOS: Garante que todos os alunos tenham o ID no nome antes de enviar
    // Isso resolve o problema de IDs perdidos em continuidades ou colagens manuais
    const enrichedStudents = formData.students.map(s => {
        if (s.includes(' (')) return s;
        const nameOnly = s.trim();
        const normName = normalizeString(nameOnly);
        
        if (formData.participantType === ParticipantType.STAFF) {
            const staff = proStaff.find(st => normalizeString(st.name) === normName && st.unit === unit);
            if (staff) return `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`;
        } else if (formData.participantType === ParticipantType.PROVIDER) {
            const provider = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
            if (provider) return `${provider.name} (${provider.id})`;
        } else if (formData.participantType === ParticipantType.PATIENT) {
            const patient = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
            if (patient) return `${patient.name} (${patient.id})`;
        }
        return s;
    });
    formData.students = enrichedStudents;

    // Avisa (sem bloquear) se esta turma já está sendo acompanhada por outro capelão
    const classOwnership = checkOwnershipConflict(formData.students, 'class', unit, currentUser.id, currentUser.role);
    if (classOwnership.hasConflict) {
        showToast(classOwnership.message, "warning", true);
    }

    if (formData.participantType === ParticipantType.STAFF) {
        // Setor não bloqueia mais o salvamento — é inferido da última classe do aluno buscado
        // (ver addStudent) assim que a turma é reconhecida; segue opcional pra turmas realmente novas.

        // PONTO 1: Validar que todos os alunos são colaboradores oficiais
        const nonStaff = formData.students.filter(studentStr => {
            const nameOnly = studentStr.split(' (')[0].trim();
            const normName = normalizeString(nameOnly);
            return !proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);
        });
        
        if (nonStaff.length > 0) {
            showToast(`Os seguintes alunos não constam na lista oficial de colaboradores: ${nonStaff.join(', ')}.`, "error");
            return;
        }
    } else {
        if (!formData.representativePhone || formData.representativePhone.length < 10) { showToast("O WhatsApp do Representante é obrigatório para este grupo.", "warning"); return; }
        if (!isValidWhatsApp(formData.representativePhone)) { showToast("Por favor, insira um número de WhatsApp válido para o representante.", "error"); return; }
        // Clear sector info for non-staff
        formData.sector = '';
    }

    if (isRecordLocked(formData.date, currentUser.role)) {
        showToast("Este período está bloqueado para lançamentos.", "error");
        return;
    }

    setIsSubmitting(true);
    try {
      let finalObservations = formData.observations;
      if (formData.participantType !== ParticipantType.STAFF) {
          const repName = formData.students[0].split(' (')[0].trim();
          const syncedId = await syncMasterContact(repName, formData.representativePhone, unit, formData.participantType, formData.sector);
          if (formData.representativePhone) finalObservations = `[Rep. WhatsApp: ${formData.representativePhone}]\n${finalObservations}`;
          // Sem isso, um Paciente/Prestador novo (sem cadastro prévio) era criado pelo
          // syncMasterContact mas o "(ID)" nunca entrava no nome salvo em bible_class_attendees,
          // virando um registro órfão permanente na Auditoria de Qualidade.
          if (syncedId && !formData.students[0].includes('(')) {
              formData.students[0] = `${repName} (${syncedId})`;
          }
      } else {
          await Promise.all(formData.students.map(studentStr => {
              const nameOnly = studentStr.split(' (')[0].trim();
              return syncMasterContact(nameOnly, "", unit, ParticipantType.STAFF, formData.sector).catch(console.error);
          }));
      }
      const result = await onSubmit({ ...formData, unit, participantType: formData.participantType, observations: finalObservations });
      
      // Se o onSubmit retornar um objeto com success (como o useBibleModule faz)
      if (result && typeof result === 'object' && 'success' in result && !result.success) {
          showToast(result.error?.message || "Erro ao salvar registro.", "error");
          return;
      }

      setFormData({ ...defaultState, date: getToday() });
      showToast("Registro salvo com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast("Erro inesperado ao salvar o registro. Verifique sua conexão.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData, setFormData,
    newStudent, setNewStudent,
    isSubmitting, isLinkingClass,
    lastClassStudents, callList,
    guideOptions, studentSearchOptions, sectorOptions,
    handleSelectSector,
    addStudent, addAllFromLastClass, toggleAdventist, handleClear, handleFormSubmit,
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
            adventistStudents: baseItem.adventistStudents || [],
            guide: baseItem.guide || '',
            lesson: !isNaN(parseInt(baseItem.lesson)) ? (parseInt(baseItem.lesson) + 1).toString() : (baseItem.lesson || ''),
            status: RecordStatus.CONTINUACAO,
            representativePhone: baseItem.observations?.match(/\[Rep\. WhatsApp: (.*?)\]/)?.[1] || ''
        }));
        showToast(`Continuando classe de ${baseItem.sector}`, "info");
    },
    defaultState
  };
};
