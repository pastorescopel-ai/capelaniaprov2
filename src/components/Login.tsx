
import React, { useState, useEffect, useRef } from 'react';
import { DEFAULT_APP_LOGO } from '../assets';
import { Config } from '../types';
import { useToast } from '../contexts/ToastContext';
import { TURNSTILE_SITE_KEY } from '../constants';
import { supabase } from '../services/supabaseClient';

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

  // Estados da recuperação de senha ("Esqueceu a senha?")
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecoverySent, setIsRecoverySent] = useState(false);

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

  // Renderiza (ou re-renderiza) o widget do Turnstile -- roda de novo sempre que troca entre
  // login e recuperação de senha, porque o container é um <div> diferente em cada formulário
  // (só um dos dois está montado por vez), então o widget da tela anterior fica órfão e
  // precisa ser recriado no container novo.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileContainerRef.current) return;

    let cancelled = false;
    setTurnstileToken(null);

    const renderWidget = () => {
      if (cancelled || !window.turnstile || !turnstileContainerRef.current) return;

      // Em desenvolvimento, o React.StrictMode roda este efeito, a limpeza dele, e o efeito de
      // novo -- tudo no mesmo ciclo (mount → cleanup → mount), sem dar tempo do
      // window.turnstile.remove() da rodada anterior terminar de verdade antes do próximo
      // render() ser chamado no mesmo <div>. O widget do Cloudflare não lida bem com isso: fica
      // com estado interno inconsistente e a verificação falha ("Falha na verificação") assim
      // que a pessoa interage com ele, mesmo o site key/domínio estando liberados. Limpar o
      // container na unha antes de renderizar de novo garante um slate limpo independente de
      // quando o remove() anterior efetivamente termina.
      turnstileContainerRef.current.innerHTML = '';
      turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        // Sem isso, o widget segue o tema do sistema operacional do aparelho (theme padrão é
        // "auto") -- em celular com modo escuro ativado no Android/iOS, o quadradinho aparecia
        // escuro mesmo com o app inteiro no visual claro. O app não tem modo escuro; trava aqui
        // também.
        theme: 'light',
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': () => setTurnstileToken(null),
      });
    };

    // Adia pro próximo frame em vez de renderizar na hora: dá tempo do cleanup da rodada
    // anterior (se houver) terminar de rodar antes de criar um widget novo no mesmo lugar.
    const rafId = requestAnimationFrame(() => {
      if (window.turnstile) {
        renderWidget();
      }
    });

    let interval: ReturnType<typeof setInterval> | undefined;
    if (!window.turnstile) {
      interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (interval) clearInterval(interval);
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = undefined;
      }
    };
  }, [isRecovering]);

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

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      showToast("Complete a verificação de segurança para continuar.", "error");
      return;
    }
    if (!supabase) {
      showToast("Supabase não configurado.", "error");
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

      const { error } = await supabase.auth.resetPasswordForEmail(
        recoveryEmail.toLowerCase().trim(),
        { redirectTo: window.location.origin + '/set-password' }
      );

      if (error) {
        showToast(error.message, "error");
        if (window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current);
        }
        setTurnstileToken(null);
      } else {
        setIsRecoverySent(true);
      }
    } catch (error) {
      console.error("Recovery error:", error);
      showToast("Erro ao solicitar redefinição de senha.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const logoSrc = config?.appLogoUrl || DEFAULT_APP_LOGO;

  return (
    // items-start + pb-40 no celular garante uma faixa vazia embaixo da tela, reservada pro
    // aviso flutuante de "Instalar App" (fixed, canto inferior) não cair em cima do botão
    // "Acessar Sistema" -- items-center sozinho deixava o card colado no fundo em telas
    // menores, e o aviso aparecia bem em cima do botão. No desktop (md:) volta a centralizar
    // normal, sem essa faixa extra (lá o aviso já tem folga de sobra).
    <div className="min-h-screen bg-slate-50 flex items-start md:items-center justify-center p-4 pb-40 md:pb-4">
      <div className="bg-white w-full max-w-[420px] p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 space-y-4 md:space-y-8 animate-in zoom-in duration-300">
        <div className="text-center space-y-2 md:space-y-4">
          <div className="w-full flex items-center justify-center min-h-[72px] md:min-h-[120px]">
            {logoSrc ? (
              <img
                src={logoSrc}
                className="max-w-full max-h-20 md:max-h-32 object-contain"
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
            <div className={`w-16 h-16 md:w-24 md:h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-blue-200 ${logoSrc ? 'hidden' : ''}`}>
              <i className="fas fa-hospital-symbol text-white text-2xl md:text-4xl"></i>
            </div>
          </div>
          
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase">Capelania HAB</h1>
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

        {isRecovering ? (
          isRecoverySent ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 text-center py-2">
              <div className="w-14 h-14 mx-auto bg-emerald-50 rounded-[1.25rem] flex items-center justify-center">
                <i className="fas fa-check-circle text-emerald-500 text-2xl"></i>
              </div>
              <p className="text-sm font-bold text-slate-600 px-2">
                Se <span className="text-blue-600">{recoveryEmail}</span> estiver cadastrado, você vai receber um e-mail com o link de redefinição em instantes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsRecovering(false);
                  setIsRecoverySent(false);
                  setRecoveryEmail('');
                }}
                className="w-full py-4 font-bold rounded-2xl text-slate-500 hover:text-slate-800 transition-all bg-slate-100 hover:bg-slate-200 uppercase text-xs tracking-widest"
              >
                Voltar ao login
              </button>
            </div>
          ) : (
            <form onSubmit={handleRecoverySubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl flex items-center gap-3">
                <i className="fas fa-info-circle text-lg"></i>
                <p className="text-[10px] font-black uppercase tracking-wider leading-snug">
                  Digite seu e-mail cadastrado para receber o link de redefinição de senha.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-600 px-1 uppercase text-[10px] tracking-widest">E-mail do Cadastro</label>
                <input
                  required
                  type="email"
                  value={recoveryEmail}
                  onChange={e => setRecoveryEmail(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  placeholder="seu@email.com"
                />
              </div>

              {TURNSTILE_SITE_KEY && (
                <div ref={turnstileContainerRef} className="flex justify-center pt-1"></div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
                  className="w-full py-5 font-black rounded-2xl shadow-xl transition-all transform active:scale-[0.98] disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white uppercase text-xs tracking-widest"
                >
                  {isLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecovering(false)}
                  disabled={isLoading}
                  className="w-full py-4 font-bold rounded-2xl text-slate-500 hover:text-slate-800 transition-all bg-slate-100 hover:bg-slate-200 uppercase text-xs tracking-widest"
                >
                  Voltar
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-600 px-1 uppercase text-[10px] tracking-widest">E-mail</label>
              <input
                ref={emailInputRef}
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full p-3.5 md:p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
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
                  className="w-full p-3.5 md:p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium pr-12"
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
              <div className="flex justify-end px-1 pt-1">
                <button
                  type="button"
                  onClick={() => setIsRecovering(true)}
                  className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest transition-colors hover:underline"
                >
                  Esqueceu a senha?
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
              className={`w-full py-3.5 md:py-5 font-black rounded-2xl shadow-xl transition-all transform active:scale-[0.98] disabled:opacity-50 mt-2 md:mt-4 uppercase text-xs tracking-widest ${isConnected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}
            >
              {isLoading ? 'Autenticando...' : (isConnected ? (isSyncing ? 'Sincronizando...' : 'Acessar Sistema') : 'Entrar Offline')}
            </button>
          </form>
        )}

        <div className="text-center pt-2 md:pt-4 border-t border-slate-50">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter italic">"Amparando vidas com fé e esperança"</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
