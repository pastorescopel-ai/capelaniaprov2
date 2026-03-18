import { useState, useCallback } from 'react';
import { StaffService } from '../../../services/staff.service';
import { useToast } from '../../../contexts/ToastProvider';
import { toSafeDateISO } from '../../../utils/formatters';
import { isRecordLocked } from '../../../utils/validators';
import { User } from '../../../types';

export const useStaff = (currentUser: User | null) => {
  const { showToast } = useToast();
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

    const result = await StaffService.saveVisit(itemToSave);
    setIsSaving(false);

    if (result.success) {
      showToast("Visita salva com sucesso!", "success");
      return true;
    } else {
      showToast("Erro ao salvar visita.", "error");
      return false;
    }
  }, [currentUser, showToast]);

  const deleteVisit = useCallback(async (id: string) => {
    const success = await StaffService.deleteVisit(id);
    if (success) {
      showToast("Visita removida com sucesso.", "success");
    } else {
      showToast("Erro ao remover visita.", "error");
    }
    return success;
  }, [showToast]);

  return { saveVisit, deleteVisit, isSaving };
};
