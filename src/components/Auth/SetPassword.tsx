
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

// Tela pra onde o link do e-mail de "Esqueceu a senha?" leva (redirectTo em
// resetPasswordForEmail, ver Login.tsx). O Supabase autentica sozinho a partir do token que vem
// no hash da URL (#access_token=...&type=recovery) assim que a página carrega -- aqui só
// esperamos essa sessão temporária aparecer pra então deixar a pessoa definir a senha nova.
const SetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!supabase) {
      setFatalError('Supabase não configurado.');
      setIsVerifying(false);
      return;
    }

    let done = false;

    // Erros do próprio Supabase já vêm prontos no hash (link expirado, inválido etc.)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const urlError = hashParams.get('error');
    const urlErrorCode = hashParams.get('error_code');
    const urlErrorDesc = hashParams.get('error_description');

    if (urlError || urlErrorCode) {
      const msg = urlErrorCode === 'otp_expired'
        ? 'O link de redefinição expirou. Solicite um novo na tela de login.'
        : urlErrorDesc
          ? decodeURIComponent(urlErrorDesc.replace(/\+/g, ' '))
          : 'Link inválido. Solicite um novo na tela de login.';
      setFatalError(msg);
      setIsVerifying(false);
      done = true;
      return;
    }

    const handleSession = (session: any) => {
      if (done) return;
      done = true;
      const meta = session.user?.user_metadata || {};
      setUserName(meta.name || session.user?.email?.split('@')[0] || 'usuário');
      setIsVerifying(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') && session?.user) {
        handleSession(session);
      }
    });

    const timeout = setTimeout(() => {
      if (!done) {
        setIsVerifying(false);
        setFatalError('Não foi possível verificar o link. Solicite um novo na tela de login.');
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 6) {
      setFormError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setFormError('As senhas não coincidem.');
      return;
    }
    if (!supabase) {
      setFormError('Supabase não configurado.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      // Desloga a sessão temporária de recuperação -- a pessoa faz login normal com a senha nova.
      await supabase.auth.signOut();
      setTimeout(() => { window.location.href = '/'; }, 2500);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao definir senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // items-start + pb-40 no celular: mesma faixa vazia reservada pro aviso de "Instalar App"
  // que existe em Login.tsx -- essa tela também roda com ele montado (é global).
  return (
    <div className="min-h-screen bg-slate-50 flex items-start md:items-center justify-center p-4 pb-40 md:pb-4">
      <div className="bg-white w-full max-w-[420px] p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 space-y-8 animate-in zoom-in duration-300">

        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center mx-auto">
            <i className="fas fa-key text-blue-600 text-2xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Capelania HAB</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Redefinição de Senha</p>
          </div>
        </div>

        {isVerifying && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verificando link...</p>
          </div>
        )}

        {success && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center">
              <i className="fas fa-check-circle text-emerald-500 text-3xl"></i>
            </div>
            <p className="font-black text-slate-800 uppercase text-sm tracking-tight">Senha redefinida com sucesso!</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Redirecionando para o login...</p>
          </div>
        )}

        {!isVerifying && !success && fatalError && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-14 h-14 bg-rose-50 rounded-[1.25rem] flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-rose-400 text-2xl"></i>
            </div>
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl w-full">
              <p className="text-xs font-bold text-rose-600">{fatalError}</p>
            </div>
            <a href="/" className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors">
              ← Voltar ao login
            </a>
          </div>
        )}

        {!isVerifying && !success && !fatalError && (
          <>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-600">
                Olá, <span className="text-blue-600 capitalize">{userName}</span>!
              </p>
              <p className="text-xs text-slate-400 mt-1">Defina sua nova senha de acesso.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nova Senha</label>
                <input
                  type="password" required minLength={6}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Confirmar Senha</label>
                <input
                  type="password" required
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                />
              </div>

              {formError && (
                <p className="text-rose-600 text-[10px] font-bold uppercase tracking-widest px-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <i className="fas fa-exclamation-circle mr-1"></i> {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-5 font-black rounded-2xl shadow-xl transition-all transform active:scale-[0.98] disabled:opacity-50 mt-2 bg-blue-600 hover:bg-blue-700 text-white uppercase text-xs tracking-widest"
              >
                {isLoading ? 'Salvando...' : 'Definir Senha e Acessar'}
              </button>
            </form>
          </>
        )}

        <div className="text-center pt-4 border-t border-slate-50">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter italic">"Amparando vidas com fé e esperança"</p>
        </div>
      </div>
    </div>
  );
};

export default SetPassword;
