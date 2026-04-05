import React, { lazy, Suspense } from 'react';
import { User, Unit } from '../../../types';
import { useStaff } from './useStaffHook';

const StaffVisitForm = lazy(() => import('../../../components/AppForms/StaffVisitForm'));

interface StaffModuleProps {
  currentUser: User;
  users: any[];
  editingItem: any;
  isLoading: boolean;
  unit: Unit;
  history: any[];
  allHistory: any[];
  onCancelEdit: () => void;
  onEdit: (item: any) => void;
  setItemToDelete: (data: {type: string, id: string}) => void;
  saveRecord: (collection: string, item: any) => Promise<boolean>;
}

const StaffModule: React.FC<StaffModuleProps> = ({
  currentUser, users, editingItem, isLoading, unit, history, allHistory,
  onCancelEdit, onEdit, setItemToDelete, saveRecord
}) => {
  const { saveVisit, deleteVisit } = useStaff(currentUser);

  return (
    <Suspense fallback={<div className="p-8 animate-pulse bg-slate-100 rounded-3xl h-64" />}>
      <StaffVisitForm 
        currentUser={currentUser} 
        users={users} 
        onToggleReturn={async id => { 
          const item = allHistory.find(v => v.id === id); 
          if(item) await saveRecord('staffVisits', {...item, returnCompleted: !item.returnCompleted}); 
        }} 
        editingItem={editingItem} 
        isLoading={isLoading} 
        onCancelEdit={onCancelEdit} 
        unit={unit} 
        history={history} 
        allHistory={allHistory} 
        onDelete={id => setItemToDelete({type: 'visit', id})} 
        onEdit={onEdit} 
        onSubmit={saveVisit} 
      />
    </Suspense>
  );
};

export default StaffModule;
