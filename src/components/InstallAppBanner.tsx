
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const DISMISS_KEY = 'capelania_install_banner_dismissed_at';
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 3000; // Aparece um pouco depois de carregar, não na cara logo de cara.

const wasRecentlyDismissed = () => {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const elapsedDays = (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24);
  return elapsedDays < DISMISS_DAYS;
};

// Banner "Instalar App" que funciona em qualquer navegador -- mas não da mesma forma em
// todos: no Android/Chrome/Edge o botão instala de verdade com 1 clique; no iOS (onde não
// existe API nenhuma pra isso) o botão abre o passo a passo manual (Compartilhar > Adicionar
// à Tela de Início). Fica escondido se o app já está instalado, ou se a pessoa já fechou o
// banner há menos de 14 dias.
const InstallAppBanner: React.FC = () => {
  const { isInstalled, isIOS, canPromptInstall, canShowIOSInstructions, promptInstall } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  const eligible = !isInstalled && (canPromptInstall || canShowIOSInstructions);

  useEffect(() => {
    if (!eligible || wasRecentlyDismissed()) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowIOSSteps(false);
  };

  const handleInstallClick = async () => {
    if (canPromptInstall) {
      const accepted = await promptInstall();
      if (accepted) setVisible(false);
      return;
    }
    if (isIOS) setShowIOSSteps(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[250] w-[calc(100vw-2rem)] max-w-xs bg-white rounded-3xl shadow-2xl border border-slate-100 p-4"
        >
          {!showIOSSteps ? (
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 flex-shrink-0 rounded-2xl bg-[#005a9c] flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-arrow-down text-sm"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Instalar Capelania Pro</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Acesso rápido direto da sua tela inicial.</p>
                <button
                  onClick={handleInstallClick}
                  className="mt-3 w-full py-2.5 bg-[#005a9c] hover:bg-[#004a80] text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-download"></i>
                  Instalar App Agora
                </button>
              </div>
              <button onClick={dismiss} className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0" aria-label="Fechar">
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Como instalar no iPhone/iPad</p>
                <button onClick={dismiss} className="text-slate-300 hover:text-slate-500 transition-colors" aria-label="Fechar">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <ol className="space-y-2 text-[11px] font-bold text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 flex-shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">1</span>
                  Toque no ícone Compartilhar <i className="fas fa-arrow-up-from-bracket text-slate-400"></i> na barra do Safari
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 flex-shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">2</span>
                  Escolha "Adicionar à Tela de Início"
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 flex-shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">3</span>
                  Toque em "Adicionar"
                </li>
              </ol>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallAppBanner;
