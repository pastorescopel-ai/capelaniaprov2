import { useToast } from '../contexts/ToastProvider';
import { BibleStudy, BibleClass, User } from '../types';

interface UseAppOperationsProps {
  bibleStudies: BibleStudy[];
  bibleClasses: BibleClass[];
  users: User[];
  saveRecord: (collection: string, item: any) => Promise<boolean>;
  activeTab: string;
}

export const useAppOperations = ({ bibleStudies, bibleClasses, users, saveRecord, activeTab }: UseAppOperationsProps) => {
  const { showToast } = useToast();

  const handleTransfer = async (type: string, id: string, newUserId: string) => {
    let collectionName = '';
    let itemToUpdate: any = null;

    if (type === 'study') {
      collectionName = 'bibleStudies';
      itemToUpdate = bibleStudies.find(i => i.id === id);
    } else if (type === 'class') {
      collectionName = 'bibleClasses';
      itemToUpdate = bibleClasses.find(i => i.id === id);
    }

    if (collectionName && itemToUpdate) {
      const updatedItem = { ...itemToUpdate, userId: newUserId, updatedAt: Date.now() };
      const success = await saveRecord(collectionName, updatedItem);
      
      const targetUser = users.find(u => u.id === newUserId)?.name || "Outro Capelão";
      
      if (success) {
        showToast(`Registro transferido para ${targetUser}`, "success");
      } else {
        showToast("Erro ao transferir registro.", "warning");
      }
    }
  };

  const getTabClass = (id: string) => 
    `transition-opacity duration-300 ${activeTab === id ? 'block opacity-100' : 'hidden opacity-0'}`;

  return {
    handleTransfer,
    getTabClass
  };
};
