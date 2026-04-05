import React, { lazy, Suspense } from 'react';
import { User, Unit } from '../../types';
import { useBibleModule } from './useBibleModule';

const BibleStudyForm = lazy(() => import('../../components/Forms/BibleStudyForm'));
const BibleClassForm = lazy(() => import('../../components/Forms/BibleClassForm'));

interface BibleModuleProps {
  type: 'study' | 'class';
  currentUser: User;
  users: any[];
  editingItem: any;
  isLoading: boolean;
  unit: Unit;
  history: any[];
  allHistory: any[];
  sectors?: string[];
  onCancelEdit: () => void;
  onEdit: (item: any) => void;
  setItemToDelete: (data: {type: string, id: string}) => void;
  handleTransfer: (item: any) => void;
}

const BibleModule: React.FC<BibleModuleProps> = ({
  type, currentUser, users, editingItem, isLoading, unit, history, allHistory, sectors,
  onCancelEdit, onEdit, setItemToDelete, handleTransfer
}) => {
  const { saveStudy, saveClass } = useBibleModule(currentUser);

  return (
    <Suspense fallback={<div className="p-8 animate-pulse bg-slate-100 rounded-3xl h-64" />}>
      {type === 'study' ? (
        <BibleStudyForm 
          currentUser={currentUser} 
          users={users} 
          editingItem={editingItem} 
          isLoading={isLoading} 
          onCancelEdit={onCancelEdit} 
          allHistory={allHistory} 
          unit={unit} 
          history={history} 
          onDelete={id => setItemToDelete({type: 'study', id})} 
          onEdit={onEdit} 
          onSubmit={saveStudy} 
          onTransfer={handleTransfer} 
        />
      ) : (
        <BibleClassForm 
          currentUser={currentUser} 
          users={users} 
          editingItem={editingItem} 
          isLoading={isLoading} 
          onCancelEdit={onCancelEdit} 
          allHistory={allHistory} 
          unit={unit} 
          sectors={sectors || []} 
          history={history} 
          onDelete={id => setItemToDelete({type: 'class', id})} 
          onEdit={onEdit} 
          onSubmit={saveClass} 
          onTransfer={handleTransfer} 
        />
      )}
    </Suspense>
  );
};

export default BibleModule;
