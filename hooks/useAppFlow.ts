
import { useState, useCallback, useEffect } from 'react';
import { Unit, User, UserRole, RecordStatus } from '../types';
import { useToast } from '../contexts/ToastContext';
import { isRecordLocked } from '../utils/validators';

interface UseAppFlowProps {
  currentUser: User | null;
  saveRecord: (collection: string, item: any) => Promise<boolean>;
  deleteRecord: (collection: string, id: string) => Promise<boolean>;
}

export const useAppFlow = ({ currentUser, saveRecord, deleteRecord }: UseAppFlowProps) => {
  const { showToast } = useToast();

  // Estados de Interface
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{type: string, id: string} | null>(null);

  // CORREÇÃO: Reseta para o Dashboard sempre que o usuário deslogar.
  useEffect(() => {
    if (!currentUser) {
      setActiveTab('dashboard');
      setEditingItem(null);
      setItemToDelete(null);
    }
  }, [currentUser]);

  // Lógica de Salvamento Centralizada
  const handleSaveItem = async (type: string, data: any) => {
    if (!currentUser) return;

    // VALIDAÇÃO DE TRAVA MENSAL
    if (isRecordLocked(data.date, currentUser.role)) {
      showToast("Período de edição para este mês está encerrado!", "warning");
      return;
    }

    const targetId = data.id || editingItem?.id || crypto.randomUUID();
    const now = Date.now();
    
    // Constrói o objeto completo do item
    const itemToSave = {
      ...data,
      id: targetId,
      userId: data.userId || currentUser.id,
      createdAt: data.createdAt || now,
      updatedAt: now
    };

    let collectionName = '';
    if (type === 'study') collectionName = 'bibleStudies';
    if (type === 'class') collectionName = 'bibleClasses';
    if (type === 'visit') collectionName = 'staffVisits';
    if (type === 'pg') collectionName = 'smallGroups';

    if (collectionName) {
      await saveRecord(collectionName, itemToSave);
      setEditingItem(null);
      showToast("Registro salvo com sucesso!", "success");
    }
  };

  // Lógica de Deleção Centralizada
  const confirmDeletion = async () => {
    if (!itemToDelete) return;
    
    let collectionName = '';
    if (itemToDelete.type === 'study') collectionName = 'bibleStudies';
    if (itemToDelete.type === 'class') collectionName = 'bibleClasses';
    if (itemToDelete.type === 'pg') collectionName = 'smallGroups';
    if (itemToDelete.type === 'visit') collectionName = 'staffVisits';
    
    if (collectionName) {
      await deleteRecord(collectionName, itemToDelete.id);
      showToast("Registro removido.", "success");
      setItemToDelete(null);
    }
  };

  // Lógica de Filtragem de Histórico (Regra de Negócio Visual)
  const getVisibleHistory = useCallback((list: any[]) => {
    if (!currentUser) return [];
    const matchUnit = (item: any) => (item.unit || Unit.HAB) === currentUnit;
    
    return currentUser.role === UserRole.ADMIN 
      ? list.filter(matchUnit) 
      : list.filter(item => item && matchUnit(item) && item.userId === currentUser.id);
  }, [currentUser, currentUnit]);

  return {
    activeTab,
    setActiveTab,
    currentUnit,
    setCurrentUnit,
    editingItem,
    setEditingItem,
    itemToDelete,
    setItemToDelete,
    handleSaveItem,
    confirmDeletion,
    getVisibleHistory
  };
};
