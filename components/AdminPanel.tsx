
import React, { useState, useRef } from 'react';
import { MasterLists, Config, User } from '../types';

interface AdminPanelProps {
  config: Config;
  masterLists: MasterLists;
  users: User[];
  onUpdateConfig: (newConfig: Config) => void;
  onUpdateLists: (newLists: MasterLists) => void;
  onUpdateUsers: (newUsers: User[]) => void;
}

type DragType = 'logo' | 'line1' | 'line2' | 'line3' | 'resize' | null;

const AdminPanel: React.FC<AdminPanelProps> = ({ config, masterLists, onUpdateConfig, onUpdateLists }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [activeDrag, setActiveDrag] = useState<DragType>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  const [lists, setLists] = useState({
    sectorsHAB: masterLists.sectorsHAB.join('\n'),
    sectorsHABA: masterLists.sectorsHABA.join('\n'),
    groupsHAB: masterLists.groupsHAB.join('\n'),
    groupsHABA: masterLists.groupsHABA.join('\n'),
    staffHAB: masterLists.staffHAB.join('\n'),
    staffHABA: masterLists.staffHABA.join('\n'),
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag || !previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    setLocalConfig(prev => {
      switch (activeDrag) {
        case 'logo':
          return { ...prev, reportLogoX: x - (prev.reportLogoWidth / 2), reportLogoY: y - (prev.reportLogoWidth / 4) };
        case 'line1':
          return { ...prev, headerLine1X: x - 100, headerLine1Y: y - 10 };
        case 'line2':
          return { ...prev, headerLine2X: x - 100, headerLine2Y: y - 10 };
        case 'line3':
          return { ...prev, headerLine3X: x - 100, headerLine3Y: y - 10 };
        case 'resize':
          const newWidth = Math.max(30, x - prev.reportLogoX);
          return { ...prev, reportLogoWidth: newWidth };
        default:
          return prev;
      }
    });
  };

  const handleMouseUp = () => {
    setActiveDrag(null);
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
    alert('Configurações e Listas salvas com sucesso!');
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-32 animate-in fade-in duration-700" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">Painel de Controle</h1>
          <p className="text-slate-500 font-medium">Configure o layout do relatório e as listas do sistema.</p>
        </div>
        <button onClick={handleSaveAll} className="px-10 py-5 bg-[#005a9c] text-white font-black rounded-[2rem] shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-3 uppercase text-xs tracking-widest active:scale-95">
          <i className="fas fa-save"></i> Salvar Tudo
        </button>
      </header>

      {/* Editor Visual de Cabeçalho - Simulação Fiel A4 (Área Superior) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-6">
          <h3 className="text-[#005a9c] font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2">
            <i className="fas fa-pencil-ruler"></i> Design do Cabeçalho (Arraste cada elemento individualmente)
          </h3>
          <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase">
             <span>Logo: {localConfig.reportLogoX}x, {localConfig.reportLogoY}y</span>
             <span>Área do Cabeçalho: 800px x 220px</span>
          </div>
        </div>

        <div className="bg-slate-300 p-8 md:p-16 rounded-[4rem] shadow-inner border border-slate-400 relative flex justify-center">
          {/* Régua de limite superior */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] font-black text-slate-500 uppercase tracking-widest opacity-40">
            Topo da Página A4
          </div>

          <div 
            ref={previewRef}
            onMouseMove={handleMouseMove}
            className="bg-white shadow-[0_45px_100px_-20px_rgba(0,0,0,0.4)] relative overflow-hidden"
            style={{ width: '800px', height: '220px' }} // Altura aproximada do cabeçalho real
          >
            {/* Linha de Base (Fim do Cabeçalho) */}
            <div className="absolute bottom-0 left-0 right-0 border-b-2 border-dashed border-slate-200 pointer-events-none flex justify-center">
                <span className="bg-white px-2 text-[8px] font-bold text-slate-300 -translate-y-1/2">FIM DA ÁREA DE CABEÇALHO</span>
            </div>

            {/* Logo Draggable e Resizable */}
            <div 
              className={`absolute transition-shadow duration-200 ${activeDrag === 'logo' ? 'ring-2 ring-blue-500 shadow-2xl z-50' : 'hover:ring-2 hover:ring-blue-200'}`}
              style={{ 
                left: `${localConfig.reportLogoX}px`, 
                top: `${localConfig.reportLogoY}px`,
                cursor: activeDrag === 'resize' ? 'nwse-resize' : 'move'
              }}
              onMouseDown={(e) => { e.preventDefault(); setActiveDrag('logo'); }}
            >
              <img 
                src={localConfig.reportLogo} 
                style={{ width: `${localConfig.reportLogoWidth}px`, display: 'block' }} 
                alt="Logo" 
              />
              <div 
                onMouseDown={(e) => { e.stopPropagation(); setActiveDrag('resize'); }}
                className="absolute -right-2 -bottom-2 w-6 h-6 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] cursor-nwse-resize shadow-lg"
              >
                <i className="fas fa-expand"></i>
              </div>
            </div>

            {/* Linha 1 Draggable */}
            <div 
                className={`absolute p-2 rounded-lg cursor-move border border-transparent ${activeDrag === 'line1' ? 'border-blue-400 bg-blue-50/30' : 'hover:border-slate-200'}`}
                style={{ left: localConfig.headerLine1X, top: localConfig.headerLine1Y, minWidth: '300px' }}
                onMouseDown={(e) => { e.preventDefault(); setActiveDrag('line1'); }}
            >
                <input 
                  value={localConfig.headerLine1}
                  onChange={e => setLocalConfig({...localConfig, headerLine1: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-0 text-[#005a9c] font-black uppercase text-center"
                  style={{ fontSize: `${localConfig.fontSize1}px` }}
                />
            </div>

            {/* Linha 2 Draggable */}
            <div 
                className={`absolute p-2 rounded-lg cursor-move border border-transparent ${activeDrag === 'line2' ? 'border-blue-400 bg-blue-50/30' : 'hover:border-slate-200'}`}
                style={{ left: localConfig.headerLine2X, top: localConfig.headerLine2Y, minWidth: '300px' }}
                onMouseDown={(e) => { e.preventDefault(); setActiveDrag('line2'); }}
            >
                <input 
                  value={localConfig.headerLine2}
                  onChange={e => setLocalConfig({...localConfig, headerLine2: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-0 text-slate-600 font-bold uppercase text-center"
                  style={{ fontSize: `${localConfig.fontSize2}px` }}
                />
            </div>

            {/* Linha 3 Draggable */}
            <div 
                className={`absolute p-2 rounded-lg cursor-move border border-transparent ${activeDrag === 'line3' ? 'border-blue-400 bg-blue-50/30' : 'hover:border-slate-200'}`}
                style={{ left: localConfig.headerLine3X, top: localConfig.headerLine3Y, minWidth: '300px' }}
                onMouseDown={(e) => { e.preventDefault(); setActiveDrag('line3'); }}
            >
                <input 
                  value={localConfig.headerLine3}
                  onChange={e => setLocalConfig({...localConfig, headerLine3: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-0 text-slate-400 font-medium uppercase text-center"
                  style={{ fontSize: `${localConfig.fontSize3}px` }}
                />
            </div>
          </div>
        </div>
      </section>

      {/* Controles Auxiliares (Tipografia e Tamanhos) */}
      <div className="grid lg:grid-cols-2 gap-8">
        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
            <i className="fas fa-text-height text-blue-500"></i> Tamanho das Fontes (PX)
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Linha {i}</label>
                <input 
                  type="number" 
                  value={(localConfig as any)[`fontSize${i}`]} 
                  onChange={e => setLocalConfig({...localConfig, [`fontSize${i}`]: parseInt(e.target.value) || 0})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none font-black text-blue-600 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-slate-50">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block text-center">Ajuste Fino de Largura da Logo</label>
                <input 
                  type="number" 
                  value={localConfig.reportLogoWidth} 
                  onChange={e => setLocalConfig({...localConfig, reportLogoWidth: parseInt(e.target.value) || 0})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none font-black text-slate-800 text-center"
                />
          </div>
        </section>

        <section className="bg-[#005a9c] p-8 rounded-[2.5rem] shadow-xl text-white flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="relative z-10 space-y-3">
                <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-blue-200">
                    <i className="fas fa-info-circle"></i> Instruções de Edição
                </h4>
                <p className="text-sm font-medium leading-relaxed opacity-90 italic">
                    "Clique e arraste diretamente no topo da página branca acima para posicionar a logo e cada linha de texto. O limite inferior pontilhado marca onde o conteúdo do relatório começará a ser impresso."
                </p>
            </div>
        </section>
      </div>

      {/* Listas Mestres */}
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tighter uppercase">
          <i className="fas fa-database text-emerald-500"></i> Gerenciar Listas
        </h2>
        <div className="grid md:grid-cols-2 gap-10">
          {['HAB', 'HABA'].map(unit => (
            <div key={unit} className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                <div className={`w-3 h-3 rounded-full ${unit === 'HAB' ? 'bg-blue-500' : 'bg-indigo-500'}`}></div>
                <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm">Listas Unidade {unit}</h3>
              </div>
              <div className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-[0.2em]">Setores Ativos</label>
                  <textarea value={(lists as any)[`sectors${unit}`]} onChange={e => setLists({...lists, [`sectors${unit}`]: e.target.value})} className="w-full h-40 p-5 bg-slate-50 rounded-3xl border-none font-bold text-sm no-scrollbar resize-none focus:ring-2 focus:ring-blue-100 shadow-inner" placeholder="Um setor por linha..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-[0.2em]">Nomes dos PGs</label>
                  <textarea value={(lists as any)[`groups${unit}`]} onChange={e => setLists({...lists, [`groups${unit}`]: e.target.value})} className="w-full h-40 p-5 bg-slate-50 rounded-3xl border-none font-bold text-sm no-scrollbar resize-none focus:ring-2 focus:ring-blue-100 shadow-inner" placeholder="Um grupo por linha..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-[0.2em]">Equipe de Colaboradores</label>
                  <textarea value={(lists as any)[`staff${unit}`]} onChange={e => setLists({...lists, [`staff${unit}`]: e.target.value})} className="w-full h-40 p-5 bg-slate-50 rounded-3xl border-none font-bold text-sm no-scrollbar resize-none focus:ring-2 focus:ring-blue-100 shadow-inner" placeholder="Um nome por linha..." />
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
