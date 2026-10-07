import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { isNotificationSoundEnabled, playNotificationChime, unlockNotificationAudio } from '../utils/notificationSound';

// Reforço dos lembretes quando o app está ABERTO e visível:
//  - o service worker (src/sw.ts) manda uma mensagem 'PUSH_RECEIVED' pra aba visível (e deixa a
//    notificação do sistema silenciosa, pra não tocar dois sons);
//  - aqui a gente toca o sinozinho (se a pessoa não desligou em Perfil) e mostra o aviso na tela.
// Também zera o número do ícone do app sempre que a pessoa volta pra ele.
const PushFeedback = () => {
  const { showToast } = useToast();

  useEffect(() => {
    // Libera o áudio na primeira interação -- sem isso o navegador bloqueia o som do aviso.
    const unlock = () => { unlockNotificationAudio(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const clearBadge = () => {
      try { (navigator as any).clearAppBadge?.(); } catch { /* sem suporte: ok */ }
    };
    clearBadge();
    const onVisible = () => { if (document.visibilityState === 'visible') clearBadge(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'PUSH_RECEIVED') return;
      const firm = data.urgency === 'firm';
      if (isNotificationSoundEnabled()) playNotificationChime(firm);
      showToast(`${data.title}: ${data.body}`, firm ? 'warning' : 'info', firm);
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [showToast]);

  return null;
};

export default PushFeedback;
