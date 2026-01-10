
import React, { useState, useRef, useEffect } from 'react';
import { MasterLists, Config, User } from '../types';

interface AdminPanelProps {
  config: Config;
  masterLists: MasterLists;
  users: User[];
  onUpdateConfig: (newConfig: Config) => void;
  onUpdateLists: (newLists: MasterLists) => void;
  onUpdateUsers: (newUsers: User[]) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ config, masterLists, onUpdateConfig, onUpdateLists }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  
  const [lists, setLists] = useState({
    sectorsHAB: masterLists.sectorsHAB.join('\n'),
    sectorsHABA: masterLists.sectorsHABA.join('\n'),
    groupsHAB: masterLists.groupsHAB.join('\n'),
    groupsHABA: masterLists.groupsHABA.join('\n'),
    staffHAB: masterLists.staffHAB.join('\n'),
    staffHABA: masterLists.staffHABA.join('\n'),
  });

  // Funções para Arrastar e Redimensionar a Logo no Mouse
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging && !isResizing) return;
    if (!previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    if (isDragging) {
      // Ajusta posição X e Y (centralizado no mouse para melhor feeling)
      setLocalConfig(prev => ({
        ...prev,
        reportLogoX: x - (prev.reportLogoWidth / 2),
        reportLogoY: y - 20 // Compensação visual
      }));
    } else if (isResizing) {
      // Ajusta Largura baseado na distância horizontal do início da logo
      const newWidth = Math.max(30, x - localConfig.reportLogoX);
      setLocalConfig(prev => ({
        ...prev,
        reportLogoWidth: newWidth
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleApplyLayout = () => {
    onUpdateConfig(localConfig);
    alert('Layout aplicado ao relatório!');
  };

  const handleSaveAll = () => {
    onUpdateConfig(localConfig);
    onUpdateLists({
      sectorsHAB: lists.sectorsHAB.split('\n').filter(s => s.trim()),
      sectorsHABA: lists.sectorsHABA.split('\n').filter(s => s.trim()),
      groupsHAB: lists.groupsHAB.split('\n').filter(s => s.trim()),
      groupsHABA: lists.groupsHABA.split('\n').filter(s => s.trim()),
      staffHAB: lists.staffHAB.split('\n').filter(s => s.trim()),
      staffHABA: lists.staffHABA.split('\n').filter(s => s.trim()),
    });
    alert('Tudo salvo e sincronizado na nuvem!');
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Configurações</h1>
          <p className="text-slate-500 font-medium text-sm">Arraste a logo no preview para posicionar ou use os campos abaixo.</p>
        </div>
        <div className="flex gap-3">
            <button onClick={handleApplyLayout} className="px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase text-[10px] tracking-widest active:scale-95">
              Aplicar Layout
            </button>
            <button onClick={handleSaveAll} className="px-10 py-5 bg-[#005a9c] text-white font-black rounded-[1.8rem] shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-3 uppercase text-xs tracking-widest active:scale-95">
              <i className="fas fa-cloud-upload-alt"></i> Publicar na Nuvem
            </button>
        </div>
      </header>

      {/* Editor Visual Interativo */}
      <section className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl border-4 border-blue-500/20">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2">
                <i className="fas fa-mouse-pointer"></i> Editor Visual (Clique e arraste a logo)
            </h3>
            <div className="flex gap-4 text-[9px] font-bold text-white/40">
                <span>X: {Math.round(localConfig.reportLogoX)}px</span>
                <span>Y: {Math.round(localConfig.reportLogoY)}px</span>
                <span>L: {localConfig.reportLogoWidth}px</span>
            </div>
        </div>

        <div 
          ref={previewRef}
          onMouseMove={handleMouseMove}
          className="bg-white rounded-2xl p-6 min-h-[220px] relative shadow-inner overflow-hidden cursor-crosshair select-none"
        >
          {/* Logo Interativa */}
          <div 
            className={`absolute transition-shadow duration-200 ${isDragging ? 'ring-4 ring-blue-500/50 shadow-2xl scale-105 z-50' : 'hover:ring-2 hover:ring-blue-300 shadow-sm'}`}
            style={{ 
              left: `${localConfig.reportLogoX}px`, 
              top: `${localConfig.reportLogoY}px`,
              cursor: isResizing ? 'nwse-resize' : 'move'
            }}
          >
            <img 
                src={localConfig.reportLogo} 
                style={{ width: `${localConfig.reportLogoWidth}px`, display: 'block' }} 
                alt="Logo Draggable" 
                onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
            />
            {/* Alça de Redimensionamento */}
            <div 
                onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); }}
                className="absolute -right-2 -bottom-2 w-6 h-6 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-[8px] cursor-nwse-resize shadow-lg"
            >
                <i className="fas fa-expand-alt"></i>
            </div>
          </div>

          {/* Área de Texto Alinhada */}
          <div 
            className="w-full pointer-events-none" 
            style={{ 
              textAlign: localConfig.headerTextAlign, 
              paddingTop: `${localConfig.headerPaddingTop}px` 
            }}
          >
            <p style={{ fontSize: `${localConfig.fontSize1}px` }} className="font-black text-slate-800 uppercase leading-none">{localConfig.headerLine1 || 'LINHA 1'}</p>
            <p style={{ fontSize: `${localConfig.fontSize2}px` }} className="font-bold text-slate-500 uppercase mt-2">{localConfig.headerLine2 || 'LINHA 2'}</p>
            <p style={{ fontSize: `${localConfig.fontSize3}px` }} className="font-medium text-slate-400 uppercase mt-1">{localConfig.headerLine3 || 'LINHA 3'}</p>
          </div>
        </div>
      </section>

      {/* Controles de Ajuste Fino */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-3">
                    <i className="fas fa-font text-blue-500"></i> Textos do Cabeçalho
                </h2>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-slate-50 p-4 rounded-2xl">
                        <div className="md:col-span-4 space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Linha {i}</label>
                            <input 
                                value={(localConfig as any)[`headerLine${i}`]} 
                                onChange={e => setLocalConfig({...localConfig, [`headerLine${i}`]: e.target.value})} 
                                className="w-full p-3 bg-white rounded-xl border-none font-bold text-slate-700 shadow-sm" 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Tamanho</label>
                            <input 
                                type="number" 
                                value={(localConfig as any)[`fontSize${i}`]} 
                                onChange={e => setLocalConfig({...localConfig, [`fontSize${i}`]: parseInt(e.target.value) || 0})} 
                                className="w-full p-3 bg-white rounded-xl border-none font-black text-blue-600 shadow-sm" 
                            />
                        </div>
                    </div>
                    ))}
                </div>
            </section>
        </div>

        <div className="space-y-6">
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-3">
                    <i className="fas fa-align-center text-blue-500"></i> Alinhamento e Margens
                </h2>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Margem Texto (Topo)</label>
                        <input type="number" value={localConfig.headerPaddingTop} onChange={e => setLocalConfig({...localConfig, headerPaddingTop: parseInt(e.target.value) || 0})} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-black" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Alinhamento Texto</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['left', 'center', 'right'].map(align => (
                                <button 
                                    key={align}
                                    onClick={() => setLocalConfig({...localConfig, headerTextAlign: align as any})}
                                    className={`py-3 rounded-xl border-2 transition-all ${localConfig.headerTextAlign === align ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400'}`}
                                >
                                    <i className={`fas fa-align-${align}`}></i>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
      </div>

      {/* Listas Mestres */}
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
          <i className="fas fa-list-ul text-emerald-500"></i> Listas Mestres (Setores, PGs e Equipe)
        </h2>
        <div className="grid md:grid-cols-2 gap-10">
          {['HAB', 'HABA'].map(unit => (
            <div key={unit} className="space-y-6 p-6 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
              <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-2xl w-fit shadow-sm">
                <div className={`w-2 h-2 rounded-full ${unit === 'HAB' ? 'bg-blue-500' : 'bg-indigo-500'}`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Unidade {unit}</span>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-2 uppercase">Setores</label>
                  <textarea value={(lists as any)[`sectors${unit}`]} onChange={e => setLists({...lists, [`sectors${unit}`]: e.target.value})} className="w-full h-32 p-4 bg-white rounded-2xl border-none font-medium text-sm no-scrollbar resize-none shadow-sm focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-2 uppercase">Pequenos Grupos</label>
                  <textarea value={(lists as any)[`groups${unit}`]} onChange={e => setLists({...lists, [`groups${unit}`]: e.target.value})} className="w-full h-32 p-4 bg-white rounded-2xl border-none font-medium text-sm no-scrollbar resize-none shadow-sm focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-2 uppercase">Colaboradores</label>
                  <textarea value={(lists as any)[`staff${unit}`]} onChange={e => setLists({...lists, [`staff${unit}`]: e.target.value})} className="w-full h-32 p-4 bg-white rounded-2xl border-none font-medium text-sm no-scrollbar resize-none shadow-sm focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminPanel;
