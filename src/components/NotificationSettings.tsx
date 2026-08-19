
import React from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useToast } from '../contexts/ToastContext';

// Card de ativação do lembrete diário (push, 12h e 18h). Mostrado na tela de Perfil. No
// iPhone/iPad só aparece disponível se o app já foi instalado na tela de início -- é regra
// da própria Apple, não dá pra contornar (Safari não expõe a API de push pra uma aba comum).
const NotificationSettings: React.FC = () => {
  const { isSupported, permission, isSubscribed, isBusy, subscribe, unsubscribe } = usePushNotifications();
  const { showToast } = useToast();

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
    } else if (permission === 'denied') {
      showToast('As notificações estão bloqueadas nas configurações do navegador. Ative lá para poder ligar o lembrete aqui.', 'error');
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
        Receba um aviso às 12h e às 18h lembrando de registrar suas atividades do dia (e avisando de visitas pendentes de confirmação).
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
