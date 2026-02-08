
import React, { useState } from 'react';

const PrayView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const targetUrl = "https://pray.hab.org.br/relatorios/";

  return (
    <div className="flex flex-col h-[80vh] md:h-[85vh] bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 relative animate-in fade-in duration-500">
       
       {/* Barra de Controle Superior */}
       <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center px-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              <i className="fas fa-lock mr-1 text-slate-400"></i> Conexão Segura
            </span>
          </div>
          <a 
            href={targetUrl} 
            target="_blank" 
            rel="noreferrer" 
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-bold text-blue-600 uppercase tracking-wider hover:bg-blue-50 transition-all shadow-sm active:scale-95"
          >
            Abrir no Navegador <i className="fas fa-external-link-alt"></i>
          </a>
       </div>

       {/* Área de Conteúdo */}
       <div className="flex-1 relative bg-slate-100">
           
           {/* Loader Animado */}
           {loading && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-slate-100 border-t-[#005a9c] rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-xl">🙏</div>
                </div>
                <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse">
                    Conectando ao Servidor Pray...
                </p>
             </div>
           )}

           {/* O Iframe */}
           <iframe
             src={targetUrl}
             className="w-full h-full border-none"
             onLoad={() => setLoading(false)}
             title="Portal Pray"
             sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
           />
       </div>
    </div>
  );
};

export default PrayView;
