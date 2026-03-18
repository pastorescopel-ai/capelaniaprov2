import React, { lazy, Suspense } from 'react';
import { User } from '../../types';
import { useCore } from './useCore';

const Profile = lazy(() => import('../../components/Profile'));
const UserManagement = lazy(() => import('../../components/UserManagement'));
const AdminPanel = lazy(() => import('../../components/AdminPanel'));
const DataHealer = lazy(() => import('../../components/DataHealer'));

interface CoreModuleProps {
  type: 'profile' | 'users' | 'admin' | 'dataHealing';
  currentUser: User;
  users: any[];
  isLoading: boolean;
  onUpdateUser?: (user: User) => void;
  onUpdateUsers?: (users: any[]) => void;
}

const CoreModule: React.FC<CoreModuleProps> = ({
  type, currentUser, users, isLoading, onUpdateUser, onUpdateUsers
}) => {
  const { saveUser } = useCore(currentUser);

  return (
    <Suspense fallback={<div className="p-8 animate-pulse bg-slate-100 rounded-3xl h-64" />}>
      {type === 'profile' && (
        <Profile 
          user={currentUser} 
          isSyncing={isLoading} 
          onUpdateUser={u => {
            if (onUpdateUser) onUpdateUser(u);
            saveUser(u);
          }} 
        />
      )}
      {type === 'users' && (
        <UserManagement 
          users={users} 
          currentUser={currentUser} 
          onUpdateUsers={onUpdateUsers || (() => {})} 
        />
      )}
      {type === 'admin' && <AdminPanel />}
      {type === 'dataHealing' && <DataHealer />}
    </Suspense>
  );
};

export default CoreModule;
