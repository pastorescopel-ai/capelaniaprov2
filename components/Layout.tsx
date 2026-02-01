import React from 'react';
import { NAV_ITEMS, APP_LOGO_BASE64 } from '../constants';
import { UserRole, Config } from '../types';
import NotificationCenter from './NotificationCenter';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: string;
  isSyncing: boolean;
  isConnected: boolean;
  isLabMode?: boolean;
  config: Config;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, userRole, isSyncing, isConnected, isLabMode, config, onLogout }) => {
  // Normalização da role para garantir match com NAV_ITEMS
  const normalizedRole = String(userRole || '').toUpperCase().trim();
  
  const visibleNavItems = NAV_ITEMS.filter(item => {
    // Se não houver roles definidas no item, mostra para todos
    if (!item.roles || item.roles.length === 0) return true;
    // Verifica se a role do usuário (ADMIN/CHAPLAIN) está na lista
    return item.roles.some(r => r.toUpperCase() === normalizedRole);
  });

  const logoSrc = config?.appLogoUrl || APP_LOGO_BASE64;

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden relative">
      <header className="h-16 md:h-20 solid-nav flex items-center justify-between px-4 md:px-8 z-[100] flex-shrink-0 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center overflow-hidden h-10 md:h-12 min-w-[40px]">
            {logoSrc ? (
              <img src={logoSrc} className="h-full w-auto object-contain" alt="Logo" />
            ) : (
              <div className="w-10 h-10 bg-[#005a9c] rounded-xl flex items-center justify-center shadow-lg">
                <i className="fas fa-hospital-symbol text-white text-xl"></i>
              </div>
            )}
          </div>
          <span className="font-black text-lg md:text-xl text-slate-800 tracking-tighter uppercase whitespace-nowrap">
            Capelania <span className="text-[#005a9c]">Pro</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {isLabMode && (
            <div className="bg-amber-100 px-3 py-1 rounded-full border border-amber-200 animate-pulse hidden lg:flex">
              <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Modo Lab</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {isConnected && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full border border-emerald-200">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest hidden sm:inline">Online</span>
              </div>
            )}

            {/* CENTRAL DE NOTIFICAÇÕES (Sininho) */}
            <NotificationCenter />
          </div>
          
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-100 text-rose-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 border border-rose-200"
          >
            <i className="fas fa-power-off"></i>
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden content-layer">
        {/* Barra Lateral Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 flex-shrink-0">
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar">
            {visibleNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-4 rounded-2xl transition-all ${
                  activeTab === item.id 
                    ? 'bg-[#005a9c] text-white shadow-lg' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-bold text-sm tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden">
          <div id="main-scroll-container" className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8 no-scrollbar animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>

      {/* Navegação Mobile (Bottom) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-3 flex justify-between items-center z-[100] shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex w-full overflow-x-auto no-scrollbar space-x-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 min-w-[72px] flex flex-col items-center py-2 rounded-2xl transition-all ${
                activeTab === item.id ? 'text-[#005a9c] bg-blue-50' : 'text-slate-400'
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;