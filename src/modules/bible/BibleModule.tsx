import React, { lazy, Suspense } from 'react';
import { User, Unit } from '../../types';
import { useBibleModule } from './useBibleModule';

const BibleStudyForm = lazy(() => import('../../components/Forms/BibleStudyForm'));

interface BibleModuleProps {
  currentUser: User;
  users: any[];
  editingItem: any;
  isLoading: boolean;
  unit: Unit;
  studyHistory: any[];
  allStudyHistory: any[];
  classHistory: any[];
  allClassHistory: any[];
  onCancelEdit: () => void;
  onEdit: (item: any) => void;
  setItemToDelete: (data: {type: string, id: string}) => void;
  handleTransfer: (item: any) => void;
  isActive?: boolean;
}

const BibleModule: React.FC<BibleModuleProps> = ({
  currentUser, users, editingItem, isLoading, unit, studyHistory, allStudyHistory, classHistory, allClassHistory,
  onCancelEdit, onEdit, setItemToDelete, handleTransfer, isActive
}) => {
  const { saveStudy, saveClass } = useBibleModule(currentUser);

  return (
    <Suspense fallback={<div className="p-8 animate-pulse bg-slate-100 rounded-3xl h-64" />}>
      <BibleStudyForm
        currentUser={currentUser}
        users={users}
        editingItem={editingItem}
        isLoading={isLoading}
        onCancelEdit={onCancelEdit}
        unit={unit}
        studyHistory={studyHistory}
        allStudyHistory={allStudyHistory}
        classHistory={classHistory}
        allClassHistory={allClassHistory}
        onDeleteStudy={id => setItemToDelete({type: 'study', id})}
        onDeleteClass={id => setItemToDelete({type: 'class', id})}
        onEdit={onEdit}
        onSubmitStudy={saveStudy}
        onSubmitClass={saveClass}
        onTransfer={handleTransfer}
        isActive={isActive}
      />
    </Suspense>
  );
};

export default BibleModule;
