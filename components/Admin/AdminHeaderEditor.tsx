
import React, { useState, useRef } from 'react';
import { Config } from '../../types';
import { DEFAULT_APP_LOGO } from '../../assets';

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

  const resetPositions = () => {
    setConfig({
      ...config,
      reportLogoX: 40,
      reportLogoY: 20,
      reportLogoWidth: 100,
      headerLine1X: 160,
      headerLine1Y: 30,
      headerLine2X: 160,
      headerLine2Y: 60,
      headerLine3X: 160,
      headerLine3Y: 90,
      headerPaddingTop: 0,
      headerTextAlign: 'left'
    });
  };

  return (
    <section className="space-y-6" onMouseUp={() => setActiveDrag(null)} onMouseLeave={() => setActiveDrag(null)}>
      <div className="flex justify-between items-center">
        <h3 className="font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2" style={{ color: config.primaryColor }}>
          <i className="fas fa-pencil-ruler"></i> Editor de Cabeçalho (Relatório)
        </h3>
        <button 
          onClick={resetPositions}
          className="px-4 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
        >
          <i className="fas fa-undo"></i> Resetar Posições
        </button>
      </div>

      <div className="bg-slate-200 p-8 md:p-12 rounded-[3rem] shadow-inner border border-slate-300 relative flex flex-col items-center gap-8">
        <div ref={previewRef} onMouseMove={handleMouseMove} className="bg-white shadow-2xl relative overflow-hidden flex-shrink-0 border border-slate-100" style={{ width: '800px', height: '220px' }}>
          
          {/* LOGO DRAGGABLE */}
          <div 
            className={`absolute transition-shadow cursor-move ${activeDrag === 'logo' ? 'ring-2 ring-blue-500 z-50 shadow-2xl' : 'hover:ring-2 hover:ring-blue-100'}`} 
            style={{ left: `${config.reportLogoX}px`, top: `${config.reportLogoY}px`, width: `${config.reportLogoWidth}px` }} 
            onMouseDown={(e) => { e.preventDefault(); setActiveDrag('logo'); }}
          >
            <img src={config.reportLogoUrl || DEFAULT_APP_LOGO} style={{ width: '100%', pointerEvents: 'none' }} alt="Logo" />
            <div 
              onMouseDown={(e) => { e.stopPropagation(); setActiveDrag('resize'); }} 
              className="absolute -right-2 -bottom-2 w-6 h-6 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] cursor-nwse-resize shadow-lg"
            >
              <i className="fas fa-expand"></i>
            </div>
          </div>

          {/* LINES DRAGGABLE */}
          <div style={{ paddingTop: `${config.headerPaddingTop}px` }}>
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
                  style={{ left: config[xField] as number, top: config[yField] as number, minWidth: '400px' }} 
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

        <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ajuste de Altura (Padding Top)</label>
            <span className="text-xs font-bold text-blue-600">{config.headerPaddingTop}px</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={config.headerPaddingTop} 
            onChange={e => setConfig({...config, headerPaddingTop: parseInt(e.target.value)})}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <p className="text-[9px] text-slate-400 text-center italic">Arraste os elementos no quadro acima para posicionar o cabeçalho do PDF.</p>
        </div>
      </div>
    </section>
  );
};

export default AdminHeaderEditor;
