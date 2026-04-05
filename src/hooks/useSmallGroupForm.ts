import { useState, useEffect, useMemo, useCallback } from 'react';
import { Unit, SmallGroup, User, ParticipantType } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../hooks/useApp';
import { normalizeString, formatWhatsApp, ensureISODate } from '../utils/formatters';
import { isRecordLocked, isValidWhatsApp } from '../utils/validators';
import { usePGInference } from './usePGInference';

interface UseSmallGroupFormProps {
  unit: Unit;
  history: SmallGroup[];
  editingItem?: SmallGroup;
  currentUser: User;
  onSubmit: (data: any) => void;
}

export const useSmallGroupForm = ({ unit, history, editingItem, currentUser, onSubmit }: UseSmallGroupFormProps) => {
  const { proSectors, proGroups, proStaff, saveRecord, visitRequests, syncMasterContact, proGroupLocations, editAuthorizations } = useApp();
  const { inferPGDetails, inferLeaderDetails } = usePGInference(unit, proGroups, proSectors, proGroupLocations, proStaff);
  const { showToast } = useToast();
  
  const getToday = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const defaultState = useMemo(() => ({ 
    id: '', userId: currentUser.id, date: getToday(), sector: '', groupName: '', leader: '', 
    leaderPhone: '', shift: 'Manhã', participantsCount: 0, observations: '' 
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

  useEffect(() => {
    if (!formData.groupName && !editingItem) {
        setFormData(prev => ({ ...prev, leader: '', leaderPhone: '', sector: '' }));
        setIsSectorLocked(false);
    }
  }, [formData.groupName, editingItem]);

  const sectorOptions = useMemo(() => proSectors.filter(s => s.unit === unit).map(s => ({ value: s.name, label: s.name })), [proSectors, unit]);
  const pgOptions = useMemo(() => proGroups.filter(g => g.unit === unit).map(g => ({ value: g.name, label: g.name })), [proGroups, unit]);
  const staffOptions = useMemo(() => proStaff.filter(s => s.unit === unit).map(staff => ({ value: staff.name, label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`, category: 'RH' as const })), [proStaff, unit]);

  useEffect(() => {
    if (editingItem) {
      if ((editingItem as any).isMission) {
        const mission = editingItem as any;
        const details = inferPGDetails(mission.groupName);
        
        let shift = 'Manhã';
        if (mission.scheduledTime) {
            const hour = parseInt(mission.scheduledTime.split(':')[0]);
            if (hour >= 18) shift = 'Noite';
            else if (hour >= 12) shift = 'Tarde';
        }

        setFormData({
          id: '',
          userId: currentUser.id,
          date: mission.date || getToday(),
          groupName: mission.groupName || '',
          leader: mission.leader || details.leaderName || '',
          leaderPhone: mission.leaderPhone ? formatWhatsApp(mission.leaderPhone) : (details.leaderPhone ? formatWhatsApp(details.leaderPhone) : ''),
          sector: mission.sectorName || details.sectorName || '',
          shift: shift,
          participantsCount: 0,
          observations: ''
        });
        
        setIsSectorLocked(!!mission.sectorId || !!details.sectorId);
        showToast(`Missão carregada: ${mission.groupName}`, "success");
      } else {
        setFormData({ 
          id: editingItem.id || '',
          userId: editingItem.userId || currentUser.id,
          date: ensureISODate(editingItem.date) || getToday(), 
          groupName: editingItem.groupName || '',
          leader: editingItem.leader || '',
          leaderPhone: editingItem.leaderPhone || '',
          sector: editingItem.sector || '',
          shift: editingItem.shift || 'Manhã',
          participantsCount: editingItem.participantsCount || 0,
          observations: editingItem.observations || '' 
        });
        const details = inferPGDetails(editingItem.groupName);
        setIsSectorLocked(!!details.sectorId);
      }
    }
  }, [editingItem, inferPGDetails, unit, getToday, currentUser.id, showToast]);

  const handleSelectPG = (pgName: string) => {
      const details = inferPGDetails(pgName);
      setIsSectorLocked(!!details.sectorId);
      setFormData(prev => ({ 
        ...prev, 
        groupName: pgName, 
        leader: details.leaderName || '', 
        leaderPhone: details.leaderPhone ? formatWhatsApp(details.leaderPhone) : '', 
        sector: details.sectorName || '' 
      }));
      if(details.leaderName || details.sectorName) showToast("Dados oficiais do líder carregados.", "info");
  };

  const handleSelectLeader = (label: string) => {
      const nameOnly = label.split(' (')[0].trim();
      const normName = normalizeString(nameOnly);
      
      // CROSS-VALIDATION: Se for Paciente ou Prestador mas selecionado como Líder (Ponto 2)
      const isProvider = proProviders.some(p => normalizeString(p.name) === normName && p.unit === unit);
      const isPatient = proPatients.some(p => normalizeString(p.name) === normName && p.unit === unit);
      if (isProvider || isPatient) {
          showToast(`${nameOnly} consta na lista de ${isProvider ? 'prestadores' : 'pacientes'}. Pequenos Grupos são para colaboradores.`, "warning");
      }

      // Check if leader is in RH (proStaff)
      const staff = proStaff.find(s => normalizeString(s.name) === normName);
      
      if (staff) {
          // Found in RH: Update sector, update phone if exists, else clear phone
          const sectorName = staff.sectorId ? (proSectors.find(s => s.id === staff.sectorId)?.name || '') : '';
          setFormData(prev => ({ 
              ...prev, 
              leader: nameOnly, 
              leaderPhone: staff.whatsapp ? formatWhatsApp(staff.whatsapp) : '', 
              sector: sectorName || prev.sector 
          }));
          setIsSectorLocked(!!staff.sectorId);
          if (staff.sectorId) showToast("Setor e WhatsApp vinculados ao cadastro.", "info");
      } else {
          // Not in RH: Clear both
          setFormData(prev => ({ 
              ...prev, 
              leader: nameOnly, 
              leaderPhone: '', 
              sector: '' 
          }));
          setIsSectorLocked(false);
      }
  };

  const handleLeaderChange = (name: string) => {
      setFormData(prev => ({ ...prev, leader: name }));
      if (!name) {
          setIsSectorLocked(false);
          setFormData(prev => ({ ...prev, leaderPhone: '', sector: '' }));
          return;
      }
      
      // Check if leader is in RH (proStaff)
      const staff = proStaff.find(s => normalizeString(s.name) === normalizeString(name));
      
      if (staff) {
          // Found in RH: Update sector, update phone if exists, else clear phone
          const sectorName = staff.sectorId ? (proSectors.find(s => s.id === staff.sectorId)?.name || '') : '';
          setFormData(prev => ({ 
              ...prev, 
              leaderPhone: staff.whatsapp ? formatWhatsApp(staff.whatsapp) : '', 
              sector: sectorName || prev.sector 
          }));
          setIsSectorLocked(!!staff.sectorId);
      } else {
          // Not in RH: Clear both
          setFormData(prev => ({ ...prev, leaderPhone: '', sector: '' }));
          setIsSectorLocked(false);
      }
  };

  const handleClear = () => {
    setFormData({ ...defaultState, date: formData.date });
    setIsSectorLocked(false);
    showToast("Campos limpos!", "info");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.groupName || !formData.leader || !formData.leaderPhone || !formData.sector) { showToast("Preencha todos os campos obrigatórios."); return; }
    
    if (!isValidWhatsApp(formData.leaderPhone)) { showToast("Por favor, insira um número de WhatsApp válido para o líder.", "error"); return; }

    const isOfficialLeader = proStaff.some(s => normalizeString(s.name) === normalizeString(formData.leader) && s.unit === unit);
    if (!isOfficialLeader) {
        showToast("Líder não reconhecido. Por favor, use o campo de busca para selecionar um colaborador oficial do RH.", "warning");
        return;
    }

    if (!proGroups.some(g => g.name === formData.groupName && g.unit === unit)) { showToast("Selecione um Pequeno Grupo válido da lista.", "warning"); return; }
    if (!proSectors.some(s => s.name === formData.sector && s.unit === unit)) { showToast("Selecione um setor oficial válido.", "warning"); return; }
    
    if (isRecordLocked(formData.date, currentUser.role, 'smallGroups', editAuthorizations)) {
        showToast("Este período está bloqueado para lançamentos.", "error");
        return;
    }

    setIsSubmitting(true);
    try {
      await syncMasterContact(formData.leader, formData.leaderPhone, unit, ParticipantType.STAFF, formData.sector);
      const pgMaster = proGroups.find(g => g.name === formData.groupName && g.unit === unit);
      
      if (pgMaster) {
          const cleanPhone = formData.leaderPhone.replace(/\D/g, '');
          const targetSector = proSectors.find(s => s.name === formData.sector && s.unit === unit);
          
          const leaderChanged = pgMaster.leader !== formData.leader;
          const phoneChanged = cleanPhone !== (pgMaster.leaderPhone || '');
          const sectorChanged = targetSector && pgMaster.sectorId !== targetSector.id;
          
          if (leaderChanged || phoneChanged || sectorChanged) {
              await saveRecord('proGroups', { 
                  ...pgMaster, 
                  leader: formData.leader,
                  currentLeader: formData.leader,
                  leaderPhone: cleanPhone,
                  ...(targetSector ? { sectorId: targetSector.id } : {})
              });
          }
      } else {
          // PG Master not found
      }

      const pendingAgenda = visitRequests
        .filter(req => 
          req.status === 'assigned' && 
          req.assignedChaplainId === currentUser.id && 
          normalizeString(req.pgName) === normalizeString(formData.groupName)
        )
        .sort((a, b) => {
          const diffA = Math.abs(new Date(a.date).getTime() - new Date(formData.date).getTime());
          const diffB = Math.abs(new Date(b.date).getTime() - new Date(formData.date).getTime());
          return diffA - diffB;
        })[0];

      if (pendingAgenda) {
        await saveRecord('visitRequests', { 
          ...pendingAgenda, 
          status: 'confirmed', 
          isRead: true 
        });
      }

      await onSubmit({ ...formData, unit, leaderPhone: formData.leaderPhone.replace(/\D/g, '') });
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
    sectorOptions, pgOptions, staffOptions,
    editAuthorizations,
    handleSelectPG, handleSelectLeader, handleLeaderChange, handleClear, handleFormSubmit,
    defaultState
  };
};
