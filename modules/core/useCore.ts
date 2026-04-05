import { useCallback } from 'react';
import { User } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { CoreService } from '../../services/core.service';

export function useCore(currentUser: User) {
  const { showToast } = useToast();

  const saveUser = useCallback(async (data: any) => {
    const result = await CoreService.saveUser(data);
    if (result.success) {
      showToast('Usuário salvo com sucesso!', 'success');
      return result.data;
    } else {
      console.error('Error saving user:', result.error);
      showToast('Erro ao salvar usuário.', 'error');
      return null;
    }
  }, [showToast]);

  const saveConfig = useCallback(async (data: any) => {
    const result = await CoreService.saveAppConfig(data);
    if (result.success) {
      showToast('Configurações salvas com sucesso!', 'success');
      return result.data;
    } else {
      console.error('Error saving config:', result.error);
      showToast('Erro ao salvar configurações.', 'error');
      return null;
    }
  }, [showToast]);

  return {
    saveUser,
    saveConfig
  };
}
