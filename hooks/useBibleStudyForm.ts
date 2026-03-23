import { useState, useEffect, useMemo, useCallback } from 'react';
import { Unit, RecordStatus, BibleStudy, User, ParticipantType } from '../types';
import { useToast } from '../contexts/ToastProvider';
import { useApp } from '../hooks/useApp';
import { normalizeString, formatWhatsApp, ensureISODate } from '../utils/formatters';
import { AutocompleteOption } from '../components/Shared/Autocomplete';
import { useIdentityGuard } from './useIdentityGuard';
import { isRecordLocked } from '../utils/validators';

interface UseBibleStudyFormProps {
  unit: Unit;
  history: BibleStudy[];
  allHistory?: BibleStudy[];
  editingItem?: BibleStudy;
  currentUser: User;
  onSubmit: (data: any) => void;
}

export const useBibleStudyForm = ({ unit, history, allHistory = [], editingItem, currentUser, onSubmit }: UseBibleStudyFormProps) => {
  const { proStaff, proPatients, proProviders, proSectors, syncMasterContact, editAuthorizations } = useApp();
  const { showToast } = useToast();
  const { checkIdentityConflict, checkOwnershipConflict } = useIdentityGuard();
  
  const getToday = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const defaultState = useMemo(() => ({ 
    id: '', date: getToday(), sector: '', sectorId: '', name: '', staffId: '', 
    whatsapp: '', status: RecordStatus.INICIO, participantType: ParticipantType.STAFF, 
    guide: '', lesson: '', observations: '' 
  }), [getToday]);
  
  const [formData, setFormData] = useState(defaultState);
  const [isSectorLocked, setIsSectorLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ownershipConflict, setOwnershipConflict] = useState<{show: boolean, message: string}>({show: false, message: ''});

  useEffect(() => {
    if (!editingItem) {
      setFormData(prev => ({ ...defaultState, date: prev.date || getToday() }));
      setIsSectorLocked(false);
    }
  }, [editingItem, defaultState, getToday]); 

  const guideOptions = useMemo(() => {
    const uniqueGuides = new Set<string>();
    allHistory.forEach(s => { if (s.guide) uniqueGuides.add(s.guide); });
    return Array.from(uniqueGuides).sort().map(g => ({ value: g, label: g }));
  }, [allHistory]);

  const sectorOptions = useMemo(() => {
    if (formData.participantType === ParticipantType.PATIENT || formData.participantType === ParticipantType.STAFF) {
        return proSectors.filter(s => s.unit === unit).map(s => ({value: s.name, label: s.name}));
    }
    const officialSectors = proSectors.filter(s => s.unit === unit).map(s => ({value: s.name, label: s.name}));
    const genericLocations = [
        {value: 'Profissional da Saúde', label: 'Profissional da Saúde'}, 
        {value: 'Apoio/Serviços', label: 'Apoio/Serviços'}, 
        {value: 'Administrativo', label: 'Administrativo'}, 
        {value: 'Outros', label: 'Outros'}
    ];
    return [...officialSectors, ...genericLocations];
  }, [formData.participantType, proSectors, unit]);

  const studentOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const officialSet = new Set<string>();

    if (formData.participantType === ParticipantType.STAFF) {
        proStaff.filter(s => s.unit === unit).forEach(staff => {
          const sector = proSectors.find(sec => sec.id === staff.sectorId);
          options.push({ value: staff.name, label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`, subLabel: sector ? sector.name : 'Setor não informado', category: 'RH' as const });
          officialSet.add(normalizeString(staff.name));
        });
    } else if (formData.participantType === ParticipantType.PATIENT) {
        proPatients.filter(p => p.unit === unit).forEach(p => {
            options.push({ value: p.name, label: p.name, subLabel: "Paciente", category: "RH" as const });
            officialSet.add(normalizeString(p.name));
        });
    } else {
        proProviders.filter(p => p.unit === unit).forEach(p => {
            options.push({ value: p.name, label: p.name, subLabel: p.sector || "Prestador", category: "RH" as const });
            officialSet.add(normalizeString(p.name));
        });
    }
    
    const filteredHistory = allHistory.filter(s => (s.participantType || ParticipantType.STAFF) === formData.participantType);
    const otherHistory = allHistory.filter(s => (s.participantType || ParticipantType.STAFF) !== formData.participantType);
    
    const personalHistory = filteredHistory.filter(s => s.userId === currentUser.id);
    const uniqueHistoryNames = new Set<string>();
    
    // 1. Primeiro, adiciona os alunos DO CAPELÃO LOGADO (Destaque Amarelo)
    personalHistory.forEach(s => {
      const norm = normalizeString(s.name);
      if (s.name && !uniqueHistoryNames.has(norm)) {
        uniqueHistoryNames.add(norm);
        options.push({ 
          value: s.name, 
          label: s.name, 
          subLabel: s.sector, 
          category: 'MyStudents' as const,
          highlight: true 
        });
      }
    });

    // 2. Depois, adiciona o resto do histórico geral (sem destaque)
    filteredHistory.forEach(s => {
      const norm = normalizeString(s.name);
      if (s.name && !uniqueHistoryNames.has(norm) && !officialSet.has(norm)) {
        uniqueHistoryNames.add(norm);
        options.push({ value: s.name, label: s.name, subLabel: s.sector, category: 'History' as const });
      }
    });

    // 3. Por fim, adiciona alunos de outras abas (Migração)
    otherHistory.forEach(s => {
      const norm = normalizeString(s.name);
      if (s.name && !uniqueHistoryNames.has(norm) && !officialSet.has(norm)) {
        uniqueHistoryNames.add(norm);
        options.push({ value: s.name, label: s.name, subLabel: `${s.sector || 'Sem setor'} (Migrar)`, category: 'Migration' as const });
      }
    });

    return options;
  }, [allHistory, currentUser.id, proStaff, proPatients, proProviders, proSectors, unit, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        id: editingItem.id || '',
        date: ensureISODate(editingItem.date) || getToday(),
        sector: editingItem.sector || '',
        sectorId: editingItem.sectorId || '',
        name: editingItem.name || '',
        staffId: editingItem.staffId || '',
        whatsapp: editingItem.whatsapp || '',
        status: editingItem.status || RecordStatus.INICIO,
        participantType: editingItem.participantType || ParticipantType.STAFF,
        guide: editingItem.guide || '',
        lesson: editingItem.lesson || '',
        observations: editingItem.observations || ''
      });
      if (editingItem.participantType === ParticipantType.STAFF) {
          const staff = proStaff.find(s => normalizeString(s.name) === normalizeString(editingItem.name) && s.unit === unit);
          setIsSectorLocked(!!staff);
      } else {
          setIsSectorLocked(false);
      }
    }
  }, [editingItem, unit, proStaff, getToday]);

  const handleSelectStudent = (selectedLabel: string) => {
    const targetName = selectedLabel.split(' (')[0].trim();

    // STRICT OWNERSHIP CHECK: Aborta preenchimento se pertencer a outro
    const ownership = checkOwnershipConflict(targetName, 'study', unit, currentUser.id, currentUser.role);
    if (ownership.hasConflict) {
        setOwnershipConflict({ show: true, message: ownership.message });
        setFormData(prev => ({ ...prev, name: '', sector: '', sectorId: '', staffId: '', whatsapp: '', guide: '', lesson: '', status: RecordStatus.INICIO }));
        setIsSectorLocked(false);
        return;
    }

    const match = selectedLabel.match(/\((.*?)\)$/);
    let targetSector = formData.sector;
    let targetSectorId = formData.sectorId;
    let targetStaffId = formData.staffId;
    let targetWhatsApp = formData.whatsapp;
    let targetGuide = formData.guide;
    let targetLesson = formData.lesson;
    let targetStatus = RecordStatus.INICIO; 
    let lockSector = false;
    const normName = normalizeString(targetName);

    if (formData.participantType === ParticipantType.STAFF) {
        let staff: any;
        if (match) staff = proStaff.find(s => s.id === `${unit}-${match[1]}` || s.id === match[1]);
        if (!staff) staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);

        if (staff) {
            targetStaffId = staff.id;
            const sector = proSectors.find(s => s.id === staff.sectorId);
            if (sector) {
                targetSector = sector.name; 
                targetSectorId = sector.id;
                lockSector = true;
            } else {
                lockSector = false;
            }
            targetWhatsApp = staff.whatsapp ? formatWhatsApp(staff.whatsapp) : targetWhatsApp;
        } else {
            lockSector = false;
        }
    } else if (formData.participantType === ParticipantType.PATIENT) {
        const p = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (p) {
            targetWhatsApp = p.whatsapp ? formatWhatsApp(p.whatsapp) : targetWhatsApp;
            targetStaffId = p.id;
        }
        lockSector = false;
    } else {
        const pr = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (pr) { 
            targetWhatsApp = pr.whatsapp ? formatWhatsApp(pr.whatsapp) : targetWhatsApp; 
            targetSector = pr.sector || targetSector; 
            targetStaffId = pr.id;
        }
        lockSector = false;
    }

    const lastRecord = [...allHistory]
        .filter(h => normalizeString(h.name) === normName && h.unit === unit)
        .sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return (b.createdAt || 0) - (a.createdAt || 0);
        })[0];
    
    if (lastRecord) {
        targetGuide = lastRecord.guide;
        
        const lastNum = parseInt(lastRecord.lesson);
        if (!isNaN(lastNum)) {
            targetLesson = (lastNum + 1).toString();
            targetStatus = (lastNum + 1) > 1 ? RecordStatus.CONTINUACAO : RecordStatus.INICIO;
        } else {
            targetLesson = lastRecord.lesson;
            targetStatus = RecordStatus.CONTINUACAO;
        }
    }

    setFormData(prev => ({ 
        ...prev, 
        name: targetName, 
        sector: targetSector || '', 
        sectorId: targetSectorId || '', 
        staffId: targetStaffId || '', 
        whatsapp: targetWhatsApp || '', 
        guide: targetGuide || '', 
        lesson: targetLesson || '', 
        status: targetStatus || RecordStatus.INICIO
    }));
    setIsSectorLocked(lockSector);
    if (lockSector) showToast("Setor vinculado ao cadastro oficial.", "info");
  };

  const handleClear = () => {
    setFormData({ ...defaultState, date: formData.date });
    setIsSectorLocked(false);
    showToast("Campos limpos!", "info");
  };

  const handleChangeName = (v: string) => {
      setFormData({...formData, name: v});
      if (!v) setIsSectorLocked(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.name || !formData.guide || !formData.lesson) { showToast("Preencha Nome, Guia e Lição."); return; }
    
    console.log(`[DEBUG] handleFormSubmit: formData.date=${formData.date}, currentUser.role=${currentUser.role}, editAuthorizations.length=${editAuthorizations.length}`);
    if (isRecordLocked(formData.date, currentUser.role, 'bibleStudies', editAuthorizations, false)) {
        console.log(`[DEBUG] handleFormSubmit: Blocked!`);
        showToast("Este período está bloqueado para lançamentos.", "error");
        return;
    }
    console.log(`[DEBUG] handleFormSubmit: Not blocked, proceeding.`);

    const conflict = checkIdentityConflict(formData.name, formData.participantType, unit);
    if (conflict.hasConflict) {
        showToast(conflict.message, "warning");
        return;
    }

    // Double check on submit
    const ownership = checkOwnershipConflict(formData.name, 'study', unit, currentUser.id, currentUser.role);
    if (ownership.hasConflict) {
        setOwnershipConflict({ show: true, message: ownership.message });
        return;
    }

    const isStaff = formData.participantType === ParticipantType.STAFF;

    if (isStaff) {
        if (!formData.sector) { showToast("Para colaboradores, o Setor é obrigatório.", "warning"); return; }
        // FLEXIBILIZAR: Removido bloqueio de existência no Banco de RH e Setores Oficiais
    } else {
        if (!formData.whatsapp || formData.whatsapp.length < 10) { showToast(`O WhatsApp é obrigatório para ${formData.participantType}.`, "warning"); return; }
    }

    setIsSubmitting(true);
    try {
      await syncMasterContact(formData.name, formData.whatsapp, unit, formData.participantType!, formData.sector);
      await onSubmit({ ...formData, unit, participantType: formData.participantType });
      setFormData({ ...defaultState, date: getToday() });
      setIsSectorLocked(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setIsSubmitting(false);
    }
  };


  return {
    formData, setFormData,
    isSectorLocked, setIsSectorLocked,
    isSubmitting,
    guideOptions, sectorOptions, studentOptions,
    editAuthorizations,
    handleSelectStudent, handleClear, handleChangeName, handleFormSubmit,
    handleContinueStudy: (item: BibleStudy) => {
        const normName = normalizeString(item.name);
        const lastRecord = [...allHistory]
            .filter(h => normalizeString(h.name) === normName && h.unit === unit)
            .sort((a, b) => {
                const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
                if (dateDiff !== 0) return dateDiff;
                return (b.createdAt || 0) - (a.createdAt || 0);
            })[0];
        
        const baseItem = lastRecord || item;

        setFormData(prev => ({
            ...prev,
            id: '', // CRITICAL: Clear ID to ensure a new record is created
            name: baseItem.name,
            participantType: baseItem.participantType || ParticipantType.STAFF,
            sector: baseItem.sector,
            whatsapp: baseItem.whatsapp,
            guide: baseItem.guide,
            lesson: !isNaN(parseInt(baseItem.lesson)) ? (parseInt(baseItem.lesson) + 1).toString() : baseItem.lesson,
            status: RecordStatus.CONTINUACAO
        }));
        showToast(`Continuando estudo de ${baseItem.name}`, "info");
    },
    defaultState,
    ownershipConflict, setOwnershipConflict
  };
};
