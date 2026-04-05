import { useState, useCallback } from 'react';
import { PGService } from '../../../services/pg.service';
import { useToast } from '../../../contexts/ToastContext';
import { toSafeDateISO } from '../../../utils/formatters';
import { isRecordLocked } from '../../../utils/validators';
import { User } from '../../../types';

export const usePG = (currentUser: User | null) => {
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const saveSmallGroup = useCallback(async (data: any) => {
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

    const result = await PGService.saveSmallGroup(itemToSave);
    setIsSaving(false);

    if (result.success) {
      showToast("PG salvo com sucesso!", "success");
      return true;
    } else {
      showToast("Erro ao salvar PG.", "error");
      return false;
    }
  }, [currentUser, showToast]);

  const deleteSmallGroup = useCallback(async (id: string) => {
    const success = await PGService.deleteSmallGroup(id);
    if (success) {
      showToast("PG removido com sucesso.", "success");
    } else {
      showToast("Erro ao remover PG.", "error");
    }
    return success;
  }, [showToast]);

  return { saveSmallGroup, deleteSmallGroup, isSaving };
};
