import { createContext, useContext } from 'react';
import { User } from '../types';

export interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  // captchaToken: repassado direto pro Supabase Auth (options.captchaToken), que tem proteção
  // de CAPTCHA própria habilitada no projeto -- ver AuthProvider.tsx.
  login: (email: string, pass: string, captchaToken?: string | null) => Promise<boolean>;
  logout: () => void;
  updateCurrentUser: (user: User) => void;
  loginError: string | null;
  isAuthLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
