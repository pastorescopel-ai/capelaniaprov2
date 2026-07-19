import { useState, useMemo, useEffect, useRef } from 'react';
import { User, VisitRequest, UserRole } from '../types';
import { useApp } from './useApp';
import { useToast } from '../contexts/ToastContext';
import { usePGInference } from './usePGInference';
import { normalizeString, ensureISODate, getTimestamp } from '../utils/formatters';

interface UseVisitRequestsWidgetProps {
  requests: VisitRequest[];
  currentUser: User;
  users: User[];
}

export const useVisitRequestsWidget = ({ requests, currentUser, users }: UseVisitRequestsWidgetProps) => {
  const { saveRecord, deleteRecord, proGroups, proSectors, proGroupLocations, proStaff, smallGroups, isInitialized } = useApp();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const syncingIdsRef = useRef<Set<string>>(new Set());
  const [selectedRequest, setSelectedRequest] = useState<VisitRequest | null>(null);
  const [actionType, setActionType] = useState<'assign' | 'delete' | null>(null);
  const [selectedChaplainId, setSelectedChaplainId] = useState('');
  
  // Lógica de Auto-Confirmação em Background
  // Se um PG já foi registrado no histórico para o mesmo dia e unidade, 
  // o agendamento deve ser marcado como confirmado automaticamente.
  useEffect(() => {
    if (!isInitialized || requests.length === 0 || smallGroups.length === 0) return;

    // const syncGhostRequests = async () => {
    //   const ghostRequests = requests.filter(req => {
    //     if (req.status !== 'assigned') return false;
    //     if (req.isRead) return false; // Skip if already read
    //     if (syncingIdsRef.current.has(req.id)) return false; // Lock check
        
    //     const reqDate = ensureISODate(req.date);
    //     const normName = normalizeString(req.pgName);
        
    //     return smallGroups.some(sg => 
    //       normalizeString(sg.groupName) === normName &&
    //       ensureISODate(sg.date) === reqDate &&
    //       sg.unit === req.unit
    //     );
    //   });

    //   if (ghostRequests.length > 0) {
    //     console.log(`[Auto-Sync] Sincronizando ${ghostRequests.length} agendamentos já realizados. IDs em processo:`, Array.from(syncingIdsRef.current));
    //     console.log(`[Auto-Sync] ghostRequests calculados:`, ghostRequests);
        
    //     for (const req of ghostRequests) {
    //       syncingIdsRef.current.add(req.id); // Track in-flight
          
    //       try {
    //         console.log(`[Auto-Sync] Tentando salvar request ID ${req.id}:`, req);
    //         await saveRecord('visitRequests', { ...req, isRead: true });
    //         console.log(`[Auto-Sync] Sucesso ao marcar como lido ID ${req.id}`);
    //       } catch (err) {
    //         console.error("Erro na auto-confirmação para", req.id, ":", err);
    //       } finally {
    //         syncingIdsRef.current.delete(req.id); // Clean up track
    //       }
    //     }
    //   }
    // };

    // // Pequeno delay para evitar concorrência com o salvamento imediato do form
    // const timer = setTimeout(syncGhostRequests, 2000);
    // return () => clearTimeout(timer);

  }, [requests, smallGroups, isInitialized, saveRecord]);

  const { inferPGDetails } = usePGInference(
    requests[0]?.unit || 'HAB',
    proGroups,
    proSectors,
    proGroupLocations,
    proStaff
  );

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // Agendamentos "assigned" que ficaram sem confirmação/registro por muito tempo
  // não devem poluir a escala para sempre.
  const OVERDUE_LIMIT_DAYS = 7;

  const myRequests = useMemo(() => {
    const res = (() => {
      // 1. Otimização: Criar um índice dos PGs registrados (O(M))
      const sgIndex = new Map<string, any[]>();
      smallGroups.forEach(sg => {
        const sgDate = ensureISODate(sg.date);
        if (!sgDate) return;
        const normName = normalizeString(sg.groupName);
        const key = `${sg.unit}_${sgDate}_${normName}`;
        if (!sgIndex.has(key)) sgIndex.set(key, []);
        sgIndex.get(key)!.push(sg);
      });

      return requests.filter(req => {
        if (req.status === 'confirmed' || req.status === 'declined') return false;

        const reqDate = ensureISODate(req.date);

        if (reqDate && reqDate < todayStr) {
          const daysOverdue = Math.floor((getTimestamp(todayStr) - getTimestamp(reqDate)) / 86400000);
          if (daysOverdue > OVERDUE_LIMIT_DAYS) return false;
        }

        const normName = normalizeString(req.pgName);
        let isAlreadyRegistered = false;
        
        if (reqDate && normName) {
          const key = `${req.unit}_${reqDate}_${normName}`;
          const matchingSGs = sgIndex.get(key);
          if (matchingSGs && matchingSGs.length > 0) {
            let reqShift = 'Manhã';
            if (req.scheduledTime) {
              const hour = parseInt(req.scheduledTime.split(':')[0]);
              if (hour >= 18) reqShift = 'Noite';
              else if (hour >= 12) reqShift = 'Tarde';
            }
            const normReqShift = normalizeString(reqShift);
            isAlreadyRegistered = matchingSGs.some(sg => {
              const shiftMatches = normalizeString(sg.shift) === normReqShift;
              const userMatches = !req.assignedChaplainId || String(sg.userId) === String(req.assignedChaplainId);
              return shiftMatches && userMatches;
            });
          }
        }

        if (isAlreadyRegistered) return false;

        const isUserAdmin = String(currentUser.role).toUpperCase() === 'ADMIN';
        if (isUserAdmin) return true;
        
        return req.assignedChaplainId && String(req.assignedChaplainId) === String(currentUser.id);
      }).sort((a, b) => {
        const aIsMine = a.assignedChaplainId && String(a.assignedChaplainId) === String(currentUser.id);
        const bIsMine = b.assignedChaplainId && String(b.assignedChaplainId) === String(currentUser.id);
        if (aIsMine && !bIsMine) return -1;
        if (!aIsMine && bIsMine) return 1;
        
        return getTimestamp(a.date) - getTimestamp(b.date);
      });
    })();
    return res;
  }, [requests, currentUser, smallGroups, todayStr]);

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
      const success = await saveRecord('visitRequests', updatedReq);
      if (!success) {
        showToast('Erro ao atualizar escala.', 'error');
        return;
      }
      showToast('Escala atualizada com sucesso.', 'success');
      setSelectedRequest(null);
      setActionType(null);
    } catch (e) {
      console.error("[useVisitRequestsWidget] Erro ao atualizar escala:", e);
      showToast('Erro ao atualizar escala.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    setIsProcessing(true);
    try {
      const success = await deleteRecord('visitRequests', id);
      if (!success) {
        showToast('Erro ao remover agendamento.', 'error');
        return;
      }
      showToast('Agendamento removido com sucesso.', 'success');
      setSelectedRequest(null);
      setActionType(null);
    } catch (e) {
      console.error("[useVisitRequestsWidget] Erro ao remover agendamento:", e);
      showToast('Erro ao remover agendamento.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateInput: string | Date) => {
    try {
      const datePart = typeof dateInput === 'string' ? dateInput.split('T')[0] : dateInput.toISOString().split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
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
    formatDate
  };
};
