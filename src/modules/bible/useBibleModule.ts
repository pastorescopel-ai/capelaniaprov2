import { useState } from 'react';
import { User } from '../../types';
import { useApp } from '../../hooks/useApp';

export const useBibleModule = (currentUser: User) => {
  const { saveRecord } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveStudy = async (study: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const success = await saveRecord('bibleStudies', study);
      if (!success) {
        setError('Erro ao salvar estudo bíblico');
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
      const success = await saveRecord('bibleClasses', bibleClass);
      if (!success) {
        setError('Erro ao salvar classe bíblica');
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
