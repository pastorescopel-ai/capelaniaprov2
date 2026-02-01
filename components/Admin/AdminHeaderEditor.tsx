import React, { useState, useRef } from 'react';
import { Config } from '../../types';
import { REPORT_LOGO_BASE64 } from '../../constants';

interface AdminHeaderEditorProps {
  config: Config;
  setConfig: (c: Config) => void;
}

type DragType = 'logo' | 'line1' | 'line2' | 'line3' | 'resize' | null;

const AdminHeaderEditor: React.FC<AdminHeaderEditorProps> = ({ config, setConfig }) => {
  const [activeDrag, setActiveDrag] = useState<DragType>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    
    // Lógica de atualização baseada no tipo de arrasto
    switch (activeDrag) {
      case 'logo': 
        setConfig({ ...config, reportLogoX: x - (config.reportLogoWidth / 2), reportLogoY: y - (config.reportLogoWidth / 4) });
        break;
      case 'line1': setConfig({ ...config, headerLine1X: x - 150, headerLine1Y: y - 10 }); break;
      case 'line2': setConfig({ ...config, headerLine2X: x - 150, headerLine2Y: y - 10 }); break;
      case 'line3': setConfig({ ...config, headerLine3X: x - 150, headerLine3Y: y - 10 }); break;
      case 'resize': setConfig({ ...config, reportLogoWidth: Math.max(30, x - config.reportLogoX) }); break;
    }
  };

  return (
    <section className="space-y-4" onMouseUp={() => setActiveDrag(null)} onMouseLeave={() => setActiveDrag(null)}>
      <h3 className="font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2" style={{ color: config.primaryColor }}>
        <i className="fas fa-pencil-ruler"></i> Editor de Cabeçalho (Relatório)
      </h3>
      <div className="bg-slate-300 p-8 md:p-16 rounded-[3rem] shadow-inner border border-slate-400 relative flex justify-center overflow-x-auto">
        <div ref={previewRef} onMouseMove={handleMouseMove} className="bg-white shadow-2xl relative overflow-hidden flex-shrink-0" style={{ width: '800px', height: '220px' }}>
          
          {/* LOGO DRAGGABLE */}
          <div 
            className={`absolute transition-shadow ${activeDrag === 'logo' ? 'ring-2 ring-blue-500 z-50 shadow-2xl' : 'hover:ring-2 hover:ring-blue-100'}`} 
            style={{ left: `${config.reportLogoX}px`, top: `${config.reportLogoY}px`, width: `${config.reportLogoWidth}px` }} 
            onMouseDown={(e) => { e.preventDefault(); setActiveDrag('logo'); }}
          >
            {/* Usa URL da config ou fallback */}
            <img src={config.reportLogoUrl || REPORT_LOGO_BASE64} style={{ width: '100%', pointerEvents: 'none' }} alt="Logo" />
            <div 
              onMouseDown={(e) => { e.stopPropagation(); setActiveDrag('resize'); }} 
              className="absolute -right-2 -bottom-2 w-6 h-6 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] cursor-nwse-resize"
            >
              <i className="fas fa-expand"></i>
            </div>
          </div>

          {/* LINES DRAGGABLE */}
          {['Line1', 'Line2', 'Line3'].map((l, i) => {
            const field = `headerLine${i+1}` as keyof Config;
            const xField = `headerLine${i+1}X` as keyof Config;
            const yField = `headerLine${i+1}Y` as keyof Config;
            const fsField = `fontSize${i+1}` as keyof Config;
            const colors = [config.primaryColor, '#475569', '#94a3b8'];
            
            return (
              <div 
                key={l} 
                className={`absolute p-2 rounded cursor-move border-2 border-dashed ${activeDrag === `line${i+1}` as DragType ? 'bg-blue-50/50 border-blue-400' : 'border-transparent hover:border-slate-200'}`} 
                style={{ left: config[xField] as number, top: config[yField] as number, minWidth: '350px' }} 
                onMouseDown={(e) => { if(e.target === e.currentTarget) { e.preventDefault(); setActiveDrag(`line${i+1}` as DragType); } }}
              >
                <input 
                  value={config[field] as string} 
                  onChange={e => setConfig({...config, [field]: e.target.value})} 
                  className="w-full bg-transparent border-none focus:ring-0 font-black uppercase whitespace-nowrap outline-none cursor-text" 
                  style={{ fontSize: `${config[fsField]}px`, textAlign: config.headerTextAlign, color: colors[i] }} 
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AdminHeaderEditor;