import React, { useState, useContext, useEffect } from 'react';
import { User } from '../types';
import { useApp } from '../hooks/useApp';
import { hashPassword } from '../utils/crypto';
import { DataRepository } from '../services/dataRepository';
import { AuthContext } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { clearSessionAnimationFlags } from '../hooks/useAnimateOncePerSession';

const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hora em milissegundos
const LAST_ACTIVITY_KEY = 'capelania_last_activity';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { saveRecord, refreshData } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const isAuthenticatedRef = React.useRef(isAuthenticated);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const updateActivity = () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  };

  const checkInactivity = () => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed > INACTIVITY_LIMIT) {
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

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleUserActivity = () => {
      if (isAuthenticatedRef.current) updateActivity();
    };

    events.forEach(event => window.addEventListener(event, handleUserActivity));

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Erro ao obter sessão:", error);
          await supabase.auth.signOut();
          setCurrentUser(null);
          setIsAuthenticated(false);
          return;
        }
        
        if (session?.user?.email) {
          if (checkInactivity()) {
            await supabase.auth.signOut();
            setCurrentUser(null);
            setIsAuthenticated(false);
          } else {
            const dbUser = await DataRepository.getUserByEmail(session.user.email);
            if (dbUser) {
              setCurrentUser(dbUser);
              setIsAuthenticated(true);
              updateActivity();
              refreshData();
            }
          }
        }
      } catch (error) {
        console.error("Erro ao inicializar sessão:", error);
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
            if (_event === 'SIGNED_IN') {
              refreshData();
            }
          }
        });
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      }
    });

    const inactivityInterval = setInterval(() => {
      if (isAuthenticatedRef.current && checkInactivity()) {
        logout();
      }
    }, 60000);

    return () => {
      subscription.unsubscribe();
      events.forEach(event => window.removeEventListener(event, handleUserActivity));
      clearInterval(inactivityInterval);
    };
  }, [refreshData]);

  const login = async (email: string, pass: string, captchaToken?: string | null): Promise<boolean> => {
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

    // O projeto Supabase tem proteção de CAPTCHA própria habilitada (config do painel, fora
    // deste repo) -- ela exige `options.captchaToken` em TODA chamada de login por senha,
    // senão rejeita com 400 "captcha protection: request disallowed (no captcha_token found)".
    // Antes o Turnstile só era validado no nosso próprio endpoint (/api/verify-turnstile) e o
    // token nunca chegava até aqui -- por isso o login parava de funcionar em produção mesmo
    // com o widget resolvido certinho. Repassa o mesmo token do widget pro Supabase verificar.
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass,
      options: captchaToken ? { captchaToken } : undefined
    });

    if (authData?.user) {
      const dbUser = await DataRepository.getUserByEmail(cleanEmail);
      if (dbUser) {
        if (dbUser.authId !== authData.user.id || dbUser.lastLoginAt !== new Date().toISOString().split('T')[0]) {
          await saveRecord('users', { ...dbUser, authId: authData.user.id, lastLoginAt: new Date().toISOString().split('T')[0] });
        }
        setCurrentUser(dbUser);
        setIsAuthenticated(true);
        updateActivity();
        return true;
      }
    }

    const dbUser = await DataRepository.getUserByEmail(cleanEmail);
    
    if (!dbUser) {
      setLoginError('Usuário não localizado.');
      return false;
    }

    const inputHash = await hashPassword(cleanPass);
    const storedPass = String(dbUser.password || "").trim();

    const isHashMatch = (inputHash !== "" && inputHash === storedPass);

    if (isHashMatch) {
      // 2026-09-30: este branch só existia pra "logar" quem tem senha antiga (hash local) mas
      // cujo signInWithPassword de cima (linha ~143) falhou -- e antes disso ele podia acabar
      // marcando isAuthenticated=true SEM nenhuma sessão real do Supabase ter sido criada (ex:
      // quando a conta "já existe" no Supabase Auth, o código desistia de tentar logar e só
      // fingia sucesso). Isso deixava a pessoa vendo a tela normal do app, mas toda chamada ao
      // banco saía como `anon` -- foi exatamente o que causou o erro "sem permissão... política
      // de segurança do banco" que apareceu numa Visita Pastoral. Agora `sessionEstablished` só
      // vira true quando existe MESMO uma sessão -- sem isso, false e loginError, nunca mais
      // "logado" de mentirinha.
      let sessionEstablished = false;

      // Mesmo CAPTCHA do painel Supabase vale pra signUp e pro signIn de migração abaixo --
      // sem o token, os dois caem no mesmo 400 "no captcha_token found".
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPass,
        options: captchaToken ? { captchaToken } : undefined
      });

      const finalAuthId = signUpData?.user?.id;

      if (signUpError && signUpError.message.includes('already registered')) {
         // A conta já existe no Supabase Auth (ex: uma migração anterior já criou) -- antes o
         // código desistia aqui; agora tenta logar de verdade com a senha que a pessoa digitou.
         const { data: retryData } = await supabase.auth.signInWithPassword({
           email: cleanEmail,
           password: cleanPass,
           options: captchaToken ? { captchaToken } : undefined
         });
         if (retryData?.user) {
           sessionEstablished = true;
           if (dbUser.authId !== retryData.user.id) {
             await saveRecord('users', { ...dbUser, authId: retryData.user.id, password: inputHash });
           }
         }
      } else if (finalAuthId) {
         await saveRecord('users', { ...dbUser, authId: finalAuthId, password: inputHash });
         if (!signUpError) {
           const { data: signInData } = await supabase.auth.signInWithPassword({
             email: cleanEmail,
             password: cleanPass,
             options: captchaToken ? { captchaToken } : undefined
           });
           sessionEstablished = !!signInData?.user;
         }
      }

      if (!sessionEstablished) {
        setLoginError('Não foi possível confirmar sua sessão. Tente novamente.');
        return false;
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
    // Libera os gráficos que só animam uma vez por login (ver useAnimateOncePerSession.ts) pra
    // tocarem de novo no próximo login -- sem isso, ficariam travados sem animação pro resto
    // da sessão do navegador, mesmo entrando com outro usuário.
    clearSessionAnimationFlags();
  };

  const updateCurrentUser = (user: User) => setCurrentUser(user);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, login, logout, updateCurrentUser, loginError, isAuthLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
