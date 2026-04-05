import React, { lazy, Suspense } from 'react';
import { User, Unit } from '../../types';
import { usePG } from './usePG';

const SmallGroupForm = lazy(() => import('../../components/Forms/SmallGroupForm'));

interface PGModuleProps {
  currentUser: User;
  users: any[];
  editingItem: any;
  isLoading: boolean;
  unit: Unit;
  history: any[];
  onCancelEdit: () => void;
  onEdit: (item: any) => void;
  setItemToDelete: (data: {type: string, id: string}) => void;
}

const PGModule: React.FC<PGModuleProps> = ({
  currentUser, users, editingItem, isLoading, unit, history,
  onCancelEdit, onEdit, setItemToDelete
}) => {
  const { saveSmallGroup } = usePG(currentUser);

  return (
    <Suspense fallback={<div className="p-8 animate-pulse bg-slate-100 rounded-3xl h-64" />}>
      <SmallGroupForm 
        currentUser={currentUser} 
        users={users} 
        editingItem={editingItem} 
        isLoading={isLoading} 
        onCancelEdit={onCancelEdit} 
        unit={unit} 
        history={history} 
        onDelete={id => setItemToDelete({type: 'pg', id})} 
        onEdit={onEdit} 
        onSubmit={saveSmallGroup} 
      />
    </Suspense>
  );
};

export default PGModule;
