import { useState, useMemo } from 'react';
import { User, VisitRequest, UserRole } from '../types';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { usePGInference } from './usePGInference';

interface UseVisitRequestsWidgetProps {
  requests: VisitRequest[];
  currentUser: User;
  users: User[];
}

export const useVisitRequestsWidget = ({ requests, currentUser, users }: UseVisitRequestsWidgetProps) => {
  const { saveRecord, deleteRecord, proGroups, proSectors, proGroupLocations, proStaff } = useApp();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VisitRequest | null>(null);
  const [actionType, setActionType] = useState<'assign' | 'delete' | null>(null);
  const [selectedChaplainId, setSelectedChaplainId] = useState('');

  const { inferPGDetails } = usePGInference(
    requests[0]?.unit || 'HAB',
    proGroups,
    proSectors,
    proGroupLocations,
    proStaff
  );

  const todayStr = new Date().toLocaleDateString('en-CA');

  const myRequests = useMemo(() => {
    return requests.filter(req => {
      if (req.status === 'confirmed' || req.status === 'declined') return false;
      
      if (currentUser.role === UserRole.ADMIN) return true;
      return req.assignedChaplainId === currentUser.id;
    }).sort((a, b) => {
      const aIsMine = a.assignedChaplainId === currentUser.id;
      const bIsMine = b.assignedChaplainId === currentUser.id;
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [requests, currentUser]);

  const getMeetingSector = (req: VisitRequest) => {
      if (req.meetingLocation) return req.meetingLocation;
      
      if (req.sectorId) {
        const sector = proSectors.find(s => s.id === req.sectorId);
        if (sector) return sector.name;
      }

      const details = inferPGDetails(req.pgName);
      return details.sectorName;
  };

  const getChaplainName = (chaplainId?: string) => {
    if (!chaplainId) return 'Aguardando';
    const chaplain = users.find(u => u.id === chaplainId);
    return chaplain ? chaplain.name : 'Desconhecido';
  };

  const handleUpdateStatus = async (req: VisitRequest, newStatus: string, notes?: string, assignedId?: string) => {
    setIsProcessing(true);
    try {
      const updatedReq = {
        ...req,
        status: newStatus,
        chaplainResponse: notes || req.chaplainResponse,
        assignedChaplainId: assignedId || req.assignedChaplainId,
        isRead: false
      };
      await saveRecord('visitRequests', updatedReq);
      showToast('Escala atualizada com sucesso.', 'success');
      setSelectedRequest(null);
      setActionType(null);
    } catch (e) {
      showToast('Erro ao atualizar escala.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    setIsProcessing(true);
    try {
      await deleteRecord('visitRequests', id);
      showToast('Agendamento removido com sucesso.', 'success');
      setSelectedRequest(null);
      setActionType(null);
    } catch (e) {
      showToast('Erro ao remover agendamento.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const datePart = dateString.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      
      return d.toLocaleDateString('pt-BR', { 
        weekday: 'short', 
        day: '2-digit', 
        month: '2-digit' 
      }).replace('.', '').toUpperCase();
    } catch { return dateString; }
  };

  return {
    isProcessing,
    selectedRequest, setSelectedRequest,
    actionType, setActionType,
    selectedChaplainId, setSelectedChaplainId,
    todayStr,
    myRequests,
    getMeetingSector,
    getChaplainName,
    handleUpdateStatus,
    handleDeleteRequest,
    formatDate
  };
};
