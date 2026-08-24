import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Unit, RecordStatus, BibleStudy, User, ParticipantType } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../hooks/useApp';
import { normalizeString, formatWhatsApp, ensureISODate } from '../utils/formatters';
import { AutocompleteOption } from '../components/Shared/Autocomplete';
import { useIdentityGuard } from './useIdentityGuard';
import { isRecordLocked, isValidWhatsApp } from '../utils/validators';
import { getValidSectorId } from '../utils/sectorValidation';

interface UseBibleStudyFormProps {
  unit: Unit;
  history: BibleStudy[];
  allHistory?: BibleStudy[];
  editingItem?: BibleStudy;
  currentUser: User;
  onSubmit: (data: any) => void;
  isActive?: boolean;
}

export const useBibleStudyForm = ({ unit, history, allHistory = [], editingItem, currentUser, onSubmit, isActive = true }: UseBibleStudyFormProps) => {
  const { proStaff, proPatients, proProviders, proSectors, syncMasterContact } = useApp();
  const { showToast } = useToast();
  const { checkIdentityConflict, checkOwnershipConflict } = useIdentityGuard();
  
  const getToday = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const defaultState = useMemo(() => ({ 
    id: '', userId: currentUser.id, date: getToday(), sector: '', sectorId: '', location: '', name: '', staffId: '', participantId: '',
    whatsapp: '', status: RecordStatus.INICIO, participantType: ParticipantType.STAFF, 
    guide: '', lesson: '', observations: '' 
  }), [getToday, currentUser.id]);
  
  const [formData, setFormData] = useState(defaultState);
  const [isSectorLocked, setIsSectorLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!editingItem) {
      setFormData(prev => ({ ...defaultState, userId: currentUser.id, date: prev.date || getToday() }));
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

  const guideOptions = useMemo(() => {
    const uniqueGuides = new Set<string>();
    allHistory.forEach(s => { if (s.guide && s.unit === unit) uniqueGuides.add(s.guide); });
    return Array.from(uniqueGuides).sort().map(g => ({ value: g, label: g }));
  }, [allHistory, unit]);

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
    const usedNames = new Set<string>();
    const officialSet = new Set<string>();

    // 0. Preparar sets de nomes para priorização (Filtro por Unidade e Categoria)
    const filteredHistory = allHistory.filter(s => (s.participantType || ParticipantType.STAFF) === formData.participantType && s.unit === unit);
    const personalHistoryNames = new Set(filteredHistory.filter(s => s.userId === formData.userId).map(s => normalizeString(s.name)));

    // 1. Processar Lista Oficial (RH/Pacientes/Prestadores) com merge de histórico pessoal
    if (formData.participantType === ParticipantType.STAFF) {
        proStaff.filter(s => s.unit === unit && s.active !== false).forEach(staff => {
          const norm = normalizeString(staff.name);
          officialSet.add(norm);
          usedNames.add(norm);
          
          const isMyStudent = personalHistoryNames.has(norm);
          const validSectorId = getValidSectorId(staff.sectorId, unit, proSectors);
          const sector = validSectorId ? proSectors.find(sec => sec.id === validSectorId) : null;

          options.push({
            value: staff.name,
            label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`,
            subLabel: sector ? sector.name : 'Setor não informado',
            category: isMyStudent ? 'MyStudents' : 'RH',
            highlight: isMyStudent // Destaque só se for MEU aluno (já filtrado só ativos acima)
          });
        });
    } else if (formData.participantType === ParticipantType.PATIENT) {
        proPatients.filter(p => p.unit === unit).forEach(p => {
            const norm = normalizeString(p.name);
            officialSet.add(norm);
            usedNames.add(norm);
            const isMyStudent = personalHistoryNames.has(norm);
            options.push({ 
              value: p.name, 
              label: p.name, 
              subLabel: "Paciente", 
              category: isMyStudent ? "MyStudents" : "RH",
              highlight: isMyStudent
            });
        });
    } else if (formData.participantType === ParticipantType.PROVIDER) {
        proProviders.filter(p => p.unit === unit).forEach(p => {
            const norm = normalizeString(p.name);
            officialSet.add(norm);
            usedNames.add(norm);
            const isMyStudent = personalHistoryNames.has(norm);
            options.push({ 
              value: p.name, 
              label: p.name, 
              subLabel: p.sector || "Prestador", 
              category: isMyStudent ? "MyStudents" : "RH",
              highlight: isMyStudent
            });
        });
    }
    
    // 2. Alunos do Pessoal (não constantes na lista oficial)
    personalHistoryNames.forEach(normName => {
        if (!officialSet.has(normName)) {
            const hist = filteredHistory.find(h => normalizeString(h.name) === normName && h.userId === formData.userId);
            if (hist && !usedNames.has(normName)) {
                usedNames.add(normName);
                options.push({ 
                  value: hist.name, 
                  label: hist.name, 
                  subLabel: hist.sector, 
                  category: 'MyStudents', 
                  highlight: true 
                });
            }
        }
    });

    // 3. Histórico Geral (Outros capelães, mesma categoria)
    filteredHistory.forEach(s => {
      const norm = normalizeString(s.name);
      if (s.name && !usedNames.has(norm) && !officialSet.has(norm)) {
        usedNames.add(norm);
        options.push({ value: s.name, label: s.name, subLabel: s.sector, category: 'History' });
      }
    });

    // 4. Migração: Histórico de outras abas (Ex: era paciente agora é colaborador)
    const otherHistory = allHistory.filter(s => (s.participantType || ParticipantType.STAFF) !== formData.participantType && s.unit === unit);
    otherHistory.forEach(s => {
      const norm = normalizeString(s.name);
      if (s.name && !usedNames.has(norm) && !officialSet.has(norm)) {
        usedNames.add(norm);
        options.push({ value: s.name, label: s.name, subLabel: `${s.sector || 'Sem setor'} (Migrar)`, category: 'Migration' });
      }
    });

    return options;
  }, [allHistory, formData.userId, proStaff, proPatients, proProviders, proSectors, unit, formData.participantType]);

  // Carrega `editingItem` no formulário só uma vez por registro selecionado. `proStaff`
  // muda de identidade a cada ~30s por causa do polling/realtime em segundo plano --
  // sem esta trava, este efeito reexecutava nesse ritmo mesmo com o editingItem intacto,
  // apagando o que o usuário tinha acabado de digitar (mesmo bug já corrigido em
  // useSmallGroupForm.ts e useStaffVisitForm.ts).
  const loadedEditingItemRef = useRef<BibleStudy | null>(null);
  useEffect(() => {
    if (editingItem) {
      if (loadedEditingItemRef.current === editingItem) return;
      loadedEditingItemRef.current = editingItem;
      setFormData({
        id: editingItem.id || '',
        userId: editingItem.userId || currentUser.id,
        date: ensureISODate(editingItem.date) || getToday(),
        sector: editingItem.sector || '',
        sectorId: editingItem.sectorId || '',
        location: editingItem.location || '',
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
    } else {
      loadedEditingItemRef.current = null;
    }
  }, [editingItem, unit, proStaff, getToday, currentUser.id]);

  const handleSelectStudent = (selectedLabel: string) => {
    const targetName = selectedLabel.split(' (')[0].trim();

    // Apenas informa se o aluno já está em estudo com outro capelão — não bloqueia mais o
    // lançamento, só avisa quem é o responsável pra contato/alinhamento entre capelães.
    const ownership = checkOwnershipConflict(targetName, 'study', unit, currentUser.id, currentUser.role);
    if (ownership.hasConflict) {
        showToast(ownership.message, "warning", true);
    }

    const match = selectedLabel.match(/\((.*?)\)$/);
    let targetSector = formData.sector;
    let targetSectorId = formData.sectorId;
    let targetStaffId = formData.staffId;
    let targetParticipantId = formData.participantId;
    let targetWhatsApp = formData.whatsapp;
    let targetGuide = formData.guide;
    let targetLesson = formData.lesson;
    let targetStatus = RecordStatus.INICIO; 
    let lockSector = false;
    const normName = normalizeString(targetName);

    // AUTO-SWITCH: Se for Prestador, muda automaticamente (Ponto 3)
    const isProvider = proProviders.some(p => normalizeString(p.name) === normName && p.unit === unit);
    if (isProvider && formData.participantType !== ParticipantType.PROVIDER) {
        setFormData(prev => ({ ...prev, participantType: ParticipantType.PROVIDER }));
        showToast(`${targetName} é um Prestador. Tipo alterado automaticamente.`, "info");
    }

    // CROSS-VALIDATION: Se for Colaborador mas selecionado em outra aba (Ponto 2)
    const isStaffInRH = proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);
    if (isStaffInRH && formData.participantType !== ParticipantType.STAFF) {
        showToast(`${targetName} consta na lista de colaboradores. Por favor, mude o tipo para colaborador ou peça ao capelão para alterar.`, "warning");
    }

    if (formData.participantType === ParticipantType.STAFF || (isStaffInRH && isProvider)) {
        let staff: any;
        if (match) staff = proStaff.find(s => s.id === `${unit}-${match[1]}` || s.id === match[1]);
        if (!staff) staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);

        if (staff) {
            targetStaffId = staff.id;
            targetParticipantId = ''; // Clear participantId for staff
            const validSectorId = getValidSectorId(staff.sectorId, unit, proSectors);
            const sector = validSectorId ? proSectors.find(s => s.id === validSectorId) : null;
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
            targetParticipantId = p.id;
            targetStaffId = ''; // Clear staffId for non-staff
        }
        lockSector = false;
    } else {
        const pr = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (pr) { 
            targetWhatsApp = pr.whatsapp ? formatWhatsApp(pr.whatsapp) : targetWhatsApp; 
            targetSector = pr.sector || targetSector; 
            targetParticipantId = pr.id;
            targetStaffId = ''; // Clear staffId for non-staff
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
        participantId: targetParticipantId || '',
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
    if (isNaN(Number(formData.lesson)) || Number(formData.lesson) < 1) { showToast("O número da Lição precisa ser 1 ou maior.", "warning"); return; }

    if (isRecordLocked(formData.date, currentUser.role)) {
        showToast("Este período está bloqueado para lançamentos.", "error");
        return;
    }

    const conflict = checkIdentityConflict(formData.name, formData.participantType, unit);
    if (conflict.hasConflict) {
        showToast(conflict.message, "warning");
        return;
    }

    // Double check no envio — só avisa, não bloqueia
    const ownership = checkOwnershipConflict(formData.name, 'study', unit, currentUser.id, currentUser.role);
    if (ownership.hasConflict) {
        showToast(ownership.message, "warning", true);
    }

    const isStaff = formData.participantType === ParticipantType.STAFF;
    const normName = normalizeString(formData.name);

    const dataToSubmit = { ...formData, unit, participantType: formData.participantType };

    // RECUPERAÇÃO DE ID: Garante tratamento isolado e limpeza completa dos IDs redundantes (Ponto de Integridade)
    if (isStaff) {
        dataToSubmit.participantId = '';
        if (!dataToSubmit.staffId) {
            const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
            if (staff) dataToSubmit.staffId = staff.id;
        }
    } else {
        // Não busca o id aqui: para Paciente/Prestador novos (ainda não cadastrados), o registro
        // só é criado pelo syncMasterContact logo abaixo — buscar antes sempre resultava em id
        // vazio na primeira vez que a pessoa era citada, deixando o registro órfão para sempre.
        dataToSubmit.staffId = '';
        dataToSubmit.participantId = '';
    }

    if (isStaff) {
        const isOfficialStaff = proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);
        if (!isOfficialStaff) {
            showToast("Para colaboradores, o nome deve ser selecionado da lista oficial do RH.", "error");
            return;
        }
        if (!formData.sector) { showToast("Para colaboradores, o Setor é obrigatório.", "warning"); return; }
    } else {
        if (!formData.whatsapp || formData.whatsapp.length < 10) { showToast(`O WhatsApp é obrigatório para ${formData.participantType}.`, "warning"); return; }
        if (!isValidWhatsApp(formData.whatsapp)) { showToast("Por favor, insira um número de WhatsApp válido.", "error"); return; }
        dataToSubmit.sector = '';
        dataToSubmit.sectorId = '';
    }

    setIsSubmitting(true);
    try {
      const syncedId = await syncMasterContact(dataToSubmit.name, dataToSubmit.whatsapp, unit, dataToSubmit.participantType!, dataToSubmit.sector);
      if (!isStaff && syncedId) dataToSubmit.participantId = syncedId;
      const result = await onSubmit({ ...dataToSubmit, unit, participantType: dataToSubmit.participantType });
      
      // Se o onSubmit retornar um objeto com success (como o useBibleModule faz)
      if (result && typeof result === 'object' && 'success' in result && !result.success) {
          showToast(result.error?.message || "Erro ao salvar registro.", "error");
          return;
      }

      setFormData({ ...defaultState, date: getToday() });
      setIsSectorLocked(false);
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
    isSectorLocked, setIsSectorLocked,
    isSubmitting,
    guideOptions, sectorOptions, studentOptions,
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
            staffId: baseItem.staffId || '',
            participantId: baseItem.participantId || '',
            guide: baseItem.guide,
            lesson: !isNaN(parseInt(baseItem.lesson)) ? (parseInt(baseItem.lesson) + 1).toString() : baseItem.lesson,
            status: RecordStatus.CONTINUACAO
        }));
        showToast(`Continuando estudo de ${baseItem.name}`, "info");
    },
    defaultState
  };
};
