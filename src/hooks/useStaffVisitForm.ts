import { useState, useEffect, useMemo, useCallback } from 'react';
import { Unit, StaffVisit, User, VisitReason, ParticipantType } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../hooks/useApp';
import { normalizeString, formatWhatsApp, ensureISODate } from '../utils/formatters';
import { isRecordLocked, isValidWhatsApp } from '../utils/validators';
import { AutocompleteOption } from '../components/Shared/Autocomplete';
import { useIdentityGuard } from './useIdentityGuard';

interface UseStaffVisitFormProps {
  unit: Unit;
  history: StaffVisit[];
  allHistory?: StaffVisit[];
  editingItem?: StaffVisit;
  currentUser: User;
  onSubmit: (data: any) => void;
}

export const useStaffVisitForm = ({ unit, history, allHistory = [], editingItem, currentUser, onSubmit }: UseStaffVisitFormProps) => {
  const { proStaff, proProviders, proSectors, syncMasterContact, editAuthorizations } = useApp();
  const { showToast } = useToast();
  const { checkIdentityConflict } = useIdentityGuard();

  const getToday = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const defaultState = useMemo(() => ({ 
    id: '', userId: currentUser.id, date: getToday(), sector: '', location: '', reason: VisitReason.ROTINA, 
    staffName: '', staffId: '', providerId: '', whatsapp: '', participantType: ParticipantType.STAFF, 
    providerRole: '', requiresReturn: false, returnDate: getToday(), 
    returnCompleted: false, observations: '' 
  }), [getToday, currentUser.id]);
  
  const [formData, setFormData] = useState(defaultState);
  const [isSectorLocked, setIsSectorLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const identityConflict = useMemo(() => {
    return checkIdentityConflict(formData.staffName, formData.participantType, unit);
  }, [formData.staffName, formData.participantType, unit, checkIdentityConflict]);

  useEffect(() => {
    if (!editingItem) {
      setFormData(prev => ({ ...defaultState, userId: currentUser.id, date: prev.date || getToday(), participantType: prev.participantType }));
      setIsSectorLocked(false);
    }
  }, [editingItem, defaultState, getToday, currentUser.id]);

  const sectorOptions = useMemo(() => 
    proSectors.filter(s => s.unit === unit).map(s => ({value: s.name, label: s.name})).sort((a,b) => a.label.localeCompare(b.label)), 
  [proSectors, unit]);

  const nameOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const officialSet = new Set<string>();
    
    if (formData.participantType === ParticipantType.STAFF) {
        proStaff.filter(s => s.unit === unit).forEach(staff => {
          const sector = proSectors.find(sec => sec.id === staff.sectorId);
          options.push({ value: staff.name, label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`, subLabel: sector ? sector.name : 'Setor não informado', category: 'RH' });
          officialSet.add(normalizeString(staff.name));
        });
    } else {
        proProviders.filter(p => p.unit === unit).forEach(provider => {
            options.push({ value: provider.name, label: provider.name, subLabel: provider.sector || 'Sem setor fixo', category: 'RH' });
            officialSet.add(normalizeString(provider.name));
        });
    }

    const uniqueNames = new Set<string>();
    history.forEach(v => {
      const historyType = (v as any).participantType || ParticipantType.STAFF;
      if (historyType === formData.participantType && v.staffName) {
         const norm = normalizeString(v.staffName);
         if (!uniqueNames.has(norm) && !officialSet.has(norm)) {
             uniqueNames.add(norm);
             options.push({ value: v.staffName, label: v.staffName, subLabel: v.sector, category: 'History' });
         }
      }
    });
    return options;
  }, [proStaff, proProviders, proSectors, unit, history, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      if ((editingItem as any).isReturn) {
        // É um agendamento de retorno vindo do Dashboard
        setFormData({
          id: '',
          userId: currentUser.id,
          date: getToday(),
          staffName: editingItem.staffName || '',
          sector: editingItem.sector || '',
          participantType: (editingItem as any).participantType || ParticipantType.STAFF,
          providerRole: (editingItem as any).providerRole || '',
          whatsapp: (editingItem as any).whatsapp || '',
          reason: VisitReason.ACOMPANHAMENTO,
          requiresReturn: false,
          returnDate: getToday(),
          staffId: editingItem.staffId || '',
          providerId: editingItem.providerId || '',
          returnCompleted: false,
          observations: ''
        });
        if ((editingItem as any).participantType === ParticipantType.STAFF || !(editingItem as any).participantType) {
          const staff = proStaff.find(s => normalizeString(s.name) === normalizeString(editingItem.staffName) && s.unit === unit);
          setIsSectorLocked(!!staff);
        } else {
          setIsSectorLocked(false);
        }
      } else {
        // Edição normal de um registro existente
        setFormData({ 
          id: editingItem.id || '',
          userId: editingItem.userId || currentUser.id,
          date: ensureISODate(editingItem.date) || getToday(),
          sector: editingItem.sector || '',
          location: editingItem.location || '',
          reason: editingItem.reason || VisitReason.ROTINA,
          staffName: editingItem.staffName || '',
          staffId: editingItem.staffId || '',
          providerId: editingItem.providerId || '',
          whatsapp: (editingItem as any).whatsapp || '', 
          participantType: (editingItem as any).participantType || ParticipantType.STAFF, 
          providerRole: (editingItem as any).providerRole || '', 
          requiresReturn: editingItem.requiresReturn || false,
          returnDate: ensureISODate(editingItem.returnDate) || getToday(), 
          returnCompleted: editingItem.returnCompleted || false,
          observations: editingItem.observations || '' 
        });
        if (editingItem.participantType === ParticipantType.STAFF || !editingItem.participantType) {
            const staff = proStaff.find(s => normalizeString(s.name) === normalizeString(editingItem.staffName) && s.unit === unit);
            setIsSectorLocked(!!staff);
        } else {
            setIsSectorLocked(false);
        }
      }
    }
  }, [editingItem, unit, proStaff, getToday, currentUser.id]);

  const handleSelectName = (label: string) => {
      const nameOnly = label.split(' (')[0].trim();
      const match = label.match(/\((.*?)\)$/);
      let foundSector = formData.sector;
      let foundSectorId = formData.sectorId;
      let foundWhatsapp = formData.whatsapp;
      let foundStaffId = '';
      let foundProviderId = '';
      let lockSector = false;
      const normName = normalizeString(nameOnly);

      // AUTO-SWITCH: Se for Prestador, muda automaticamente (Ponto 3)
      const isProvider = proProviders.some(p => normalizeString(p.name) === normName && p.unit === unit);
      if (isProvider && formData.participantType !== ParticipantType.PROVIDER) {
          setFormData(prev => ({ ...prev, participantType: ParticipantType.PROVIDER }));
          showToast(`${nameOnly} é um Prestador. Tipo alterado automaticamente.`, "info");
      }

      // CROSS-VALIDATION: Se for Colaborador mas selecionado em outra aba (Ponto 2)
      const isStaffInRH = proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);
      if (isStaffInRH && formData.participantType !== ParticipantType.STAFF) {
          showToast(`${nameOnly} consta na lista de colaboradores. Por favor, mude o tipo para colaborador ou peça ao capelão para alterar.`, "warning");
      }

      if (formData.participantType === ParticipantType.STAFF || (isStaffInRH && isProvider)) {
          let staff: any;
          if (match) staff = proStaff.find(s => s.id === `${unit}-${match[1]}` || s.id === match[1] || s.id === match[1].padStart(6, '0'));
          if (!staff) staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);

          if (staff) {
              const sector = proSectors.find(s => s.id === staff.sectorId);
              if (sector) { 
                  foundSector = sector.name; 
                  foundSectorId = sector.id;
                  lockSector = true; 
              } else { lockSector = false; }
              if (staff.whatsapp) foundWhatsapp = formatWhatsApp(staff.whatsapp);
              foundStaffId = staff.id;
          } else { lockSector = false; }
      } else {
          const provider = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
          if (provider) {
              if (provider.sector) foundSector = provider.sector;
              if (provider.whatsapp) foundWhatsapp = formatWhatsApp(provider.whatsapp);
              foundProviderId = provider.id;
          }
          lockSector = false;
      }

      setFormData(prev => ({ 
        ...prev, 
        staffName: nameOnly, 
        staffId: foundStaffId || '', 
        providerId: foundProviderId || '', 
        whatsapp: foundWhatsapp || '', 
        sector: foundSector || '',
        sectorId: foundSectorId || ''
      }));
      setIsSectorLocked(lockSector);
      if (lockSector) showToast("Setor e WhatsApp vinculados ao cadastro.", "info");
  };

  const handleClear = () => {
    setFormData({ ...defaultState, date: formData.date, participantType: formData.participantType });
    setIsSectorLocked(false);
    showToast("Campos limpos!", "info");
  };

  const handleChangeName = (v: string) => {
      setFormData({...formData, staffName: v, staffId: '', providerId: '', sectorId: ''});
      if (!v) setIsSectorLocked(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.date) { showToast("Data obrigatória."); return; }
    if (!formData.staffName) { showToast("Nome obrigatório."); return; }
    if (!formData.reason) { showToast("Motivo obrigatório."); return; }
    
    const conflict = checkIdentityConflict(formData.staffName, formData.participantType, unit);
    if (conflict.hasConflict && !conflict.isWarning) {
        showToast(conflict.message, "error");
        return;
    }

    const isStaff = formData.participantType === ParticipantType.STAFF;
    const normName = normalizeString(formData.staffName);

    const dataToSubmit = { ...formData, unit };

    if (isStaff) {
        const isOfficialStaff = proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);
        if (!isOfficialStaff) {
            showToast("Para colaboradores, o nome deve ser selecionado da lista oficial do RH.", "error");
            return;
        }
        
        const isOfficialSector = proSectors.some(s => s.name === formData.sector && s.unit === unit);
        if (!isOfficialSector) {
            showToast("Para colaboradores, o setor deve ser selecionado da lista oficial.", "error");
            return;
        }

        if (!formData.sector) { showToast("Setor é obrigatório para colaboradores.", "warning"); return; }
        
        // Ensure sectorId is set if not already
        if (!dataToSubmit.sectorId) {
            const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
            if (staff) dataToSubmit.sectorId = staff.sectorId;
        }
    } else {
        if (!formData.whatsapp || formData.whatsapp.length < 10) { showToast("WhatsApp é obrigatório para prestadores.", "warning"); return; }
        if (!isValidWhatsApp(formData.whatsapp)) { showToast("Por favor, insira um número de WhatsApp válido.", "error"); return; }
        dataToSubmit.sector = '';
    }

    if (isRecordLocked(formData.date, currentUser.role, 'staffVisits', editAuthorizations)) {
        showToast("Este período está bloqueado para lançamentos.", "error");
        return;
    }
    
    setIsSubmitting(true);
    try {
      if (isStaff) {
          if (dataToSubmit.whatsapp) await syncMasterContact(dataToSubmit.staffName, dataToSubmit.whatsapp, unit, ParticipantType.STAFF);
      } else {
          await syncMasterContact(dataToSubmit.staffName, dataToSubmit.whatsapp, unit, ParticipantType.PROVIDER, dataToSubmit.sector);
      }
      
      await onSubmit({...dataToSubmit, unit});
      setFormData({ ...defaultState, date: getToday(), returnDate: getToday(), participantType: dataToSubmit.participantType });
      setIsSectorLocked(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePerformReturn = (item: StaffVisit) => {
    setFormData({
      id: '',
      date: getToday(),
      staffName: item.staffName || '',
      staffId: item.staffId || '',
      providerId: item.providerId || '',
      sector: item.sector || '',
      participantType: (item as any).participantType || ParticipantType.STAFF,
      providerRole: (item as any).providerRole || '',
      whatsapp: item.whatsapp || '',
      reason: VisitReason.ACOMPANHAMENTO,
      requiresReturn: false,
      returnDate: ensureISODate(item.returnDate) || getToday(),
      returnCompleted: false,
      observations: ''
    });
    if ((item as any).participantType === ParticipantType.STAFF || !(item as any).participantType) {
      const match = proStaff.find(s => normalizeString(s.name) === normalizeString(item.staffName));
      if (match && match.sectorId) {
        setIsSectorLocked(true);
      }
    }
    
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
    showToast("Formulário preenchido para novo retorno!", "success");
  };

  const sortedHistory = useMemo(() => {
    const normalize = (s: string) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
    const isAdmin = currentUser.role === 'ADMIN';
    
    return [...history].sort((a, b) => {
      const isFulfilled = (visit: StaffVisit) => {
        if (!visit.requiresReturn) return true;
        const vDate = new Date(visit.date).getTime();
        return (allHistory.length > 0 ? allHistory : history).some(v => 
          v.id !== visit.id &&
          normalize(v.staffName) === normalize(visit.staffName) && 
          new Date(v.date).getTime() >= vDate
        );
      };

      const aPending = a.requiresReturn && !isFulfilled(a);
      const bPending = b.requiresReturn && !isFulfilled(b);

      const aPriority = aPending && (isAdmin || a.userId === currentUser.id);
      const bPriority = bPending && (isAdmin || b.userId === currentUser.id);

      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;

      if (aPriority && bPriority) {
        return new Date(a.returnDate).getTime() - new Date(b.returnDate).getTime();
      }

      // Admin priority for general history
      if (isAdmin) {
        const aIsMine = a.userId === currentUser.id;
        const bIsMine = b.userId === currentUser.id;
        if (aIsMine && !bIsMine) return -1;
        if (!aIsMine && bIsMine) return 1;
      }

      // 2. Ordenação por data (mais recente primeiro)
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      
      // 3. Tie-breaker: createdAt (mais recente primeiro)
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [history, allHistory, currentUser]);

  return {
    formData, setFormData,
    isSectorLocked, setIsSectorLocked,
    isSubmitting,
    sectorOptions, nameOptions,
    editAuthorizations,
    handleSelectName, handleClear, handleChangeName, handleFormSubmit, handlePerformReturn,
    sortedHistory, defaultState, identityConflict
  };
};
