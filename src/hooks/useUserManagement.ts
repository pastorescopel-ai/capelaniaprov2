import { useState, useMemo } from 'react';
import { User, UserRole } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../hooks/useApp';
import { AutocompleteOption } from '../components/Shared/Autocomplete';
import { supabase } from '../services/supabaseClient';

interface UseUserManagementProps {
  users: User[];
  onUpdateUsers: (newUsers: User[]) => Promise<void>;
}

export const useUserManagement = ({ users, onUpdateUsers }: UseUserManagementProps) => {
  const { deleteRecord, proStaff, proSectors, refreshData } = useApp();
  const [newUser, setNewUser] = useState<Partial<User>>({ name: '', email: '', password: '', role: UserRole.CHAPLAIN, attendsHaba: false, habaDays: [], dailyVisitGoal: 2, subunitMonthlyVisitGoal: 8, visitGoalPeriod: 'daily' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newPasswordForEdit, setNewPasswordForEdit] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showToast } = useToast();

  // Mapeia colaboradores do banco PRO para opções de Autocomplete
  const staffOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    proStaff.forEach(staff => {
      const validSectorId = getValidSectorId(staff.sectorId, staff.unit, proSectors);
      const sector = validSectorId ? proSectors.find(sec => sec.id === validSectorId) : null;
      const staffIdStr = String(staff.id);
      options.push({
        value: staff.name,
        label: `${staff.name} (${staffIdStr.split('-')[1] || staffIdStr})`,
        subLabel: sector ? sector.name : 'Setor não informado',
        category: 'RH'
      });
    });
    return options;
  }, [proStaff, proSectors]);

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      showToast('Preencha os dados do usuário', 'warning');
      return;
    }
    if (newUser.password.trim().length < 6) {
      showToast('A senha inicial precisa ter pelo menos 6 caracteres.', 'warning');
      return;
    }
    if (!supabase) {
      showToast('Supabase não configurado.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      // Cria o usuário direto com uma conta real no Supabase Auth (senha com bcrypt),
      // em vez de gravar um hash fraco calculado no navegador.
      const { error } = await supabase.rpc('admin_create_user', {
        p_email: (newUser.email || '').toLowerCase().trim(),
        p_password: newUser.password.trim(),
        p_name: newUser.name || '',
        p_role: newUser.role || UserRole.CHAPLAIN,
      });
      if (error) throw error;

      await refreshData();
      setNewUser({ name: '', email: '', password: '', role: UserRole.CHAPLAIN, attendsHaba: false, habaDays: [], dailyVisitGoal: 2, subunitMonthlyVisitGoal: 8, visitGoalPeriod: 'daily' });
      showToast('Usuário cadastrado com sucesso!', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao cadastrar usuário.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleHabaDay = (day: number, isEditing: boolean) => {
    if (isEditing && editingUser) {
      const currentDays = editingUser.habaDays || [];
      const newDays = currentDays.includes(day) 
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      setEditingUser({ ...editingUser, habaDays: newDays });
    } else {
      const currentDays = newUser.habaDays || [];
      const newDays = currentDays.includes(day) 
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      setNewUser({ ...newUser, habaDays: newDays });
    }
  };

  const dayOptions = [
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' }
  ];

  const handleSelectStaff = (label: string) => {
    // Extrai o nome antes do parêntese da matrícula
    const nameOnly = label.split(' (')[0].trim();
    setNewUser(prev => ({ ...prev, name: nameOnly }));
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    const trimmedNewPassword = newPasswordForEdit.trim();
    if (trimmedNewPassword && trimmedNewPassword.length < 6) {
      showToast('A nova senha precisa ter pelo menos 6 caracteres.', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const updatedUsers = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...editingUser,
            email: editingUser.email.toLowerCase().trim(),
          };
        }
        return u;
      });

      await onUpdateUsers(updatedUsers);

      // Redefine a senha real no Supabase Auth (bcrypt) só se o admin digitou uma nova.
      if (trimmedNewPassword && supabase) {
        const { error } = await supabase.rpc('admin_reset_password', {
          p_user_id: editingUser.id,
          p_new_password: trimmedNewPassword,
        });
        if (error) throw error;
      }

      setNewPasswordForEdit('');
      setEditingUser(null);
      showToast('Dados do usuário atualizados!', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao atualizar usuário.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    setIsProcessing(true);
    try {
      const success = await deleteRecord('users', userToDelete.id);
      if (success) {
        showToast('Usuário removido com sucesso!', 'success');
      } else {
        showToast('Falha ao excluir registro no banco.', 'error');
      }
      setUserToDelete(null);
    } catch (e) {
      showToast('Erro técnico ao processar remoção.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    newUser, setNewUser,
    editingUser, setEditingUser,
    newPasswordForEdit, setNewPasswordForEdit,
    userToDelete, setUserToDelete,
    isProcessing,
    staffOptions,
    dayOptions,
    handleAddUser,
    toggleHabaDay,
    handleSelectStaff,
    handleSaveEdit,
    confirmDelete
  };
};
