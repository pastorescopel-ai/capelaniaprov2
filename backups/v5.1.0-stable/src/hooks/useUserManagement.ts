import { useState, useMemo } from 'react';
import { User, UserRole } from '../types';
import { useToast } from '../contexts/ToastContext';
import { hashPassword } from '../utils/crypto';
import { useApp } from '../hooks/useApp';
import { AutocompleteOption } from '../components/Shared/Autocomplete';

interface UseUserManagementProps {
  users: User[];
  onUpdateUsers: (newUsers: User[]) => Promise<void>;
}

export const useUserManagement = ({ users, onUpdateUsers }: UseUserManagementProps) => {
  const { deleteRecord, proStaff, proSectors } = useApp();
  const [newUser, setNewUser] = useState<Partial<User>>({ name: '', email: '', password: '', role: UserRole.CHAPLAIN, attendsHaba: false, habaDays: [] });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showToast } = useToast();

  // Mapeia colaboradores do banco PRO para opções de Autocomplete
  const staffOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    proStaff.forEach(staff => {
      const sector = proSectors.find(sec => sec.id === staff.sectorId);
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
    
    setIsProcessing(true);
    try {
      const securePassword = await hashPassword(newUser.password.trim());
      
      const userToAdd: User = {
        id: crypto.randomUUID(),
        name: newUser.name || '',
        email: (newUser.email || '').toLowerCase().trim(),
        password: securePassword,
        role: newUser.role || UserRole.CHAPLAIN,
        profilePic: '',
        attendsHaba: newUser.attendsHaba || false,
        habaDays: newUser.habaDays || []
      };

      await onUpdateUsers([...users, userToAdd]);
      setNewUser({ name: '', email: '', password: '', role: UserRole.CHAPLAIN, attendsHaba: false, habaDays: [] });
      showToast('Usuário cadastrado com sucesso!', 'success');
    } catch (e) {
      showToast('Erro ao cadastrar usuário.', 'error');
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
    
    setIsProcessing(true);
    try {
      let finalPassword = editingUser.password;
      
      if (editingUser.password && editingUser.password.length !== 64) {
        finalPassword = await hashPassword(editingUser.password.trim());
      }

      const updatedUsers = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...editingUser,
            email: editingUser.email.toLowerCase().trim(),
            password: finalPassword
          };
        }
        return u;
      });

      await onUpdateUsers(updatedUsers);
      setEditingUser(null);
      showToast('Dados do usuário atualizados!', 'success');
    } catch (e) {
      showToast('Erro ao atualizar usuário.', 'error');
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
