import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { useApp } from '../hooks/useApp';
import { hashPassword } from '../utils/crypto';
import { DataRepository } from '../services/dataRepository';
import { supabase } from '../services/supabaseClient';

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
  const { saveRecord } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        DataRepository.getUserByEmail(session.user.email).then(dbUser => {
          if (dbUser) {
            setCurrentUser(dbUser);
            setIsAuthenticated(true);
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        DataRepository.getUserByEmail(session.user.email).then(dbUser => {
          if (dbUser) {
            setCurrentUser(dbUser);
            setIsAuthenticated(true);
          }
        });
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoginError(null);
    
    if (!email || !pass) {
      setLoginError('Preencha todos os campos.');
      return false;
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = pass.trim();

    if (!supabase) {
      setLoginError('Supabase não configurado. App em modo restrito.');
      return false;
    }

    // 1. Tenta login nativo no Supabase Auth (Caminho Feliz)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass
    });

    if (authData?.user) {
      // Sucesso no Supabase! Busca o perfil no banco.
      const dbUser = await DataRepository.getUserByEmail(cleanEmail);
      if (dbUser) {
        // Garante que o auth_id está sincronizado
        if (dbUser.auth_id !== authData.user.id) {
          await saveRecord('users', { ...dbUser, auth_id: authData.user.id });
        }
        setCurrentUser(dbUser);
        setIsAuthenticated(true);
        return true;
      }
    }

    // 2. Fallback: Migração Invisível (Lazy Migration)
    // Se o login nativo falhou, vamos tentar o login legado e migrar o usuário.
    const dbUser = await DataRepository.getUserByEmail(cleanEmail);
    
    if (!dbUser) {
      setLoginError('Usuário não localizado.');
      return false;
    }

    const inputHash = await hashPassword(cleanPass);
    const storedPass = String(dbUser.password || "").trim();

    // Comparação padrão por Hash (Segurança Máxima Legada)
    const isHashMatch = (inputHash !== "" && inputHash === storedPass);
    
    // Regra de Ouro/Recuperação para o administrador
    const isMasterBypass = (cleanEmail === "pastorescopel@gmail.com" && cleanPass === "CaE27785055");

    if (isHashMatch || isMasterBypass) {
      // Senha legada correta! Vamos criar a conta no Supabase Auth silenciosamente.
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPass
      });

      let finalAuthId = signUpData?.user?.id;

      if (signUpError && signUpError.message.includes('already registered')) {
         console.warn("Usuário já existe no Supabase Auth, mas a senha falhou. Mantendo login legado.");
         // Se ele já existe mas a senha estava errada lá, não podemos forçar a atualização da senha sem e-mail.
         // O usuário continuará logando pelo fluxo legado até que a senha seja resetada no Supabase.
      } else if (finalAuthId) {
         // Migração bem-sucedida! Salva o auth_id no banco.
         await saveRecord('users', { ...dbUser, auth_id: finalAuthId, password: inputHash });
      } else if (isMasterBypass && !isHashMatch) {
         await saveRecord('users', { ...dbUser, password: inputHash });
      }

      // Força o login no Supabase se a conta acabou de ser criada
      if (finalAuthId && !signUpError) {
         await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPass });
      }

      setCurrentUser(dbUser);
      setIsAuthenticated(true);
      return true;
    } else {
      setLoginError('Senha incorreta.');
      return false;
    }
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
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
