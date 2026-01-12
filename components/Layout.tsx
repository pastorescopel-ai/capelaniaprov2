
import React from 'react';
import { NAV_ITEMS, APP_LOGO_BASE64 } from '../constants';
import { UserRole, Config } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  isSyncing: boolean;
  isConnected: boolean;
  config: Config;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, userRole, isSyncing, isConnected, config, onLogout }) => {
  const visibleNavItems = NAV_ITEMS.filter(item => item.roles.includes(userRole));

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <header className="h-16 md:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-40 shadow-sm flex-shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center overflow-hidden h-10 md:h-12 min-w-[40px]">
            {APP_LOGO_BASE64 ? (
              <img src={APP_LOGO_BASE64} className="h-full w-auto object-contain" alt="Logo" />
            ) : (
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <i className="fas fa-hospital-symbol text-[#005a9c] text-xl"></i>
              </div>
            )}
          </div>
          <span className="font-black text-lg md:text-xl text-slate-800 tracking-tighter uppercase whitespace-nowrap">
            Capelania <span className="text-[#005a9c]">Pro</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {isConnected && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest hidden sm:inline">Sistema Online</span>
            </div>
          )}
          
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 font-black text-[10px] md:text-xs uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200">
          <nav className="flex-1 px-4 py-6 space-y-1">
            {visibleNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all ${
                  activeTab === item.id 
                    ? 'bg-[#005a9c] text-white shadow-xl shadow-blue-200' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-bold text-sm tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-6 border-t border-slate-100 flex items-center justify-center">
             {APP_LOGO_BASE64 && <img src={APP_LOGO_BASE64} className="h-8 opacity-20 grayscale hover:grayscale-0 transition-all cursor-help" alt="Logo Footer" />}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8 no-scrollbar">
            {children}
          </div>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-3 flex justify-between items-center z-50 shadow-2xl">
        <div className="flex w-full overflow-x-auto no-scrollbar space-x-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 min-w-[72px] flex flex-col items-center py-2 rounded-2xl transition-all ${
                activeTab === item.id ? 'text-[#005a9c] bg-blue-50/50' : 'text-slate-400'
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      
      {isSyncing && (
        <div className="md:hidden fixed top-20 right-4 bg-white/80 backdrop-blur-sm shadow-xl rounded-full p-2 border border-blue-100 z-50">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#005a9c] border-t-transparent"></div>
        </div>
      )}
    </div>
  );
};

export default Layout;
