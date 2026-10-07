
import React, { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useToast } from '../contexts/ToastContext';
import { isNotificationSoundEnabled, setNotificationSoundEnabled, playNotificationChime, unlockNotificationAudio } from '../utils/notificationSound';

// Card de ativação do lembrete diário (push, 12h e 18h). Mostrado na tela de Perfil. No
// iPhone/iPad só aparece disponível se o app já foi instalado na tela de início -- é regra
// da própria Apple, não dá pra contornar (Safari não expõe a API de push pra uma aba comum).
const NotificationSettings: React.FC = () => {
  const { isSupported, permission, isSubscribed, isBusy, subscribe, unsubscribe } = usePushNotifications();
  const { showToast } = useToast();
  // Uma vez que o navegador bloqueia notificações pra um site, ele nunca mais mostra o
  // pedido de permissão sozinho -- só dá pra reverter mudando a configuração do próprio
  // navegador. Isso não é um bug do app; um toast que some em poucos segundos não dá tempo
  // de ler o passo a passo, então esse aviso fica fixo na tela até a pessoa fechar.
  const [showUnblockHelp, setShowUnblockHelp] = useState(false);
  const [soundOn, setSoundOn] = useState(isNotificationSoundEnabled());

  const isIOSNotStandalone = typeof window !== 'undefined'
    && /iphone|ipad|ipod/i.test(navigator.userAgent)
    && !((window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches);

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe();
      showToast(ok ? 'Lembrete diário desativado.' : 'Não foi possível desativar agora.', ok ? 'info' : 'error');
      return;
    }
    const result = await subscribe();
    if (result.success) {
      showToast('Lembrete diário ativado! Você vai receber um aviso às 12h e às 18h.', 'success');
    } else if (permission === 'denied' || result.error === 'Permissão não concedida.') {
      setShowUnblockHelp(true);
    } else {
      showToast(result.error || 'Não foi possível ativar as notificações agora.', 'error');
    }
  };

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
      <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
        <i className="fas fa-bell text-blue-600"></i> Lembrete Diário
      </h3>
      <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
        Receba um aviso às 12h e às 18h lembrando de registrar suas atividades do dia (e avisando de visitas pendentes de confirmação). O aviso das 18h é o lembrete final: se você ainda não registrou nada no dia, ele vem mais firme (vibração longa e fica na tela até você tocar). Em dias úteis.
      </p>

      {!isSupported && !isIOSNotStandalone && (
        <p className="text-[10px] font-bold text-amber-600 uppercase leading-relaxed">
          <i className="fas fa-info-circle mr-1"></i> Seu navegador não é compatível com essas notificações.
        </p>
      )}

      {isIOSNotStandalone && (
        <p className="text-[10px] font-bold text-amber-600 uppercase leading-relaxed">
          <i className="fas fa-info-circle mr-1"></i> No iPhone/iPad, instale o app na tela de início primeiro (veja o aviso "Instalar App") — depois volte aqui para ativar.
        </p>
      )}

      {(showUnblockHelp || (isSupported && permission === 'denied')) && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest leading-relaxed">
              <i className="fas fa-ban mr-1"></i> As notificações estão bloqueadas para este site
            </p>
            <button onClick={() => setShowUnblockHelp(false)} className="text-rose-300 hover:text-rose-500 flex-shrink-0" aria-label="Fechar">
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
          <p className="text-xs text-rose-700 font-medium leading-relaxed">
            Isso acontece quando o próprio navegador bloqueia (por exemplo, depois de "Bloquear" num pedido de permissão anterior) — uma vez bloqueado, o navegador nunca pergunta de novo sozinho. Pra reativar, é preciso mudar isso direto na configuração do navegador:
          </p>
          <ul className="text-xs text-rose-700 font-medium leading-relaxed space-y-1.5 list-disc pl-4">
            <li><b>Chrome/Edge (computador):</b> clique no cadeado (ou ícone "ⓘ") ao lado do endereço do site → Notificações → Permitir.</li>
            <li><b>Chrome (Android):</b> toque nos 3 pontinhos → Informações do site → Notificações → Permitir.</li>
            <li><b>Safari (iPhone/iPad):</b> Ajustes do iPhone → Notificações → procure o app instalado → ative.</li>
          </ul>
          <p className="text-xs text-rose-700 font-medium leading-relaxed">
            Depois de permitir lá, volte aqui e toque em "Ativar Lembrete Diário" de novo.
          </p>
        </div>
      )}

      {/* Som dentro do app: só toca com o app aberto (com o app fechado vale o som padrão do celular,
          que o navegador não deixa o site escolher). */}
      <div className="flex items-center justify-between gap-4 bg-slate-50 rounded-2xl p-4">
        <div>
          <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Som dentro do app</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed mt-1">Toca um sino quando o lembrete chega com o app aberto.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={async () => { await unlockNotificationAudio(); const ok = await playNotificationChime(false); if (!ok) showToast('O navegador bloqueou o som. Toque na tela e tente de novo.', 'warning'); }}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100 active:scale-95"
          >
            <i className="fas fa-volume-up mr-1"></i> Testar
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={soundOn}
            onClick={() => { const next = !soundOn; setSoundOn(next); setNotificationSoundEnabled(next); }}
            className={`w-12 h-7 rounded-full relative transition-colors ${soundOn ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${soundOn ? 'left-6' : 'left-1'}`}></span>
          </button>
        </div>
      </div>

      {isSupported && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={isBusy}
          className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
            isSubscribed
              ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200 hover:bg-emerald-100'
              : 'bg-[#005a9c] text-white hover:bg-[#004a80]'
          } ${isBusy ? 'opacity-60 cursor-wait' : ''}`}
        >
          <i className={`fas ${isSubscribed ? 'fa-bell-slash' : 'fa-bell'}`}></i>
          {isBusy ? 'Aguarde...' : isSubscribed ? 'Desativar Lembrete' : 'Ativar Lembrete Diário'}
        </button>
      )}
    </div>
  );
};

export default NotificationSettings;
