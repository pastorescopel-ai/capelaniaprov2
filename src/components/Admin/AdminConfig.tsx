
import React, { useRef } from 'react';
import { Config } from '../../types';
import { DEFAULT_APP_LOGO } from '../../assets';
import AdminHeaderEditor from './AdminHeaderEditor';
import AdminThemeEditor from './AdminThemeEditor';
import { useLogoUpload } from '../../hooks/useLogoUpload';

interface AdminConfigProps {
  config: Config;
  setConfig: (c: Config) => void;
  mode?: 'basic' | 'identity';
}

const AdminConfig: React.FC<AdminConfigProps> = ({ config, setConfig, mode = 'basic' }) => {
  const { handleUpload, isUploading } = useLogoUpload(config, setConfig);
  
  const appLogoInputRef = useRef<HTMLInputElement>(null);
  const reportLogoInputRef = useRef<HTMLInputElement>(null);

  if (mode === 'identity') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* SEÇÃO DE IMAGENS */}
        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
            <i className="fas fa-images text-blue-600"></i> Logotipos do Sistema
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* LOGO DO APP */}
            <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Logo do App (Login/Menu)</h4>
                <button 
                  onClick={() => appLogoInputRef.current?.click()} 
                  disabled={isUploading === 'app'}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                >
                  {isUploading === 'app' ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-upload-alt"></i>}
                  Trocar
                </button>
                <input ref={appLogoInputRef} type="file" accept="image/*" onChange={(e) => handleUpload(e, 'app')} className="hidden" />
              </div>
              <div className="h-24 bg-white rounded-xl flex items-center justify-center border border-slate-200 overflow-hidden relative">
                <img src={config.appLogoUrl || DEFAULT_APP_LOGO} className="h-16 object-contain" alt="App Logo" />
                {!config.appLogoUrl && <span className="absolute bottom-1 right-2 text-[8px] font-bold text-amber-500 uppercase">Padrão</span>}
              </div>
            </div>

            {/* LOGO DO RELATÓRIO */}
            <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Logo do Relatório (PDF)</h4>
                <button 
                  onClick={() => reportLogoInputRef.current?.click()} 
                  disabled={isUploading === 'report'}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                >
                  {isUploading === 'report' ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-upload-alt"></i>}
                  Trocar
                </button>
                <input ref={reportLogoInputRef} type="file" accept="image/*" onChange={(e) => handleUpload(e, 'report')} className="hidden" />
              </div>
              <div className="h-24 bg-white rounded-xl flex items-center justify-center border border-slate-200 overflow-hidden relative">
                <img src={config.reportLogoUrl || DEFAULT_APP_LOGO} className="h-16 object-contain" alt="Report Logo" />
                {!config.reportLogoUrl && <span className="absolute bottom-1 right-2 text-[8px] font-bold text-amber-500 uppercase">Padrão</span>}
              </div>
            </div>
          </div>
        </section>

        {/* EDITOR VISUAL DE CABEÇALHO */}
        <AdminHeaderEditor config={config} setConfig={setConfig} />

        <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4">
          <i className="fas fa-exclamation-triangle text-amber-500 mt-1"></i>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Nota sobre Salvamento</p>
            <p className="text-[9px] text-amber-700 font-bold leading-relaxed">
              Se as alterações não persistirem após clicar em "Aplicar Mudanças", seu banco de dados pode precisar de uma atualização. 
              Vá na aba <span className="underline">Ferramentas</span> e use o botão "Correção de Banco (SQL)".
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid lg:grid-cols-3 gap-8">
        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">Formatação</h2>
          <div className="flex bg-slate-50 p-2 rounded-2xl gap-2">
            {['left', 'center', 'right'].map(align => (
              <button key={align} onClick={() => setConfig({...config, headerTextAlign: align as any})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${config.headerTextAlign === align ? 'bg-white shadow-sm' : 'text-slate-400'}`} style={{ color: config.headerTextAlign === align ? config.primaryColor : undefined }}><i className={`fas fa-align-${align} mr-2`}></i>{align}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">L{i}</label>
                <input type="number" value={(config as any)[`fontSize${i}`]} onChange={e => setConfig({...config, [`fontSize${i}`]: parseInt(e.target.value) || 0})} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-black text-xs" />
              </div>
            ))}
          </div>
        </section>

        <AdminThemeEditor config={config} setConfig={setConfig} />
      </div>
    </div>
  );
};

export default AdminConfig;
