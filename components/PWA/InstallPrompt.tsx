
import React, { useEffect, useState } from 'react';

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Previne que o navegador mostre o prompt padrão imediatamente
      e.preventDefault();
      // Salva o evento para disparar depois
      setDeferredPrompt(e);
      // Mostra nosso botão personalizado
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostra o prompt nativo
    deferredPrompt.prompt();

    // Espera o usuário responder
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuário aceitou a instalação do PWA');
    } else {
      console.log('Usuário recusou a instalação');
    }

    // Limpa o prompt, pois ele só pode ser usado uma vez
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  if (!showInstallBtn) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-500"
    >
      <i className="fas fa-download"></i>
      <span className="hidden sm:inline">Instalar App</span>
    </button>
  );
};

export default InstallPrompt;
