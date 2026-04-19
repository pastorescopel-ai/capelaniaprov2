
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NAV_ITEMS } from '../constants';
import { DEFAULT_APP_LOGO } from '../assets';
import { UserRole, Config, User } from '../types';
import NotificationCenter from './NotificationCenter';
import InstallPrompt from './PWA/InstallPrompt';
import { PushNotificationManager } from './Shared/PushNotificationManager';
import { useScrollDetection } from '../hooks/useScrollDetection';
import { useKeyboardDetection } from '../hooks/useKeyboardDetection';
import { useGracePeriod } from '../hooks/useGracePeriod';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  isSyncing: boolean;
  isConnected: boolean;
  isLabMode?: boolean;
  config: Config;
  onLogout: () => void;
  onGoToReturnHistory?: (visit?: any) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, currentUser, isSyncing, isConnected, isLabMode, config, onLogout, onGoToReturnHistory }) => {
  // Normalização da role para garantir match com NAV_ITEMS
  const normalizedRole = String(currentUser?.role || '').toUpperCase().trim();
  
  // Hooks Customizados
  const isScrolled = useScrollDetection('main-scroll-container', 40);
  const isKeyboardOpen = useKeyboardDetection();
  const { timeLeft, isGracePeriod, isCritical, prevMonthName } = useGracePeriod(normalizedRole);

  // Gatilho para resetar scroll ao mudar de aba
  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [activeTab]);
  
  const visibleNavItems = NAV_ITEMS.filter(item => {
    // Se não houver roles definidas no item, mostra para todos
    if (!item.roles || item.roles.length === 0) return true;
    // Verifica se a role do usuário (ADMIN/CHAPLAIN) está na lista
    return item.roles.some(r => r.toUpperCase() === normalizedRole);
  });

  const logoSrc = config?.appLogoUrl || DEFAULT_APP_LOGO;

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden relative">
      <header className="h-[calc(3.5rem+env(safe-area-inset-top))] md:h-20 pt-[env(safe-area-inset-top)] solid-nav flex items-center justify-between px-4 md:px-8 z-[100] flex-shrink-0 shadow-sm">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="flex items-center justify-center overflow-hidden h-8 md:h-12 min-w-[32px] md:min-w-[40px]">
            {logoSrc ? (
              <img src={logoSrc} className="h-full w-auto object-contain" alt="Logo" />
            ) : (
              <div className="w-8 h-8 md:w-10 md:h-10 bg-[#005a9c] rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                <i className="fas fa-hospital-symbol text-white text-sm md:text-xl"></i>
              </div>
            )}
          </div>
          <span className="font-black text-sm md:text-xl text-slate-800 tracking-tighter uppercase whitespace-nowrap">
            Capelania <span className="text-[#005a9c]">HAB</span>
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* BOTÃO DE INSTALAÇÃO PWA */}
          <div className="hidden sm:block">
            <InstallPrompt />
          </div>

          {isLabMode && (
            <div className="bg-amber-100 px-2 py-0.5 md:px-3 md:py-1 rounded-full border border-amber-200 animate-pulse hidden lg:flex">
              <span className="text-[8px] md:text-[9px] font-black text-amber-700 uppercase tracking-widest">Modo Lab</span>
            </div>
          )}
          
          <div className="flex items-center gap-1 md:gap-2">
            {isConnected && (
              <div className="flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-4 md:py-2 bg-emerald-100 rounded-full border border-emerald-200">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-[8px] md:text-[10px] font-black text-emerald-700 uppercase tracking-widest hidden sm:inline">Online</span>
              </div>
            )}

            {/* CENTRAL DE NOTIFICAÇÕES (Sininho) */}
            <NotificationCenter onGoToReturnHistory={onGoToReturnHistory} />

            {/* AVATAR MOBILE (OPÇÃO 2 - MORPHED) */}
            <AnimatePresence>
              {isScrolled && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.5, x: 20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="md:hidden w-8 h-8 rounded-lg bg-[#005a9c] flex items-center justify-center text-white text-sm shadow-sm overflow-hidden flex-shrink-0 border border-white/20"
                >
                  {currentUser?.profilePic ? (
                    <img src={currentUser.profilePic} className="w-full h-full object-cover" alt="Perfil" />
                  ) : (
                    <i className="fas fa-user text-[10px]"></i>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <button 
            onClick={onLogout}
            className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-5 md:py-2.5 bg-rose-100 text-rose-600 font-black text-[9px] md:text-[10px] uppercase tracking-widest rounded-lg md:rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 border border-rose-200"
          >
            <i className="fas fa-power-off text-[10px] md:text-xs"></i>
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* GLOBAL SYSTEM BANNER */}
      {isGracePeriod && (
        <div className={`${isCritical ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-900'} px-3 py-1.5 md:px-4 md:py-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 md:gap-4 z-50 shadow-sm flex-shrink-0 animate-in slide-in-from-top-2`}>
          <div className="flex items-center gap-1.5 md:gap-2">
            <i className={`fas ${isCritical ? 'fa-exclamation-circle animate-pulse' : 'fa-clock'} text-xs md:text-sm`}></i>
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-center">
              Prazo para lançamentos de {prevMonthName}{timeLeft ? ' encerra em:' : ' se aproxima.'}
            </span>
          </div>
          {timeLeft && (
            <div className="flex items-center gap-1 md:gap-2 font-black text-[10px] md:text-xs bg-black/10 px-2 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg">
              <span>{timeLeft.days}d</span>
              <span>:</span>
              <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
              <span>:</span>
              <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
            </div>
          )}
        </div>
      )}

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

          {/* Perfil do Usuário Fixado na Sidebar */}
          <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white shadow-sm border border-slate-100 group transition-all hover:shadow-md">
              <div className="w-10 h-10 rounded-xl bg-[#005a9c] flex items-center justify-center text-white text-lg shadow-sm overflow-hidden flex-shrink-0">
                {currentUser?.profilePic ? (
                  <img src={currentUser.profilePic} className="w-full h-full object-cover" alt="Perfil" />
                ) : (
                  <i className="fas fa-user"></i>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-800 truncate uppercase tracking-tight">{currentUser?.name}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                  {currentUser?.role === UserRole.ADMIN ? 'Gestor' : currentUser?.role === UserRole.INTERN ? 'Estagiário' : 'Capelão'}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden">
          <div id="main-scroll-container" className="flex-1 overflow-y-auto p-3 md:p-6 pb-28 md:pb-6 no-scrollbar animate-in fade-in duration-500">
            {/* GERENCIADOR DE NOTIFICAÇÕES PUSH */}
            <PushNotificationManager />

            {/* IDENTIDADE MOBILE (OPÇÃO 3 - PILL STYLE) */}
            <AnimatePresence>
              {!isScrolled && (
                <motion.div 
                  initial={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className="md:hidden mb-4 flex justify-center sticky top-0 z-40"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white rounded-full shadow-sm border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-[#005a9c] flex items-center justify-center text-white text-[10px] shadow-sm overflow-hidden flex-shrink-0">
                      {currentUser?.profilePic ? (
                        <img src={currentUser.profilePic} className="w-full h-full object-cover" alt="Perfil" />
                      ) : (
                        <i className="fas fa-user"></i>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{currentUser?.name.split(' ')[0]}</span>
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        {currentUser?.role === UserRole.ADMIN ? 'Gestor' : currentUser?.role === UserRole.INTERN ? 'Estagiário' : 'Capelão'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {children}
          </div>
        </main>
      </div>

      {/* Navegação Mobile (Bottom) */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex justify-between items-center z-[100] shadow-[0_-4px_10px_rgba(0,0,0,0.05)] transition-transform duration-300 ${isKeyboardOpen ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="flex w-full overflow-x-auto no-scrollbar space-x-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 min-w-[64px] flex flex-col items-center py-1.5 rounded-xl transition-all ${
                activeTab === item.id ? 'text-[#005a9c] bg-blue-50' : 'text-slate-400'
              }`}
            >
              <span className="text-lg mb-0.5">{item.icon}</span>
              <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
