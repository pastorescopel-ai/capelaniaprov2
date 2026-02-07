
import { useState, useCallback, useEffect } from 'react';
import { Unit, User, UserRole, RecordStatus } from '../types';
import { useToast } from '../contexts/ToastContext';
import { isRecordLocked } from '../utils/validators';
import { toSafeDateISO } from '../utils/formatters';

interface UseAppFlowProps {
  currentUser: User | null;
  saveRecord: (collection: string, item: any) => Promise<boolean>;
  deleteRecord: (collection: string, id: string) => Promise<boolean>;
}

export const useAppFlow = ({ currentUser, saveRecord, deleteRecord }: UseAppFlowProps) => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{type: string, id: string} | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setActiveTab('dashboard');
      setEditingItem(null);
      setItemToDelete(null);
    }
  }, [currentUser]);

  const handleSaveItem = async (type: string, data: any) => {
    if (!currentUser) return;

    if (isRecordLocked(data.date, currentUser.role)) {
      showToast("Período de edição para este mês está encerrado!", "warning");
      return;
    }

    const targetId = data.id || editingItem?.id || crypto.randomUUID();
    const now = Date.now();
    
    // NUCLEO_LOGICO: Normalização da data antes do envio ao banco
    const safeDate = toSafeDateISO(data.date);

    const itemToSave = {
      ...data,
      id: targetId,
      date: safeDate,
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

  const getVisibleHistory = useCallback((list: any[]) => {
    if (!currentUser) return [];
    const matchUnit = (item: any) => (item.unit || Unit.HAB) === currentUnit;
    
    return currentUser.role === UserRole.ADMIN 
      ? list.filter(matchUnit) 
      : list.filter(item => item && matchUnit(item) && item.userId === currentUser.id);
  }, [currentUser, currentUnit]);

  return {
    activeTab, setActiveTab, currentUnit, setCurrentUnit, editingItem, setEditingItem, itemToDelete, setItemToDelete, handleSaveItem, confirmDeletion, getVisibleHistory
  };
};
