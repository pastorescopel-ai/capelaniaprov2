
import React, { createContext, useContext, useState } from 'react';
import { User } from '../types';
import { useApp } from './AppContext';
import { hashPassword } from '../utils/crypto';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateCurrentUser: (user: User) => void;
  loginError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { users, saveRecord } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoginError(null);
    
    if (!email || !pass) {
      setLoginError('Preencha todos os campos.');
      return false;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = pass.trim();
    
    // Busca o usuário exclusivamente pelo e-mail (Âncora de Identidade)
    // Isso garante que funcione independente do ID ser antigo ou novo
    const dbUser = users.find(u => u.email && u.email.toLowerCase().trim() === cleanEmail);
    
    if (!dbUser) {
      setLoginError('Usuário não localizado.');
      return false;
    }

    const inputHash = await hashPassword(cleanPass);
    const storedPass = String(dbUser.password || "").trim();

    // Comparação padrão por Hash (Segurança Máxima)
    const isHashMatch = (inputHash !== "" && inputHash === storedPass);
    
    // Regra de Ouro/Recuperação para o administrador (Não depende do UUID)
    const isMasterBypass = (cleanEmail === "pastorescopel@gmail.com" && cleanPass === "CaE27785055");

    if (isHashMatch || isMasterBypass) {
      // Sincronização de Senha: Se entrou pelo bypass mas o hash não batia, atualiza o hash no banco para o novo padrão
      if (isMasterBypass && !isHashMatch) {
        try {
          await saveRecord('users', { ...dbUser, password: inputHash });
        } catch (e) {
          console.warn("Falha ao sincronizar hash de recuperação.");
        }
      }

      setCurrentUser(dbUser);
      setIsAuthenticated(true);
      return true;
    } else {
      setLoginError('Senha incorreta.');
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setLoginError(null);
  };

  const updateCurrentUser = (user: User) => setCurrentUser(user);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, login, logout, updateCurrentUser, loginError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
