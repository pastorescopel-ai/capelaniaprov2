import { useState, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { toSafeDateISO } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';
import { User } from '../../types';

export const useBibleModule = (currentUser: User | null) => {
  const { showToast } = useToast();
  const { saveRecord } = useApp();
  const [isSaving, setIsSaving] = useState(false);

  const saveStudy = useCallback(async (data: any) => {
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

    const success = await saveRecord('bibleStudies', itemToSave);
    setIsSaving(false);

    if (success) {
      showToast("Estudo salvo com sucesso!", "success");
      return true;
    } else {
      showToast("Erro ao salvar estudo.", "error");
      return false;
    }
  }, [currentUser, showToast, saveRecord]);

  const saveClass = useCallback(async (data: any) => {
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

    const success = await saveRecord('bibleClasses', itemToSave);
    setIsSaving(false);

    if (success) {
      showToast("Classe salva com sucesso!", "success");
      return true;
    } else {
      showToast("Erro ao salvar classe.", "error");
      return false;
    }
  }, [currentUser, showToast, saveRecord]);

  return { saveStudy, saveClass, isSaving };
};
