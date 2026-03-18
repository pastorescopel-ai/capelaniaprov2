import { useCallback } from 'react';
import { User } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
import { CoreService } from '../../services/core.service';

export function useCore(currentUser: User) {
  const { showToast } = useToast();

  const saveUser = useCallback(async (data: any) => {
    try {
      const result = await CoreService.saveUser(data);
      showToast('Usuário salvo com sucesso!', 'success');
      return result;
    } catch (error) {
      console.error('Error saving user:', error);
      showToast('Erro ao salvar usuário.', 'error');
      throw error;
    }
  }, [showToast]);

  const saveConfig = useCallback(async (data: any) => {
    try {
      const result = await CoreService.saveAppConfig(data);
      showToast('Configurações salvas com sucesso!', 'success');
      return result;
    } catch (error) {
      console.error('Error saving config:', error);
      showToast('Erro ao salvar configurações.', 'error');
      throw error;
    }
  }, [showToast]);

  return {
    saveUser,
    saveConfig
  };
}
