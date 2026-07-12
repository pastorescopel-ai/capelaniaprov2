
import React, { useState, useEffect, useRef } from 'react';
import { DEFAULT_APP_LOGO } from '../assets';
import { Config } from '../types';
import { useToast } from '../contexts/ToastContext';
import { TURNSTILE_SITE_KEY } from '../constants';

interface LoginProps {
  onLogin: (email: string, pass: string) => Promise<boolean>;
  isSyncing: boolean;
  errorMsg: string | null;
  isConnected: boolean;
  config?: Config;
}

const Login: React.FC<LoginProps> = ({ onLogin, isSyncing, errorMsg, isConnected, config }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { showToast } = useToast();

  // Referência para o input de e-mail para forçar o foco automático
  const emailInputRef = useRef<HTMLInputElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Foca o campo de e-mail assim que o componente é montado
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileContainerRef.current) return;

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !window.turnstile || !turnstileContainerRef.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': () => setTurnstileToken(null),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.remove(turnstileWidgetId.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      showToast("Complete a verificação de segurança para continuar.", "error");
      return;
    }

    setIsLoading(true);

    try {
      if (TURNSTILE_SITE_KEY && turnstileToken) {
        const verifyRes = await fetch('/api/verify-turnstile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          showToast("Verificação de segurança falhou. Tente novamente.", "error");
          if (window.turnstile && turnstileWidgetId.current) {
            window.turnstile.reset(turnstileWidgetId.current);
          }
          setTurnstileToken(null);
          return;
        }
      }

      const success = await onLogin(email, password);
      if (success) {
        showToast("Login realizado com sucesso! Bem-vindo.", "success");
      } else if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.reset(turnstileWidgetId.current);
        setTurnstileToken(null);
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const logoSrc = config?.appLogoUrl || DEFAULT_APP_LOGO;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[420px] p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 space-y-8 animate-in zoom-in duration-300">
        <div className="text-center space-y-4">
          <div className="w-full flex items-center justify-center min-h-[120px]">
            {logoSrc ? (
              <img 
                src={logoSrc} 
                className="max-w-full max-h-32 object-contain" 
                alt="Logo do Sistema" 
                onError={(e) => {
                  const target = e.currentTarget;
                  console.warn(
                    `[Capelania Diagnóstico] O Logo falhou ao carregar na Tela de Login!\n` +
                    `URL tentada: "${target.src}"\n` +
                    `Causa provável: Se a URL contiver 'aistudio.google.com/_/upload', este é um link temporário do Google AI Studio que já expirou no servidor. Recomendamos fazer um novo upload da imagem ou usar o logo padrão.`
                  );
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-blue-200 ${logoSrc ? 'hidden' : ''}`}>
              <i className="fas fa-hospital-symbol text-white text-4xl"></i>
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Capelania HAB</h1>
            <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] leading-relaxed px-4">
              Bem-vindo ao sistema de capelania do hospital adventista de Belém
            </p>
          </div>
          
          {isConnected ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] font-black uppercase tracking-widest">Servidor Online</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
              <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
              <span className="text-[9px] font-black uppercase tracking-widest">Offline</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-600 px-1 uppercase text-[10px] tracking-widest">E-mail</label>
            <input 
              ref={emailInputRef}
              required
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-600 px-1 uppercase text-[10px] tracking-widest">Senha</label>
            <div className="relative">
              <input 
                required
                type={showPassword ? "text" : "password"}
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <i className={`fas fa-eye${showPassword ? '-slash' : ''}`}></i>
              </button>
            </div>
            {errorMsg && (
              <p className="text-rose-600 text-[10px] font-bold uppercase tracking-widest px-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <i className="fas fa-exclamation-circle mr-1"></i> {errorMsg}
              </p>
            )}
          </div>

          {TURNSTILE_SITE_KEY && (
            <div ref={turnstileContainerRef} className="flex justify-center pt-1"></div>
          )}

          <button
            type="submit"
            disabled={(isConnected && isSyncing) || isLoading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
            className={`w-full py-5 font-black rounded-2xl shadow-xl transition-all transform active:scale-[0.98] disabled:opacity-50 mt-4 uppercase text-xs tracking-widest ${isConnected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}
          >
            {isLoading ? 'Autenticando...' : (isConnected ? (isSyncing ? 'Sincronizando...' : 'Acessar Sistema') : 'Entrar Offline')}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-slate-50">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter italic">"Amparando vidas com fé e esperança"</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
