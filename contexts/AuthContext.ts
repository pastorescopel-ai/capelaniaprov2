import { createContext } from 'react';
import { User } from '../types';

export interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateCurrentUser: (user: User) => void;
  loginError: string | null;
  isAuthLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
