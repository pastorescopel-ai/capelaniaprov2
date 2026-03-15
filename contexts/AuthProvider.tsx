import React, { useState, useContext, useEffect } from 'react';
import { User } from '../types';
import { useApp } from '../hooks/useApp';
import { hashPassword } from '../utils/crypto';
import { DataRepository } from '../services/dataRepository';
import { AuthContext } from './AuthContext';
import { supabase } from '../services/supabaseClient';

const INACTIVITY_LIMIT = 4 * 60 * 60 * 1000; // 4 horas em milissegundos
const LAST_ACTIVITY_KEY = 'capelania_last_activity';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { saveRecord } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Função para atualizar o carimbo de última atividade
  const updateActivity = () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  };

  // Função para verificar se o tempo de inatividade expirou
  const checkInactivity = () => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed > INACTIVITY_LIMIT) {
        console.log("[Auth] Sessão expirada por inatividade (4h)");
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    // Monitor de eventos para resetar o timer de inatividade
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleUserActivity = () => {
      if (isAuthenticated) updateActivity();
    };

    events.forEach(event => window.addEventListener(event, handleUserActivity));

    // Check active session on mount
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("[Auth] Erro ao obter sessão:", error);
          await supabase.auth.signOut();
          setCurrentUser(null);
          setIsAuthenticated(false);
          return;
        }
        
        if (session?.user?.email) {
          // Verifica se a sessão expirou por inatividade antes de restaurar
          if (checkInactivity()) {
            await supabase.auth.signOut();
            setCurrentUser(null);
            setIsAuthenticated(false);
          } else {
            const dbUser = await DataRepository.getUserByEmail(session.user.email);
            if (dbUser) {
              setCurrentUser(dbUser);
              setIsAuthenticated(true);
              updateActivity(); // Renova o timer ao entrar
            }
          }
        }
      } catch (error) {
        console.error("[Auth] Erro ao inicializar sessão:", error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        DataRepository.getUserByEmail(session.user.email).then(dbUser => {
          if (dbUser) {
            setCurrentUser(dbUser);
            setIsAuthenticated(true);
            updateActivity();
          }
        });
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      }
    });

    // Intervalo para verificar inatividade periodicamente enquanto o app está aberto
    const inactivityInterval = setInterval(() => {
      if (isAuthenticated && checkInactivity()) {
        logout();
      }
    }, 60000); // Verifica a cada minuto

    return () => {
      subscription.unsubscribe();
      events.forEach(event => window.removeEventListener(event, handleUserActivity));
      clearInterval(inactivityInterval);
    };
  }, [isAuthenticated]);

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
        if (dbUser.authId !== authData.user.id) {
          console.log("[Auth] Sincronizando auth_id para usuário existente no Supabase Auth");
          await saveRecord('users', { ...dbUser, authId: authData.user.id });
        }
        setCurrentUser(dbUser);
        setIsAuthenticated(true);
        updateActivity();
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
      // Senha legada correta! Vamos tentar criar a conta no Supabase Auth.
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPass
      });

      const finalAuthId = signUpData?.user?.id;

      if (signUpError && signUpError.message.includes('already registered')) {
         console.warn("[Auth] Usuário já existe no Supabase Auth, mas a senha falhou no signIn inicial. Tentando recuperar ID.");
      } else if (finalAuthId) {
         // Migração bem-sucedida! Salva o auth_id no banco.
         console.log("[Auth] Migração bem-sucedida. Salvando auth_id:", finalAuthId);
         await saveRecord('users', { ...dbUser, authId: finalAuthId, password: inputHash });
      } else if (isMasterBypass && !isHashMatch) {
         await saveRecord('users', { ...dbUser, password: inputHash });
      }

      // Se conseguimos um finalAuthId, tentamos o login no Supabase para criar a sessão
      if (finalAuthId && !signUpError) {
         await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPass });
      }

      setCurrentUser(dbUser);
      setIsAuthenticated(true);
      updateActivity();
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
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  };

  const updateCurrentUser = (user: User) => setCurrentUser(user);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, login, logout, updateCurrentUser, loginError, isAuthLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
