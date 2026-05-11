
import React, { useState, useRef, useMemo } from 'react';
import { Config, HeaderProfile, HeaderLine } from '../../types';
import { DEFAULT_APP_LOGO } from '../../assets';

interface AdminHeaderEditorProps {
  config: Config;
  setConfig: (c: Config) => void;
}

type DragType = { type: 'logo' | 'line' | 'resize'; id?: string } | null;

const AdminHeaderEditor: React.FC<AdminHeaderEditorProps> = ({ config, setConfig }) => {
  const [activeProfileId, setActiveProfileId] = useState<string>('chaplaincy');
  const [activeDrag, setActiveDrag] = useState<DragType>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Garante que existam perfis (fallback para migração)
  const profiles = useMemo(() => {
    if (config.headerProfiles) return config.headerProfiles;
    
    // Fallback se não houver perfis ainda
    const defaultLines: HeaderLine[] = [
      { id: 'title', text: 'Título do Relatório', fontSize: config.fontSize1, color: config.primaryColor, x: config.headerLine1X, y: config.headerLine1Y, fontWeight: '900', textTransform: 'uppercase', width: 400 },
      { id: 'line1', text: config.headerLine1, fontSize: config.fontSize2, color: '#475569', x: config.headerLine2X, y: config.headerLine2Y, fontWeight: 'bold', textTransform: 'uppercase', width: 400 },
      { id: 'line2', text: config.headerLine2, fontSize: config.fontSize3, color: '#94a3b8', x: config.headerLine3X, y: config.headerLine3Y, fontWeight: 'normal', textTransform: 'uppercase', width: 400 }
    ];

    return {
      chaplaincy: { id: 'chaplaincy', name: 'Capelania', logoWidth: config.reportLogoWidth, logoX: config.reportLogoX, logoY: config.reportLogoY, paddingTop: config.headerPaddingTop, textAlign: config.headerTextAlign, lines: defaultLines },
      ambassadors: { id: 'ambassadors', name: 'Embaixadores', logoWidth: config.reportLogoWidth, logoX: config.reportLogoX, logoY: config.reportLogoY, paddingTop: config.headerPaddingTop, textAlign: config.headerTextAlign, lines: defaultLines },
      smallGroups: { id: 'smallGroups', name: 'Pequenos Grupos', logoWidth: config.reportLogoWidth, logoX: config.reportLogoX, logoY: config.reportLogoY, paddingTop: config.headerPaddingTop, textAlign: config.headerTextAlign, lines: defaultLines }
    };
  }, [config]);

  const currentProfile = profiles[activeProfileId] || profiles['chaplaincy'];
  const selectedLine = currentProfile.lines.find(l => l.id === selectedLineId);

  const updateProfile = (updates: Partial<HeaderProfile>) => {
    const newProfiles = { ...profiles, [activeProfileId]: { ...currentProfile, ...updates } };
    setConfig({ ...config, headerProfiles: newProfiles });
  };

  const updateLine = (lineId: string, updates: Partial<HeaderLine>) => {
    const newLines = currentProfile.lines.map(l => l.id === lineId ? { ...l, ...updates } : l);
    updateProfile({ lines: newLines });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    
    if (activeDrag.type === 'logo') {
      updateProfile({ logoX: x - (currentProfile.logoWidth / 2), logoY: y - (currentProfile.logoWidth / 4) });
    } else if (activeDrag.type === 'resize') {
      updateProfile({ logoWidth: Math.max(30, x - currentProfile.logoX) });
    } else if (activeDrag.type === 'line' && activeDrag.id) {
      // Offset para o arraste não pular
      updateLine(activeDrag.id, { x: x - 50, y: y - 15 });
    }
  };

  const addLine = () => {
    const newLine: HeaderLine = {
      id: `line-${Date.now()}`,
      text: 'Novo Texto',
      fontSize: 12,
      color: '#64748b',
      x: 200,
      y: 150,
      width: 300,
      fontWeight: 'normal',
      textTransform: 'none'
    };
    updateProfile({ lines: [...currentProfile.lines, newLine] });
    setSelectedLineId(newLine.id);
  };

  const removeLine = (id: string) => {
    updateProfile({ lines: currentProfile.lines.filter(l => l.id !== id) });
    if (selectedLineId === id) setSelectedLineId(null);
  };

  const resetPositions = () => {
    updateProfile({
      logoX: 40,
      logoY: 20,
      logoWidth: 100,
      textAlign: 'center',
      lines: [
        { id: 'title', text: currentProfile.name, fontSize: 24, color: config.primaryColor, x: 147, y: 30, fontWeight: '900', textTransform: 'uppercase', width: 500 },
        { id: 'line1', text: 'Hospital Adventista de Belém', fontSize: 18, color: '#475569', x: 147, y: 60, fontWeight: 'bold', textTransform: 'uppercase', width: 500 },
        { id: 'line2', text: 'Departamento de Capelania', fontSize: 12, color: '#94a3b8', x: 147, y: 90, fontWeight: 'normal', textTransform: 'uppercase', width: 500 }
      ]
    });
  };

  return (
    <section className="space-y-6" onMouseUp={() => setActiveDrag(null)} onMouseLeave={() => setActiveDrag(null)}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h3 className="font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2" style={{ color: config.primaryColor }}>
            <i className="fas fa-pencil-ruler"></i> Editor de Cabeçalhos Multi-Perfil
          </h3>
          <p className="text-[9px] text-slate-400 font-bold uppercase">Personalize cada relatório individualmente</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {Object.values(profiles).map(p => (
            <button 
              key={p.id}
              onClick={() => { setActiveProfileId(p.id); setSelectedLineId(null); }}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeProfileId === p.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-200 p-8 md:p-12 rounded-[3rem] shadow-inner border border-slate-300 relative flex flex-col items-center gap-8 overflow-x-auto">
        <div 
          ref={previewRef} 
          onMouseMove={handleMouseMove} 
          className="bg-white shadow-2xl relative overflow-hidden flex-shrink-0 border border-slate-100" 
          style={{ width: '794px', height: '180px' }}
          onClick={(e) => { if(e.target === e.currentTarget) setSelectedLineId(null); }}
        >
          {/* GUIAS DE PRECISÃO */}
          {/* Linha de Centro */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-dashed border-blue-200 pointer-events-none z-0"></div>
          
          {/* Margens de Segurança (15mm = ~57px) */}
          <div className="absolute left-[57px] top-0 bottom-0 w-px border-l border-dotted border-slate-200 pointer-events-none z-0"></div>
          <div className="absolute right-[57px] top-0 bottom-0 w-px border-l border-dotted border-slate-200 pointer-events-none z-0"></div>

          {/* Linha Divisória do Cabeçalho (Simulação) */}
          <div className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none z-10" style={{ backgroundColor: config.primaryColor }}></div>

          {/* Âncora do Período (Simulação) */}
          <div className="absolute bottom-4 w-full pointer-events-none z-10" style={{ textAlign: currentProfile.textAlign }}>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-4">
              [ PERÍODO DO RELATÓRIO ]
            </p>
          </div>
          
          {/* LOGO DRAGGABLE */}
          <div 
            className={`absolute transition-shadow cursor-move ${activeDrag?.type === 'logo' ? 'ring-2 ring-blue-500 z-50 shadow-2xl' : 'hover:ring-2 hover:ring-blue-100'}`} 
            style={{ left: `${currentProfile.logoX}px`, top: `${currentProfile.logoY}px`, width: `${currentProfile.logoWidth}px` }} 
            onMouseDown={(e) => { e.preventDefault(); setActiveDrag({ type: 'logo' }); setSelectedLineId(null); }}
          >
            <img src={config.reportLogoUrl || DEFAULT_APP_LOGO} style={{ width: '100%', pointerEvents: 'none' }} alt="Logo" />
            <div 
              onMouseDown={(e) => { e.stopPropagation(); setActiveDrag({ type: 'resize' }); }} 
              className="absolute -right-2 -bottom-2 w-6 h-6 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] cursor-nwse-resize shadow-lg"
            >
              <i className="fas fa-expand"></i>
            </div>
          </div>

          {/* LINES DRAGGABLE */}
          <div>
            {currentProfile.lines.map((line) => (
              <div 
                key={line.id} 
                className={`absolute p-2 rounded cursor-move border-2 border-dashed group ${selectedLineId === line.id ? 'bg-blue-50/50 border-blue-400 z-10' : 'border-transparent hover:border-slate-200'}`} 
                style={{ left: line.x, top: line.y, width: line.width ? `${line.width}px` : 'auto', minWidth: '100px' }} 
                onMouseDown={(e) => { 
                  // Só inicia o arraste se não estiver clicando no input para digitar
                  if(e.target === e.currentTarget) { 
                    e.preventDefault(); 
                    setActiveDrag({ type: 'line', id: line.id }); 
                    setSelectedLineId(line.id);
                  } else {
                    setSelectedLineId(line.id);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <input 
                    value={line.text} 
                    onChange={e => updateLine(line.id, { text: e.target.value })} 
                    className="w-full bg-transparent border-none focus:ring-0 font-black outline-none cursor-text" 
                    style={{ 
                      fontSize: `${line.fontSize}px`, 
                      textAlign: currentProfile.textAlign, 
                      color: line.color, 
                      fontWeight: line.fontWeight,
                      fontStyle: line.fontStyle || 'normal',
                      textDecoration: line.textDecoration || 'none',
                      textTransform: line.textTransform || 'none',
                      fontFamily: line.fontFamily || 'inherit'
                    }} 
                  />
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeLine(line.id); }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity flex-shrink-0"
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CONTROLES ADICIONAIS */}
        <div className="w-full grid md:grid-cols-2 gap-6">
          {/* Painel de Configuração da Linha Selecionada */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            {selectedLine ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex justify-between items-center border-bottom border-slate-100 pb-2">
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Configuração da Linha</h4>
                  <button onClick={() => setSelectedLineId(null)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Tamanho</label>
                    <input 
                      type="number" 
                      value={selectedLine.fontSize} 
                      onChange={e => updateLine(selectedLine.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold border-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Largura da Caixa</label>
                    <input 
                      type="number" 
                      value={selectedLine.width || 300} 
                      onChange={e => updateLine(selectedLine.id, { width: parseInt(e.target.value) })}
                      className="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold border-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Cor</label>
                    <input 
                      type="color" 
                      value={selectedLine.color} 
                      onChange={e => updateLine(selectedLine.id, { color: e.target.value })}
                      className="w-full h-8 p-1 bg-slate-50 rounded-lg border-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Fonte</label>
                    <select 
                      value={selectedLine.fontFamily || 'sans-serif'} 
                      onChange={e => updateLine(selectedLine.id, { fontFamily: e.target.value })}
                      className="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold border-none focus:ring-1 focus:ring-blue-500 appearance-none"
                    >
                      <option value="sans-serif">Padrão</option>
                      <option value="'Inter', sans-serif">Inter</option>
                      <option value="'Georgia', serif">Georgia</option>
                      <option value="'Courier New', monospace">Courier</option>
                      <option value="'Arial', sans-serif">Arial</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => updateLine(selectedLine.id, { fontWeight: selectedLine.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className={`p-3 rounded-xl text-xs transition-all ${selectedLine.fontWeight === 'bold' || selectedLine.fontWeight === '900' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                    title="Negrito"
                  >
                    <i className="fas fa-bold"></i>
                  </button>
                  <button 
                    onClick={() => updateLine(selectedLine.id, { fontStyle: selectedLine.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    className={`p-3 rounded-xl text-xs transition-all ${selectedLine.fontStyle === 'italic' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                    title="Itálico"
                  >
                    <i className="fas fa-italic"></i>
                  </button>
                  <button 
                    onClick={() => updateLine(selectedLine.id, { textDecoration: selectedLine.textDecoration === 'underline' ? 'none' : 'underline' })}
                    className={`p-3 rounded-xl text-xs transition-all ${selectedLine.textDecoration === 'underline' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                    title="Sublinhado"
                  >
                    <i className="fas fa-underline"></i>
                  </button>
                  <button 
                    onClick={() => {
                      const next: any = { 'none': 'uppercase', 'uppercase': 'lowercase', 'lowercase': 'none' };
                      updateLine(selectedLine.id, { textTransform: next[selectedLine.textTransform || 'none'] });
                    }}
                    className={`p-3 rounded-xl text-xs transition-all ${selectedLine.textTransform && selectedLine.textTransform !== 'none' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                    title="Alternar Caixa"
                  >
                    <i className="fas fa-font"></i>
                    <span className="ml-1 text-[8px] font-black uppercase">
                      {selectedLine.textTransform || 'Abc'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2">
                <i className="fas fa-mouse-pointer text-slate-200 text-3xl"></i>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selecione uma linha no quadro acima para editar seu estilo.</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={addLine}
                className="py-3 bg-emerald-50 text-emerald-600 font-black rounded-xl uppercase text-[9px] tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-plus-circle"></i> Adicionar Texto
              </button>
              <button 
                onClick={resetPositions}
                className="py-3 bg-slate-50 text-slate-500 font-black rounded-xl uppercase text-[9px] tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-undo"></i> Resetar Perfil
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminHeaderEditor;
