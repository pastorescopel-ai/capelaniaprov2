import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Unit, StaffVisit, User, VisitReason, ParticipantType } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../hooks/useApp';
import { normalizeString, formatWhatsApp, ensureISODate } from '../utils/formatters';
import { isRecordLocked, isValidWhatsApp } from '../utils/validators';
import { getValidSectorId } from '../utils/sectorValidation';
import { AutocompleteOption } from '../components/Shared/Autocomplete';
import { useIdentityGuard } from './useIdentityGuard';

interface UseStaffVisitFormProps {
  unit: Unit;
  history: StaffVisit[];
  allHistory?: StaffVisit[];
  editingItem?: StaffVisit;
  currentUser: User;
  onSubmit: (data: any) => void;
  isActive?: boolean;
}

export const useStaffVisitForm = ({ unit, history, allHistory = [], editingItem, currentUser, onSubmit, isActive = true }: UseStaffVisitFormProps) => {
  const { proStaff, proProviders, proSectors, syncMasterContact } = useApp();
  const { showToast } = useToast();
  const { checkIdentityConflict, checkOwnershipConflict } = useIdentityGuard();

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

  useEffect(() => {
    if (!editingItem) {
      setFormData(prev => ({ ...defaultState, userId: currentUser.id, date: prev.date || getToday(), participantType: prev.participantType }));
      setIsSectorLocked(false);
    }
  }, [editingItem, defaultState, getToday, currentUser.id]);

  // Trocar a Unidade (HAB/HABA) descarta o registro em andamento, para evitar que um
  // formulário meio preenchido para uma unidade seja salvo acidentalmente na outra.
  const isFirstUnitRender = useRef(true);
  useEffect(() => {
    if (isFirstUnitRender.current) { isFirstUnitRender.current = false; return; }
    setFormData({ ...defaultState, userId: currentUser.id, date: getToday() });
    setIsSectorLocked(false);
  }, [unit]);

  // Sair desta aba do menu (o componente fica montado em segundo plano) descarta o
  // registro em andamento, para não achar que salvou algo que na real foi abandonado.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (wasActive.current && !isActive && !editingItem) {
      setFormData({ ...defaultState, userId: currentUser.id, date: getToday() });
      setIsSectorLocked(false);
    }
    wasActive.current = isActive;
  }, [isActive]);

  const sectorOptions = useMemo(() => 
    proSectors.filter(s => s.unit === unit).map(s => ({value: s.name, label: s.name})).sort((a,b) => a.label.localeCompare(b.label)), 
  [proSectors, unit]);

  const nameOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const officialSet = new Set<string>();
    
    if (formData.participantType === ParticipantType.STAFF) {
        // Colaboradores desligados/afastados não aparecem mais na busca pra registrar visita
        // nova -- o histórico de visitas já feitas a eles continua intacto em Relatórios.
        proStaff.filter(s => s.unit === unit && s.active !== false).forEach(staff => {
          const validSectorId = getValidSectorId(staff.sectorId, unit, proSectors);
          const sector = validSectorId ? proSectors.find(sec => sec.id === validSectorId) : null;
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

  // Sugestão de visita: colaboradores ATIVOS dos setores onde ESTE capelão já visitou alguém,
  // que ainda nunca receberam visita nenhuma (de qualquer capelão) -- ajuda a completar a
  // cobertura de um setor já iniciado em vez de ter que lembrar/procurar quem falta. Só olha o
  // histórico já carregado em memória (últimos ~45 dias de staff_visits, mesma janela do resto
  // do app) -- visitas mais antigas que isso não entram nesse cálculo.
  const suggestedStaff = useMemo(() => {
    if (formData.participantType !== ParticipantType.STAFF) return [];

    const sectorNameOf = (s: any) => {
      const validSectorId = getValidSectorId(s.sectorId, unit, proSectors);
      const sector = validSectorId ? proSectors.find(sec => sec.id === validSectorId) : null;
      return sector?.name || '';
    };

    const visitedSectorNames = new Set(
      allHistory
        .filter(v => v.userId === currentUser.id && v.unit === unit && ((v as any).participantType || ParticipantType.STAFF) === ParticipantType.STAFF && v.sector)
        .map(v => v.sector)
    );
    if (visitedSectorNames.size === 0) return [];

    const everVisitedNames = new Set(
      allHistory.filter(v => v.unit === unit).map(v => normalizeString((v.staffName || '').split(' (')[0].trim()))
    );

    return proStaff
      .filter(s => s.unit === unit && s.active !== false)
      .map(s => ({ id: s.id, name: s.name, sector: sectorNameOf(s) }))
      .filter(s => s.sector && visitedSectorNames.has(s.sector) && !everVisitedNames.has(normalizeString(s.name)))
      .sort((a, b) => a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name));
  }, [allHistory, proStaff, proSectors, unit, currentUser.id, formData.participantType]);

  // Carrega `editingItem` no formulário só uma vez por registro selecionado. `proStaff`
  // muda de identidade a cada ~30s por causa do polling/realtime em segundo plano --
  // sem esta trava, este efeito reexecutava nesse ritmo mesmo com o editingItem intacto,
  // apagando o que o usuário tinha acabado de digitar (mesmo bug já corrigido em
  // useSmallGroupForm.ts e useBibleStudyForm.ts).
  const loadedEditingItemRef = useRef<StaffVisit | null>(null);
  useEffect(() => {
    if (editingItem) {
      if (loadedEditingItemRef.current === editingItem) return;
      loadedEditingItemRef.current = editingItem;
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
    } else {
      loadedEditingItemRef.current = null;
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
              const validSectorId = getValidSectorId(staff.sectorId, unit, proSectors);
              const sector = validSectorId ? proSectors.find(s => s.id === validSectorId) : null;
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

      // Avisa (sem bloquear) se esta pessoa já recebeu visita antes -- e de quem.
      const visitOwnership = checkOwnershipConflict(nameOnly, 'visit', unit, currentUser.id, currentUser.role);
      if (visitOwnership.hasConflict) {
          showToast(visitOwnership.message, "info", true);
      }
  };

  // Preenche o formulário a partir de um clique na lista de sugestões (ver suggestedStaff) --
  // reaproveita handleSelectName com o mesmo formato de label que a busca normal já usa.
  const handleSelectSuggestion = (staffId: string) => {
      const staff = proStaff.find(s => s.id === staffId);
      if (!staff) return;
      handleSelectName(`${staff.name} (${String(staff.id).split('-')[1] || staff.id})`);
      const scrollContainer = document.getElementById('main-scroll-container');
      if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (conflict.hasConflict) {
        showToast(conflict.message, "warning");
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
        if (!formData.sector) { showToast("Setor é obrigatório para colaboradores.", "warning"); return; }
        
        // Ensure sectorId is set if not already
        if (!dataToSubmit.sectorId) {
            const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
            if (staff) {
                const validSectorId = getValidSectorId(staff.sectorId, unit, proSectors);
                if (validSectorId) dataToSubmit.sectorId = validSectorId;
            }
        }

        // AUTO-RECOVERY DE STAFF ID: Garante que o staffId correto seja persistido no banco
        dataToSubmit.providerId = '';
        if (!dataToSubmit.staffId) {
            const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
            if (staff) dataToSubmit.staffId = staff.id;
        }
    } else {
        if (!formData.whatsapp || formData.whatsapp.length < 10) { showToast("WhatsApp é obrigatório para prestadores.", "warning"); return; }
        if (!isValidWhatsApp(formData.whatsapp)) { showToast("Por favor, insira um número de WhatsApp válido.", "error"); return; }
        dataToSubmit.sector = '';

        // Não busca o providerId aqui: para prestador novo (ainda não cadastrado), o registro só
        // é criado pelo syncMasterContact logo abaixo — buscar antes sempre resultava em id vazio
        // na primeira vez que o prestador era citado, deixando a visita órfã para sempre.
        dataToSubmit.staffId = '';
        dataToSubmit.providerId = '';
    }

    if (isRecordLocked(formData.date, currentUser.role)) {
        showToast("Este período está bloqueado para lançamentos.", "error");
        return;
    }
    
    setIsSubmitting(true);
    try {
      if (isStaff) {
          if (dataToSubmit.whatsapp) await syncMasterContact(dataToSubmit.staffName, dataToSubmit.whatsapp, unit, ParticipantType.STAFF);
      } else {
          const syncedId = await syncMasterContact(dataToSubmit.staffName, dataToSubmit.whatsapp, unit, ParticipantType.PROVIDER, dataToSubmit.sector);
          if (syncedId) dataToSubmit.providerId = syncedId;
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
      if (match) {
        const validSectorId = getValidSectorId(match.sectorId, unit, proSectors);
        if (validSectorId) {
        setIsSectorLocked(true);
        }
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
    sectorOptions, nameOptions, suggestedStaff,
    handleSelectName, handleSelectSuggestion, handleClear, handleChangeName, handleFormSubmit, handlePerformReturn,
    sortedHistory, defaultState
  };
};
