import { useState } from 'react';
import { User } from '../../types';
import { useApp } from '../../hooks/useApp';
import { DataRepository } from '../../services/dataRepository';

export const useBibleModule = (currentUser: User) => {
  const { saveRecord } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveStudy = async (study: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const success = await saveRecord('bibleStudies', {
        ...study,
        createdAt: study.createdAt || now,
        updatedAt: now
      });
      if (!success) {
        const detail = DataRepository.getLastError();
        const message = detail?.message || 'Erro ao salvar estudo bíblico';
        setError(message);
        return { success, error: { message } };
      }
      return { success };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return { success: false, error: err };
    } finally {
      setIsSaving(false);
    }
  };

  const saveClass = async (bibleClass: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const success = await saveRecord('bibleClasses', {
        ...bibleClass,
        createdAt: bibleClass.createdAt || now,
        updatedAt: now
      });
      if (!success) {
        const detail = DataRepository.getLastError();
        const message = detail?.message || 'Erro ao salvar classe bíblica';
        setError(message);
        return { success, error: { message } };
      }
      return { success };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return { success: false, error: err };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    saveStudy,
    saveClass,
    isSaving,
    error,
    currentUser
  };
};
