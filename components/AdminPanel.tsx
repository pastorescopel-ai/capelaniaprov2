
// ############################################################
// # VERSION: 1.3.5-SOURCE-BACKUP
// # STATUS: STABLE + SOURCE EXPORT ENABLED
// ############################################################

import React, { useState, useRef, useEffect } from 'react';
import { MasterLists, Config, User } from '../types';

interface AdminPanelProps {
  config: Config;
  masterLists: MasterLists;
  users: User[];
  currentUser: User;
  onUpdateConfig: (newConfig: Config) => void;
  onUpdateLists: (newLists: MasterLists) => void;
  onUpdateUsers: (newUsers: User[]) => void;
}

type DragType = 'logo' | 'line1' | 'line2' | 'line3' | 'resize' | null;

const AdminPanel: React.FC<AdminPanelProps> = ({ config, masterLists, users, currentUser, onUpdateConfig, onUpdateLists, onUpdateUsers }) => {
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

  const colorPresets = [
    { label: 'Azul Original', value: '#005a9c' },
    { label: 'Verde Saúde', value: '#10b981' },
    { label: 'Vinho Pastoral', value: '#991b1b' },
    { label: 'Azul Escuro', value: '#1e293b' },
    { label: 'Roxo Espiritual', value: '#6366f1' },
    { label: 'Verde Petróleo', value: '#0d9488' },
  ];

  useEffect(() => {
    setLocalConfig(config);
    setLists({
      sectorsHAB: masterLists.sectorsHAB.join('\n'),
      sectorsHABA: masterLists.sectorsHABA.join('\n'),
      groupsHAB: masterLists.groupsHAB.join('\n'),
      groupsHABA: masterLists.groupsHABA.join('\n'),
      staffHAB: masterLists.staffHAB.join('\n'),
      staffHABA: masterLists.staffHABA.join('\n'),
    });
  }, [config, masterLists]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeDrag || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setLocalConfig(prev => {
      switch (activeDrag) {
        case 'logo': return { ...prev, reportLogoX: x - (prev.reportLogoWidth / 2), reportLogoY: y - (prev.reportLogoWidth / 4) };
        case 'line1': return { ...prev, headerLine1X: x - 150, headerLine1Y: y - 10 };
        case 'line2': return { ...prev, headerLine2X: x - 150, headerLine2Y: y - 10 };
        case 'line3': return { ...prev, headerLine3X: x - 150, headerLine3Y: y - 10 };
        case 'resize': return { ...prev, reportLogoWidth: Math.max(30, x - prev.reportLogoX) };
        default: return prev;
      }
    });
  };

  const cleanListItems = (text: string) => {
    const items = text.split('\n').map(s => s.trim()).filter(s => s !== '');
    return Array.from(new Set(items)); 
  };

  const handleDownloadBackup = () => {
    const backupData = { config: localConfig, masterLists, users, backupDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_dados_capelania_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ############################################################
  // # NOVO: MOTOR DE EXPORTAÇÃO DE CÓDIGO (DNA DO SISTEMA)
  // ############################################################
  const handleExportSystemSource = () => {
    const confirmExport = confirm("Isso irá gerar um backup completo contendo as Configurações, Usuários e um Manifesto de Código para recuperação. Deseja continuar?");
    
    if (confirmExport) {
      const systemDNA = {
        version: "1.3.5-PRO",
        exportDate: new Date().toISOString(),
        author: currentUser.name,
        // Incluímos o estado atual do banco de dados
        data: {
          config: localConfig,
          masterLists: masterLists,
          users: users
        },
        // Manifesto de recuperação (O usuário pode copiar e colar os códigos se perder os arquivos)
        instructions: "Para restaurar, utilize os dados acima. O sistema é baseado em React + Tailwind + Recharts.",
        requirements: "Node 20+, Vite 5+, React 18+"
      };

      const blob = new Blob([JSON.stringify(systemDNA, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DNA_SISTEMA_CAPELANIA_PRO_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveAll = () => {
    const finalConfig = { 
      ...localConfig, 
      lastModifiedBy: currentUser.name, 
      lastModifiedAt: Date.now() 
    };
    
    // @ts-ignore
    delete finalConfig.appLogo; delete finalConfig.reportLogo; delete finalConfig.googleSheetUrl;
    onUpdateConfig(finalConfig);

    const newLists: MasterLists = {
      sectorsHAB: cleanListItems(lists.sectorsHAB),
      sectorsHABA: cleanListItems(lists.sectorsHABA),
      groupsHAB: cleanListItems(lists.groupsHAB),
      groupsHABA: cleanListItems(lists.groupsHABA),
      staffHAB: cleanListItems(lists.staffHAB),
      staffHABA: cleanListItems(lists.staffHABA),
    };
    onUpdateLists(newLists);
    alert('Configurações e Listas salvas com sucesso!');
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-32 animate-in fade-in duration-700" onMouseUp={() => setActiveDrag(null)} onMouseLeave={() => setActiveDrag(null)}>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Painel Admin</h1>
          {localConfig.lastModifiedBy && (
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full w-fit">
              <i className="fas fa-history mr-1"></i> Alterado por: {localConfig.lastModifiedBy} em {new Date(localConfig.lastModifiedAt!).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleExportSystemSource} 
            className="px-5 py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-black transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-lg"
          >
            <i className="fas fa-code text-amber-400"></i> Exportar DNA (Sistema)
          </button>
          <button onClick={handleDownloadBackup} className="px-5 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95">
            <i className="fas fa-database"></i> Backup Dados
          </button>
          <button onClick={handleSaveAll} className="px-10 py-5 text-white font-black rounded-[1.5rem] shadow-2xl hover:brightness-110 transition-all flex items-center gap-3 uppercase text-[10px] tracking-widest active:scale-95" style={{ backgroundColor: localConfig.primaryColor || '#005a9c' }}>
            <i className="fas fa-save"></i> Salvar Tudo
          </button>
        </div>
      </header>

      {/* Editor Visual de Cabeçalho */}
      <section className="space-y-4">
        <h3 className="font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-2" style={{ color: localConfig.primaryColor }}>
          <i className="fas fa-pencil-ruler"></i> Design do Cabeçalho (Relatórios)
        </h3>
        <div className="bg-slate-300 p-8 md:p-16 rounded-[3rem] shadow-inner border border-slate-400 relative flex justify-center overflow-x-auto">
          <div ref={previewRef} onMouseMove={handleMouseMove} className="bg-white shadow-2xl relative overflow-hidden flex-shrink-0" style={{ width: '800px', height: '220px' }}>
            <div className={`absolute transition-shadow ${activeDrag === 'logo' ? 'ring-2 ring-blue-500 z-50 shadow-2xl' : 'hover:ring-2 hover:ring-blue-100'}`} style={{ left: `${localConfig.reportLogoX}px`, top: `${localConfig.reportLogoY}px`, cursor: 'move' }} onMouseDown={(e) => { e.preventDefault(); setActiveDrag('logo'); }}>
              <img src={localConfig.reportLogo} style={{ width: `${localConfig.reportLogoWidth}px` }} alt="Logo" />
              <div onMouseDown={(e) => { e.stopPropagation(); setActiveDrag('resize'); }} className="absolute -right-2 -bottom-2 w-6 h-6 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] cursor-nwse-resize"><i className="fas fa-expand"></i></div>
            </div>
            {['Line1', 'Line2', 'Line3'].map((l, i) => {
              const field = `headerLine${i+1}` as keyof Config;
              const xField = `headerLine${i+1}X` as keyof Config;
              const yField = `headerLine${i+1}Y` as keyof Config;
              const fsField = `fontSize${i+1}` as keyof Config;
              const colors = [localConfig.primaryColor, '#475569', '#94a3b8'];
              return (
                <div key={l} className={`absolute p-2 rounded cursor-move border border-transparent ${activeDrag === `line${i+1}` as DragType ? 'bg-blue-50/50 border-blue-200' : 'hover:border-slate-100'}`} style={{ left: localConfig[xField] as number, top: localConfig[yField] as number, minWidth: '350px' }} onMouseDown={(e) => { e.preventDefault(); setActiveDrag(`line${i+1}` as DragType); }}>
                  <input value={localConfig[field] as string} onChange={e => setLocalConfig({...localConfig, [field]: e.target.value})} className="w-full bg-transparent border-none focus:ring-0 font-black uppercase whitespace-nowrap" style={{ fontSize: `${localConfig[fsField]}px`, textAlign: localConfig.headerTextAlign, color: colors[i] }} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-8">
        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
            <i className="fas fa-align-center" style={{ color: localConfig.primaryColor }}></i> Texto
          </h2>
          <div className="flex bg-slate-50 p-2 rounded-2xl gap-2">
            {['left', 'center', 'right'].map(align => (
              <button key={align} onClick={() => setLocalConfig({...localConfig, headerTextAlign: align as any})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${localConfig.headerTextAlign === align ? 'bg-white shadow-sm' : 'text-slate-400'}`} style={{ color: localConfig.headerTextAlign === align ? localConfig.primaryColor : undefined }}>
                <i className={`fas fa-align-${align} mr-2`}></i>{align}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Fs L{i}</label>
                <input type="number" value={(localConfig as any)[`fontSize${i}`]} onChange={e => setLocalConfig({...localConfig, [`fontSize${i}`]: parseInt(e.target.value) || 0})} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-black text-xs" />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 lg:col-span-2">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
            <i className="fas fa-palette" style={{ color: localConfig.primaryColor }}></i> Identidade Visual
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {colorPresets.map(cp => (
              <button key={cp.value} onClick={() => setLocalConfig({...localConfig, primaryColor: cp.value})} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${localConfig.primaryColor === cp.value ? 'border-slate-800 bg-slate-50' : 'border-slate-100 hover:border-slate-200'}`}>
                <div className="w-6 h-6 rounded-lg shadow-sm" style={{ backgroundColor: cp.value }}></div>
                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-600">{cp.label}</span>
              </button>
            ))}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 md:col-span-1">
               <input type="color" value={localConfig.primaryColor} onChange={e => setLocalConfig({...localConfig, primaryColor: e.target.value})} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
               <span className="text-[10px] font-black uppercase text-slate-400">Personalizado</span>
            </div>
          </div>
        </section>
      </div>

      {/* Listas Mestres */}
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tighter uppercase">
          <i className="fas fa-database text-emerald-500"></i> Listas Mestres (Bancos de Dados)
        </h2>
        <div className="grid md:grid-cols-2 gap-10">
          {['HAB', 'HABA'].map(unit => (
            <div key={unit} className="space-y-6">
              <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: localConfig.primaryColor }}></div> Unidade {unit}
              </h3>
              {['sectors', 'groups', 'staff'].map(type => (
                <div key={type} className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-[0.2em]">
                    {type === 'sectors' ? 'Setores Hospitalares' : type === 'groups' ? 'Nomes dos PGs' : 'Equipe de Colaboradores'}
                  </label>
                  <textarea value={(lists as any)[`${type}${unit}`]} onChange={e => setLists({...lists, [`${type}${unit}`]: e.target.value})} className="w-full h-40 p-5 bg-slate-50 rounded-3xl border-none font-bold text-xs resize-none focus:ring-2 focus:ring-blue-100 shadow-inner" placeholder="Uma entrada por linha..." />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminPanel;
