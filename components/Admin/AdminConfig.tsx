
import React, { useState, useRef } from 'react';
import { Config } from '../../types';
import { DEFAULT_APP_LOGO } from '../../assets';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import AdminHeaderEditor from './AdminHeaderEditor';

interface AdminConfigProps {
  config: Config;
  setConfig: (c: Config) => void;
}

const AdminConfig: React.FC<AdminConfigProps> = ({ config, setConfig }) => {
  const [isUploading, setIsUploading] = useState<'app' | 'report' | null>(null);
  const { showToast } = useToast();
  
  const appLogoInputRef = useRef<HTMLInputElement>(null);
  const reportLogoInputRef = useRef<HTMLInputElement>(null);

  const colorPresets = [
    { label: 'Azul Original', value: '#005a9c' },
    { label: 'Verde Saúde', value: '#10b981' },
    { label: 'Vinho Pastoral', value: '#991b1b' },
    { label: 'Azul Escuro', value: '#1e293b' },
    { label: 'Roxo Espiritual', value: '#6366f1' },
    { label: 'Verde Petróleo', value: '#0d9488' },
  ];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'app' | 'report') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!supabase) {
      showToast("Erro: Conexão com Supabase não detectada.", "warning");
      return;
    }

    setIsUploading(type);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-logo-${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('app-assets')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('app-assets')
        .getPublicUrl(fileName);

      if (type === 'app') {
        setConfig({ ...config, appLogoUrl: publicUrl });
      } else {
        setConfig({ ...config, reportLogoUrl: publicUrl });
      }
      showToast("Upload realizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast("Falha no upload. Verifique bucket 'app-assets'.", "warning");
    } finally {
      setIsUploading(null);
      // Limpa o input
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8">
      
      {/* SEÇÃO DE IMAGENS */}
      <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
          <i className="fas fa-images text-blue-600"></i> Identidade Visual
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
            <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
              Exibido na tela de login e na barra lateral. Recomenda-se formato PNG transparente.
            </p>
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
             <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
              Exibido no cabeçalho dos relatórios impressos.
            </p>
          </div>

        </div>
      </section>

      {/* EDITOR VISUAL DE CABEÇALHO (Componente Extraído) */}
      <AdminHeaderEditor config={config} setConfig={setConfig} />

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

        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 lg:col-span-2">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">Temas</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {colorPresets.map(cp => (
              <button key={cp.value} onClick={() => setConfig({...config, primaryColor: cp.value})} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${config.primaryColor === cp.value ? 'border-slate-800 bg-slate-50' : 'border-slate-100 hover:border-slate-200'}`}><div className="w-6 h-6 rounded-lg shadow-sm" style={{ backgroundColor: cp.value }}></div><span className="text-[10px] font-black uppercase tracking-tighter text-slate-600">{cp.label}</span></button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminConfig;
