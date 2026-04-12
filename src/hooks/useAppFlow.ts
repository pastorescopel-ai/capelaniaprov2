
import { useState, useCallback, useEffect, useTransition } from 'react';
import { Unit, User, UserRole, RecordStatus, EditAuthorization } from '../types';
import { useToast } from '../contexts/ToastContext';
import { isRecordLocked } from '../utils/validators';
import { toSafeDateISO } from '../utils/formatters';

interface UseAppFlowProps {
  currentUser: User | null;
  saveRecord: (collection: string, item: any) => Promise<boolean>;
  deleteRecord: (collection: string, id: string) => Promise<boolean>;
  editAuthorizations?: EditAuthorization[];
}

export const useAppFlow = ({ currentUser, saveRecord, deleteRecord, editAuthorizations = [] }: UseAppFlowProps) => {
  const { showToast } = useToast();

  const [activeTab, setActiveTabState] = useState('dashboard');
  const [isPending, startTransition] = useTransition();
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{type: string, id: string} | null>(null);

  // Navegação Inteligente: Prioriza a fluidez da UI
  const setActiveTab = useCallback((tab: string) => {
    startTransition(() => {
      setActiveTabState(tab);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      startTransition(() => {
        setActiveTabState('dashboard');
        setEditingItem(null);
        setItemToDelete(null);
      });
    }
  }, [currentUser]);

  const handleSaveItem = async (type: string, data: any) => {
    if (!currentUser) return;

    // Mapeia o tipo do formulário para o nome da coleção/aba para o validador de trava
    const tabMap: Record<string, string> = {
      'study': 'bibleStudies',
      'class': 'bibleClasses',
      'smallGroup': 'smallGroups',
      'visit': 'staffVisits',
      'bibleStudy': 'bibleStudies',
      'bibleClass': 'bibleClasses',
      'staffVisit': 'staffVisits'
    };

    const tabName = tabMap[type] || type;

    if (isRecordLocked(data.date, currentUser.role, tabName, editAuthorizations)) {
      showToast("Período de edição para este mês está encerrado!", "warning");
      return;
    }

    const targetId = data.id || crypto.randomUUID();
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
      const success = await saveRecord(collectionName, itemToSave);
      if (success) {
        setEditingItem(null);
        showToast("Registro salvo com sucesso!", "success");
      } else {
        showToast("Erro ao salvar registro no banco de dados.", "error");
      }
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
      const success = await deleteRecord(collectionName, itemToDelete.id);
      if (success) {
        showToast("Registro removido com sucesso.", "success");
      } else {
        showToast("Erro ao remover registro.", "error");
      }
      setItemToDelete(null);
    }
  };

  const getVisibleHistory = useCallback((list: any[] = []) => {
    if (!currentUser) return [];
    if (!Array.isArray(list)) return [];
    
    const matchUnit = (item: any) => (item.unit || Unit.HAB) === currentUnit;
    
    return currentUser.role === UserRole.ADMIN 
      ? list.filter(item => item && matchUnit(item)) 
      : list.filter(item => item && matchUnit(item) && (item.userId === currentUser.id || !item.userId));
  }, [currentUser, currentUnit]);

  return {
    activeTab, 
    isPending,
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
