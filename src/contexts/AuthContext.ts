import { createContext, useContext } from 'react';
import { User } from '../types';

export interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateCurrentUser: (user: User) => void;
  loginError: string | null;
  isAuthLoading: boolean;
  // true só logo após um login digitado na tela (email+senha) -- não fica true quando a
  // sessão é restaurada sozinha ao abrir/recarregar a página. Usado pra mostrar a animação
  // de boas-vindas só no momento certo, não toda vez que o app carrega.
  justLoggedIn: boolean;
  clearJustLoggedIn: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
