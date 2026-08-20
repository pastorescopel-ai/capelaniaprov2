
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useToast } from '../contexts/ToastContext';

const DISMISS_KEY = 'capelania_notification_banner_dismissed_at';
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 5000; // Um pouco depois do banner de instalar o app, pra não empilhar os dois na cara assim que a tela carrega.

const wasRecentlyDismissed = () => {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const elapsedDays = (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24);
  return elapsedDays < DISMISS_DAYS;
};

// Convite pra ativar o lembrete diário, direto na tela principal -- antes só dava pra achar
// isso entrando em Perfil. Fica no canto inferior esquerdo (o de instalar o app já usa o
// direito) pra não empilhar os dois banners um em cima do outro. Só aparece pra quem já está
// logado (a inscrição de notificação é vinculada ao usuário).
const NotificationPromptBanner: React.FC = () => {
  const { isSupported, isSubscribed, isStatusLoading, isBusy, subscribe } = usePushNotifications();
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);

  const isIOSNotStandalone = typeof window !== 'undefined'
    && /iphone|ipad|ipod/i.test(navigator.userAgent)
    && !((window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches);

  // No iPhone/iPad sem o app instalado ainda, a notificação não funciona de jeito nenhum
  // (regra da Apple) -- não adianta convidar pra ativar algo que vai falhar. !isStatusLoading
  // evita mostrar o convite baseado num "ainda não sei se está inscrito" (isSubscribed começa
  // false até a checagem assíncrona terminar) -- sem isso, logo após um "Atualizar Agora" o
  // banner podia aparecer sozinho por uns segundos, mesmo com a notificação já ativada.
  const eligible = isSupported && !isStatusLoading && !isSubscribed && !isIOSNotStandalone;

  useEffect(() => {
    if (!eligible || wasRecentlyDismissed()) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleActivate = async () => {
    const result = await subscribe();
    if (result.success) {
      showToast('Lembrete diário ativado! Você vai receber um aviso às 12h e às 18h.', 'success');
      setVisible(false);
    } else {
      showToast(result.error || 'Não foi possível ativar as notificações agora.', 'error');
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          // No celular existe uma barra de navegação fixa embaixo (ver Layout.tsx) -- bottom-4
          // fazia esse card ficar espremido/sobreposto em cima dela. bottom-24 abre espaço
          // suficiente pra ficar por cima da barra, não colado nela; no desktop não tem essa
          // barra, então volta pro respiro normal.
          className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-[250] w-[calc(100vw-2rem)] max-w-xs bg-white rounded-3xl shadow-2xl border border-slate-100 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 flex-shrink-0 rounded-2xl bg-[#005a9c] flex items-center justify-center text-white shadow-lg">
              <i className="fas fa-bell text-sm"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Ativar Lembrete Diário</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Aviso às 12h e 18h pra não esquecer de registrar suas atividades.</p>
              <button
                onClick={handleActivate}
                disabled={isBusy}
                className={`mt-3 w-full py-2.5 bg-[#005a9c] hover:bg-[#004a80] text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${isBusy ? 'opacity-60 cursor-wait' : ''}`}
              >
                <i className="fas fa-bell"></i>
                {isBusy ? 'Aguarde...' : 'Ativar Agora'}
              </button>
            </div>
            <button onClick={dismiss} className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0" aria-label="Fechar">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationPromptBanner;
