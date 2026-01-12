
import React, { useState } from 'react';
import { APP_LOGO_BASE64 } from '../constants';

interface LoginProps {
  onLogin: (email: string, pass: string) => void;
  isSyncing: boolean;
  errorMsg: string | null;
  isConnected: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, isSyncing, errorMsg, isConnected }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* Card com largura fixa para simular mobile em qualquer dispositivo */}
      <div className="bg-white w-full max-w-[420px] p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 space-y-8 animate-in zoom-in duration-300">
        <div className="text-center space-y-4">
          <div className="w-full flex items-center justify-center min-h-[120px]">
            {APP_LOGO_BASE64 && APP_LOGO_BASE64.length > 200 ? (
              <img 
                src={APP_LOGO_BASE64} 
                className="max-w-full max-h-32 object-contain" 
                alt="Logo do Sistema" 
              />
            ) : (
              <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-blue-200">
                <i className="fas fa-hospital-symbol text-white text-4xl"></i>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Capelania Pro</h1>
            <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] leading-relaxed px-4">
              Bem-vindo ao sistema de capelania do hospital adventista de Belém
            </p>
          </div>
          
          {isConnected && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] font-black uppercase tracking-widest">Servidor Online</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-600 px-1 uppercase text-[10px] tracking-widest">E-mail</label>
            <input 
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
            <input 
              required
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              placeholder="••••••••"
            />
            {errorMsg && (
              <p className="text-rose-600 text-[10px] font-bold uppercase tracking-widest px-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <i className="fas fa-exclamation-circle mr-1"></i> {errorMsg}
              </p>
            )}
          </div>
          <button 
            type="submit" 
            disabled={isSyncing}
            className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all transform active:scale-[0.98] disabled:opacity-50 mt-4 uppercase text-xs tracking-widest"
          >
            {isSyncing ? 'Sincronizando...' : 'Acessar Sistema'}
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
