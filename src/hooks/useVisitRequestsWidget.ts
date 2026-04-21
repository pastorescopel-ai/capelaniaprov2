import { useState, useMemo, useEffect } from 'react';
import { User, VisitRequest, UserRole } from '../types';
import { useApp } from './useApp';
import { useToast } from '../contexts/ToastContext';
import { usePGInference } from './usePGInference';
import { normalizeString, ensureISODate } from '../utils/formatters';

interface UseVisitRequestsWidgetProps {
  requests: VisitRequest[];
  currentUser: User;
  users: User[];
}

export const useVisitRequestsWidget = ({ requests, currentUser, users }: UseVisitRequestsWidgetProps) => {
  const { saveRecord, deleteRecord, proGroups, proSectors, proGroupLocations, proStaff, smallGroups, staffVisits, isInitialized } = useApp();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VisitRequest | null>(null);
  const [actionType, setActionType] = useState<'assign' | 'delete' | null>(null);
  const [selectedChaplainId, setSelectedChaplainId] = useState('');

  // Lógica de Auto-Confirmação em Background
  // Se um PG ou Visita já foi registrado no histórico para o mesmo dia e unidade, 
  // o agendamento deve ser marcado como concluído automaticamente.
  useEffect(() => {
    if (!isInitialized || requests.length === 0) return;

    const syncGhostRequests = async () => {
      const ghostRequests = requests.filter(req => {
        // Agora somos mais cautelosos: só baixamos agendamentos "Assigned" ou "Confirmed"
        if (!['assigned', 'confirmed'].includes(req.status)) return false;
        
        const reqDate = ensureISODate(req.date);
        const today = new Date().toLocaleDateString('en-CA');
        
        // Só fazemos a baixa automática se a data do agendamento for hoje ou anterior
        if (reqDate > today) return false;

        const normName = normalizeString(req.pgName || "");
        
        // Verificação 1: Se é um Pequeno Grupo (tem pgName)
        if (normName) {
           return smallGroups.some(sg => 
             normalizeString(sg.groupName) === normName &&
             ensureISODate(sg.date) === reqDate &&
             sg.unit === req.unit
           );
        }
        
        // Verificação 2: Se é uma Visita de Staff (visita individual)
        return staffVisits.some(sv => 
            ensureISODate(sv.date) === reqDate &&
            sv.unit === req.unit &&
            sv.userId === req.assignedChaplainId
        );
      });

      if (ghostRequests.length > 0) {
        for (const req of ghostRequests) {
          try {
            await saveRecord('visitRequests', { ...req, status: 'completed', isRead: true, updatedAt: Date.now() });
          } catch (err) {
            // Silently handle auto-sync errors
          }
        }
      }
    };

    const timer = setTimeout(syncGhostRequests, 5000); // Aumentado para 5s para evitar conflitos de salvamento
    return () => clearTimeout(timer);
  }, [requests, smallGroups, staffVisits, isInitialized, saveRecord]);

  const { inferPGDetails } = usePGInference(
    requests[0]?.unit || 'HAB',
    proGroups,
    proSectors,
    proGroupLocations,
    proStaff
  );

  const todayStr = new Date().toLocaleDateString('en-CA');

  // Diagnostics Logger for Admin
  useEffect(() => {
    if (currentUser.role === UserRole.ADMIN && requests.length > 0) {
      console.group("🔍 DIAGNÓSTICO ESCALA (ADMIN)");
      console.log("Total requests:", requests.length);
      requests.forEach(req => {
        const reqDate = ensureISODate(req.date);
        const isFuture = reqDate > todayStr;
        const visibilityInfo = {
          id: req.id,
          pg: req.pgName,
          status: req.status,
          date: reqDate,
          isFuture,
          isRead: req.isRead
        };
        console.log(`REQ: ${req.pgName || 'Individual'} (${reqDate}) - Status: ${req.status}`, visibilityInfo);
      });
      console.groupEnd();
    }
  }, [requests, currentUser, todayStr]);

  const myRequests = useMemo(() => {
    return requests.filter(req => {
      // 1. Status Check: Registros explícitamente finalizados somem
      if (['declined', 'cancelled', 'completed'].includes(req.status)) return false;
      
      const reqDate = ensureISODate(req.date);
      const today = new Date().toLocaleDateString('en-CA');

      // 2. Future Protection: Agendamentos futuros SEMPRE são visíveis (Admin) 
      // ou se atribuídos (Capelão)
      if (reqDate > today) {
         if (currentUser.role === UserRole.ADMIN) return true;
         return req.assignedChaplainId === currentUser.id;
      }

      // 3. Current/Past Check: Se já existe um registro correspondente no histórico REAL, ocultamos
      if (req.pgName) {
        const normName = normalizeString(req.pgName);
        const isRegisteredPG = smallGroups.some(sg => 
          normalizeString(sg.groupName) === normName &&
          ensureISODate(sg.date) === reqDate &&
          sg.unit === req.unit
        );
        if (isRegisteredPG) {
           // Se o Admin está vendo e o agendamento ainda está como 'assigned', 
           // é porque a sincronia de fundo ainda não rodou. Ocultamos visualmente de qualquer forma.
           return false;
        }
      } else {
        const isRegisteredVisit = staffVisits.some(sv => 
          ensureISODate(sv.date) === reqDate &&
          sv.unit === req.unit &&
          sv.userId === req.assignedChaplainId
        );
        if (isRegisteredVisit) return false;
      }

      // 4. Role Match
      if (currentUser.role === UserRole.ADMIN) return true;
      return req.assignedChaplainId === currentUser.id;
    }).sort((a, b) => {
      const aIsMine = a.assignedChaplainId === currentUser.id;
      const bIsMine = b.assignedChaplainId === currentUser.id;
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [requests, currentUser, smallGroups, staffVisits]);

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

  const handleDeleteRequest = async (req: VisitRequest) => {
    setIsProcessing(true);
    try {
      await saveRecord('visitRequests', { ...req, status: 'cancelled' });
      showToast('Agendamento cancelado com sucesso.', 'success');
      setSelectedRequest(null);
      setActionType(null);
    } catch (e) {
      showToast('Erro ao cancelar agendamento.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateInput: string | Date) => {
    try {
      const iso = ensureISODate(dateInput);
      const [year, month, day] = iso.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      
      return d.toLocaleDateString('pt-BR', { 
        weekday: 'short', 
        day: '2-digit', 
        month: '2-digit' 
      }).replace('.', '').toUpperCase();
    } catch { return String(dateInput); }
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
    formatDate,
    smallGroups,
    staffVisits
  };
};
