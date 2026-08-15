
import { useState, useEffect, useCallback } from 'react';

// iPadOS 13+ se identifica como "MacIntel" no userAgent -- só dá pra distinguir de um Mac de
// verdade pelo suporte a toque (maxTouchPoints > 1), que nenhum Mac com mouse/trackpad tem.
const isIOSDevice = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Safari de verdade (não Chrome/Firefox/Edge rodando no Mac, que também têm "Safari" no
// userAgent por herança, mas incluem o nome deles também). No iOS todo navegador usa o motor
// do Safari por baixo (regra da Apple) e por isso também nunca dispara beforeinstallprompt --
// mas ali quem decide o caminho é isIOSDevice(); esta função aqui é só para o Safari de
// desktop no Mac, que tem instrução de instalação própria e diferente (Adicionar ao Dock).
const isRealSafari = () => {
  const ua = navigator.userAgent;
  return /^((?!chrome|android|crios|fxios|edgios|opios).)*safari/i.test(ua);
};

const isMacDesktop = () => navigator.platform === 'MacIntel' && navigator.maxTouchPoints <= 1;

const isStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // @ts-ignore -- propriedade não-padrão exclusiva do Safari/iOS
  window.navigator.standalone === true;

// Hook de instalação do PWA. Nenhum navegador tem uma API universal pra "instalar o app" --
// Android/Chrome/Edge disparam o evento `beforeinstallprompt`, que dá pra capturar e reusar
// num botão próprio. O Safari NUNCA dispara esse evento, em nenhuma plataforma -- nem no iOS
// (onde todo navegador usa o motor do Safari por baixo, regra da Apple) nem no Safari de
// desktop no Mac. Em ambos só dá pra mostrar o passo manual, nunca instalar programaticamente
// -- e o passo é DIFERENTE em cada um (iOS: Compartilhar > Adicionar à Tela de Início: macOS
// Safari: Arquivo > Adicionar ao Dock).
export const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode());
  const [isIOS] = useState(isIOSDevice());
  const [isMacSafari] = useState(() => isRealSafari() && isMacDesktop() && !isIOSDevice());

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
    isMacSafari,
    canPromptInstall: !!deferredPrompt, // Android/Chrome/Edge -- instala com 1 clique de verdade
    canShowIOSInstructions: isIOS && !isInstalled, // iPhone/iPad -- só dá pra mostrar o passo a passo
    canShowMacSafariInstructions: isMacSafari && !isInstalled, // Safari no Mac -- idem, passo diferente
    promptInstall
  };
};
