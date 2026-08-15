
import { useState, useEffect, useCallback } from 'react';

// iPadOS 13+ se identifica como "MacIntel" no userAgent -- só dá pra distinguir de um Mac de
// verdade pelo suporte a toque (maxTouchPoints > 1), que nenhum Mac com mouse/trackpad tem.
const isIOSDevice = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // @ts-ignore -- propriedade não-padrão exclusiva do Safari/iOS
  window.navigator.standalone === true;

// Hook de instalação do PWA. Nenhum navegador tem uma API universal pra "instalar o app" --
// Android/Chrome/Edge disparam o evento `beforeinstallprompt`, que dá pra capturar e reusar
// num botão próprio; iOS (Safari e qualquer navegador ali, já que todos usam o motor do
// Safari por baixo) NUNCA dispara esse evento -- lá o único caminho é o manual (Compartilhar
// > Adicionar à Tela de Início), então só dá pra mostrar essa instrução, nunca instalar
// programaticamente.
export const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode());
  const [isIOS] = useState(isIOSDevice());

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    isInstalled,
    isIOS,
    canPromptInstall: !!deferredPrompt, // Android/Chrome/Edge -- instala com 1 clique de verdade
    canShowIOSInstructions: isIOS && !isInstalled, // iOS -- só dá pra mostrar o passo a passo
    promptInstall
  };
};
