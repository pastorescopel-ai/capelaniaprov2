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
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isResizingLogo, setIsResizingLogo] = useState(false);
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
    if (!isDraggingLogo && !isResizingLogo && !isDraggingText) return;
    if (!previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    if (isDraggingLogo) {
      setLocalConfig(prev => ({
        ...prev,
        reportLogoX: x - (prev.reportLogoWidth / 2),
        reportLogoY: Math.max(0, y - 20) // Impede de sair para cima
      }));
    } else if (isResizingLogo) {
      const newWidth = Math.max(30, x - localConfig.reportLogoX);
      setLocalConfig(prev => ({
        ...prev,
        reportLogoWidth: newWidth
      }));
    } else if (isDraggingText) {
      // Ajusta o Padding Top (Margem do texto)
      const newPadding = Math.max(0, y);
      setLocalConfig(prev => ({
        ...prev,
        headerPaddingTop: newPadding
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingLogo(false);
    setIsDraggingText(false);
    setIsResizingLogo(false);
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

      {/* Editor Visual de Cabeçalho - Simulação Real A4 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-6">
          <h3 className="text-[#005a9c] font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2">
            <i className="fas fa-pencil-ruler"></i> Editor de Cabeçalho (Visualize o topo real da página A4)
          </h3>
          <div className="flex gap-4 text-[10px] font-bold text-slate-400">
            <span>Alinhamento: <span className="text-slate-800 capitalize">{localConfig.headerTextAlign}</span></span>
            <span>Espaçamento Topo: <span className="text-slate-800">{localConfig.headerPaddingTop}px</span></span>
          </div>
        </div>

        <div className="bg-slate-300 p-6 md:p-16 rounded-[4rem] shadow-inner border border-slate-400 relative">
            {/* Indicador de extremidade superior */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-50">
                Extremidade Superior do Papel (Limite A4)
            </div>

          <div 
            ref={previewRef}
            onMouseMove={handleMouseMove}
            className="bg-white mx-auto shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] relative overflow-hidden border-t-2 border-slate-100"
            style={{ width: '100%', maxWidth: '800px', minHeight: '550px' }}
          >
            {/* Linha de Base do Cabeçalho (Apenas visual para o admin) */}
            <div className="absolute top-[180px] left-0 right-0 border-b border-dashed border-slate-200 pointer-events-none"></div>
            <div className="absolute top-0 left-0 bottom-0 border-r border-dashed border-slate-100 pointer-events-none w-1/2"></div>

            {/* Logo Draggable */}
            <div 
              className={`absolute transition-shadow duration-200 ${isDraggingLogo ? 'ring-2 ring-blue-500 shadow-2xl z-50' : 'hover:ring-2 hover:ring-blue-200'}`}
              style={{ 
                left: `${localConfig.reportLogoX}px`, 
                top: `${localConfig.reportLogoY}px`,
                cursor: isResizingLogo ? 'nwse-resize' : 'move'
              }}
            >
              <img 
                src={localConfig.reportLogo} 
                style={{ width: `${localConfig.reportLogoWidth}px`, display: 'block' }} 
                alt="Logo" 
                onMouseDown={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
              />
              <div 
                onMouseDown={(e) => { e.stopPropagation(); setIsResizingLogo(true); }}
                className="absolute -right-2 -bottom-2 w-6 h-6 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] cursor-nwse-resize shadow-lg"
              >
                <i className="fas fa-expand"></i>
              </div>
            </div>

            {/* Área de Texto com Arraste de Margem e Edição Direta */}
            <div 
              className="w-full relative group"
              style={{ 
                textAlign: localConfig.headerTextAlign, 
                paddingTop: `${localConfig.headerPaddingTop}px` 
              }}
            >
              {/* Alça de arraste da margem superior */}
              <div 
                onMouseDown={() => setIsDraggingText(true)}
                className="absolute top-0 left-0 right-0 h-8 bg-blue-500/0 hover:bg-blue-500/10 cursor-ns-resize flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                title="Arraste para ajustar a margem superior"
              >
                <div className="w-32 h-1.5 bg-blue-500/50 rounded-full"></div>
                <span className="absolute -top-6 bg-blue-600 text-white text-[8px] px-2 py-1 rounded font-black uppercase">Arraste para mover o texto</span>
              </div>

              {/* Inputs de Texto In-Place */}
              <div className="px-10 space-y-2">
                <input 
                  value={localConfig.headerLine1}
                  onChange={e => setLocalConfig({...localConfig, headerLine1: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-4 focus:ring-blue-100 text-[#005a9c] font-black uppercase text-center focus:text-left hover:bg-slate-50 transition-all rounded-xl p-2"
                  style={{ fontSize: `${localConfig.fontSize1}px`, textAlign: localConfig.headerTextAlign }}
                />
                <input 
                  value={localConfig.headerLine2}
                  onChange={e => setLocalConfig({...localConfig, headerLine2: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-4 focus:ring-blue-100 text-slate-500 font-bold uppercase text-center focus:text-left hover:bg-slate-50 transition-all rounded-xl p-2"
                  style={{ fontSize: `${localConfig.fontSize2}px`, textAlign: localConfig.headerTextAlign }}
                />
                <input 
                  value={localConfig.headerLine3}
                  onChange={e => setLocalConfig({...localConfig, headerLine3: e.target.value})}
                  className="w-full bg-transparent border-none focus:ring-4 focus:ring-blue-100 text-slate-400 font-medium uppercase text-center focus:text-left hover:bg-slate-50 transition-all rounded-xl p-2"
                  style={{ fontSize: `${localConfig.fontSize3}px`, textAlign: localConfig.headerTextAlign }}
                />
              </div>
            </div>
            
            {/* Sombra para indicar continuidade da página */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none flex items-end justify-center pb-4">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Continuidade do Relatório...</span>
            </div>
          </div>
        </div>
      </section>

      {/* Controles de Estilo e Alinhamento */}
      <div className="grid lg:grid-cols-2 gap-8">
        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
            <i className="fas fa-text-height text-blue-500"></i> Tamanho das Fontes
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Linha {i}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={(localConfig as any)[`fontSize${i}`]} 
                    onChange={e => setLocalConfig({...localConfig, [`fontSize${i}`]: parseInt(e.target.value) || 0})}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-black text-blue-600 focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300">PX</span>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-slate-50">
            <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-2 block">Alinhamento do Texto</label>
            <div className="flex gap-2">
              {['left', 'center', 'right'].map(align => (
                <button 
                  key={align}
                  onClick={() => setLocalConfig({...localConfig, headerTextAlign: align as any})}
                  className={`flex-1 py-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 ${localConfig.headerTextAlign === align ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-50 text-slate-400 bg-slate-50 hover:bg-slate-100'}`}
                >
                  <i className={`fas fa-align-${align}`}></i>
                  <span className="text-[10px] font-black uppercase">{align === 'left' ? 'Esquerda' : align === 'center' ? 'Centro' : 'Direita'}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-center">
            <div className="p-6 bg-blue-50 rounded-3xl border-2 border-blue-100 space-y-3">
                <h4 className="text-blue-800 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-info-circle"></i> Dica de Designer
                </h4>
                <p className="text-blue-600 text-sm font-medium leading-relaxed italic">
                    "O editor acima simula a borda superior real da folha. Use o arraste de margem (Padding) para descer o texto caso a logo seja muito alta ou para centralizar verticalmente no topo."
                </p>
            </div>
        </section>
      </div>

      {/* Listas Mestres */}
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tighter uppercase">
          <i className="fas fa-database text-emerald-500"></i> Dados do Sistema
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