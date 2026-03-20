import { useState, useCallback } from 'react';
import { StaffService } from '../../services/staff.service';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../contexts/ToastProvider';
import { toSafeDateISO } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';
import { User } from '../../types';

export const useStaff = (currentUser: User | null) => {
  const { showToast } = useToast();
  const { saveRecord } = useAppData();
  const [isSaving, setIsSaving] = useState(false);

  const saveVisit = useCallback(async (data: any) => {
    if (!currentUser) return false;

    if (isRecordLocked(data.date, currentUser.role)) {
      showToast("Período de edição para este mês está encerrado!", "warning");
      return false;
    }

    setIsSaving(true);
    const targetId = data.id || crypto.randomUUID();
    const now = Date.now();
    const safeDate = toSafeDateISO(data.date);

    const itemToSave = {
      ...data,
      id: targetId,
      date: safeDate,
      userId: data.userId || currentUser.id,
      createdAt: data.createdAt || now,
      updatedAt: now
    };

    const success = await saveRecord('staffVisits', itemToSave);
    setIsSaving(false);

    if (success) {
      showToast("Visita salva com sucesso!", "success");
      return true;
    } else {
      showToast("Erro ao salvar visita.", "error");
      return false;
    }
  }, [currentUser, showToast, saveRecord]);

  const deleteVisit = useCallback(async (id: string) => {
    const success = await deleteRecord('staffVisits', id);
    if (success) {
      showToast("Visita removida com sucesso.", "success");
    } else {
      showToast("Erro ao remover visita.", "error");
    }
    return success;
  }, [showToast, deleteRecord]);

  return { saveVisit, deleteVisit, isSaving };
};
