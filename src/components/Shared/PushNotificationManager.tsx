import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { Bell, BellOff, CheckCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export const PushNotificationManager: React.FC = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribing, setIsSubscribing] = useState(false);

  const isChaplainOrIntern = 
    currentUser?.role === UserRole.CHAPLAIN || 
    currentUser?.role === UserRole.INTERN || 
    currentUser?.role === UserRole.ADMIN;

  useEffect(() => {
    if (isAuthenticated && isChaplainOrIntern && permission === 'default') {
      // Opcionalmente mostrar um convite suave antes de pedir permissão real
    }
  }, [isAuthenticated, isChaplainOrIntern, permission]);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeUser = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Notificações Push não são suportadas neste navegador.', 'warning');
      return;
    }

    setIsSubscribing(true);
    try {
      // 1. Pedir permissão
      const status = await Notification.requestPermission();
      setPermission(status);

      if (status !== 'granted') {
        showToast('Permissão de notificação negada.', 'warning');
        return;
      }

      // 2. Obter VAPID Public Key da API
      const configRes = await fetch('/api/config');
      const config = await configRes.json();
      
      if (!config.vapidPublicKey) {
        throw new Error('VAPID Public Key não configurada no servidor.');
      }

      // 3. Registrar/Obter Service Worker
      const registration = await navigator.serviceWorker.ready;
      
      // 4. Se inscrever no Push do navegador
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey)
      });

      // 5. Salvar subscrição no nosso backend
      const subscribeRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          subscription: subscription
        })
      });

      if (subscribeRes.ok) {
        showToast('Notificações habilitadas com sucesso!', 'success');
      } else {
        throw new Error('Falha ao salvar subscrição no servidor.');
      }
    } catch (err) {
      console.error('Erro ao habilitar notificações:', err);
      showToast('Erro ao configurar notificações push.', 'warning');
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!isAuthenticated || !isChaplainOrIntern) return null;

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          permission === 'granted' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
        }`}>
          {permission === 'granted' ? <Bell size={24} /> : <BellOff size={24} />}
        </div>
        <div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
            {permission === 'granted' ? 'Notificações Ativas' : 'Alertas e Lembretes'}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {permission === 'granted' 
              ? 'Você receberá avisos sobre visitas e relatórios.' 
              : 'Ative para não esquecer seus registros diários.'}
          </p>
        </div>
      </div>

      <div>
        {permission === 'granted' ? (
          <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase bg-emerald-50 px-4 py-2 rounded-xl">
            <CheckCircle size={14} />
            Habilitado
          </div>
        ) : (
          <button
            onClick={subscribeUser}
            disabled={isSubscribing}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {isSubscribing ? 'Ativando...' : 'Habilitar'}
          </button>
        )}
      </div>
    </div>
  );
};
