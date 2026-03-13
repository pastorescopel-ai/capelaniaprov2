
import { useState, useCallback } from 'react';
import { VisitRequest, Unit, User } from '../types';
import { useToast } from '../contexts/ToastProvider';

export const useVisitManagement = (
  saveRecord: (collection: string, item: any) => Promise<boolean>,
  deleteRecord: (collection: string, id: string) => Promise<boolean>
) => {
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [inviteToDelete, setInviteToDelete] = useState<string | null>(null);

  // Form State
  const [selectedPG, setSelectedPG] = useState('');
  const [selectedChaplainId, setSelectedChaplainId] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [visitTime, setVisitTime] = useState('19:00');
  const [notes, setNotes] = useState('');

  const handleCancelEdit = useCallback(() => {
    setEditingRequestId(null);
    setNotes('');
    setSelectedPG('');
    setSelectedChaplainId('');
    setLeaderPhone('');
    setMeetingLocation('');
    setVisitDate(new Date().toLocaleDateString('en-CA'));
    setVisitTime('19:00');
  }, []);

  const handleEditRequest = useCallback((req: VisitRequest) => {
    setEditingRequestId(req.id);
    setSelectedPG(req.pgName);
    setSelectedChaplainId(req.assignedChaplainId || '');
    setLeaderPhone(req.leaderPhone || '');
    setMeetingLocation(req.meetingLocation || '');
    setVisitDate(req.date.split('T')[0]);
    setVisitTime(req.scheduledTime || '19:00');
    setNotes(req.requestNotes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSaveVisit = useCallback(async (
    unit: Unit,
    pgDetails: { leaderName: string; leaderPhone: string; sectorId: string | null; staffId: string | null },
    proStaff: any[]
  ) => {
    if (!selectedPG || !selectedChaplainId || !visitDate || !visitTime || !leaderPhone) {
      showToast("Preencha todos os campos, incluindo WhatsApp do Líder.", "warning");
      return false;
    }

    setIsProcessing(true);
    try {
      // 1. Atualizar WhatsApp do Colaborador se houver staffId
      if (pgDetails.staffId) {
        const staff = proStaff.find(s => s.id === pgDetails.staffId);
        if (staff && staff.whatsapp !== leaderPhone) {
          await saveRecord('proStaff', { ...staff, whatsapp: leaderPhone, updatedAt: Date.now() });
        }
      }

      const requestData: VisitRequest = {
        id: editingRequestId || crypto.randomUUID(),
        pgName: selectedPG,
        leaderName: pgDetails.leaderName || 'Líder não registrado',
        leaderPhone: leaderPhone,
        unit: unit,
        date: `${visitDate}T00:00:00Z`,
        scheduledTime: visitTime,
        status: 'assigned',
        assignedChaplainId: selectedChaplainId,
        requestNotes: notes || "Visita de acompanhamento designada pela gestão.",
        sectorId: pgDetails.sectorId,
        meetingLocation: meetingLocation || '',
        isRead: false
      };

      const success = await saveRecord('visitRequests', requestData);
      if (success) {
        showToast(editingRequestId ? 'Agendamento atualizado!' : 'Visita agendada!', "success");
        handleCancelEdit();
        return true;
      }
      showToast("Erro ao salvar agendamento.", "warning");
      return false;
    } catch (e) {
      showToast("Erro ao processar agendamento.", "warning");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPG, selectedChaplainId, leaderPhone, meetingLocation, visitDate, visitTime, notes, editingRequestId, saveRecord, showToast, handleCancelEdit]);

  const handleDeleteVisit = useCallback(async (id: string) => {
    setIsProcessing(true);
    try {
      const success = await deleteRecord('visitRequests', id);
      if (success) {
        showToast("Agendamento excluído.", "success");
        if (editingRequestId === id) handleCancelEdit();
        return true;
      }
      showToast("Erro ao excluir.", "warning");
      return false;
    } catch (e) {
      showToast("Erro ao excluir.", "warning");
      return false;
    } finally {
      setIsProcessing(false);
      setInviteToDelete(null);
    }
  }, [deleteRecord, editingRequestId, handleCancelEdit, showToast]);

  return {
    isProcessing,
    editingRequestId,
    inviteToDelete,
    setInviteToDelete,
    form: {
      selectedPG, setSelectedPG,
      selectedChaplainId, setSelectedChaplainId,
      leaderPhone, setLeaderPhone,
      meetingLocation, setMeetingLocation,
      visitDate, setVisitDate,
      visitTime, setVisitTime,
      notes, setNotes
    },
    handleEditRequest,
    handleCancelEdit,
    handleSaveVisit,
    handleDeleteVisit
  };
};
