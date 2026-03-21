import { useState, useCallback } from 'react';
import { useApp } from '../../contexts/AppProvider';
import { useToast } from '../../contexts/ToastProvider';
import { toSafeDateISO } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';
import { User } from '../../types';

export const usePG = (currentUser: User | null) => {
  const { showToast } = useToast();
  const { saveRecord, deleteRecord } = useApp();
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

    const success = await saveRecord('smallGroups', itemToSave);
    setIsSaving(false);

    if (success) {
      showToast("PG salvo com sucesso!", "success");
      return true;
    } else {
      showToast("Erro ao salvar PG.", "error");
      return false;
    }
  }, [currentUser, showToast, saveRecord]);

  const deleteSmallGroup = useCallback(async (id: string) => {
    const success = await deleteRecord('smallGroups', id);
    if (success) {
      showToast("PG removido com sucesso.", "success");
    } else {
      showToast("Erro ao remover PG.", "error");
    }
    return success;
  }, [showToast, deleteRecord]);

  return { saveSmallGroup, deleteSmallGroup, isSaving };
};
