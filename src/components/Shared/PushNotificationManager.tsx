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
  const [isTesting, setIsTesting] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(`[PushManager] ${msg}`);
    setDebugLog(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

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
    addLog('Iniciando subscrição...');
    try {
      // 1. Pedir permissão
      addLog('Solicitando permissão ao navegador...');
      const status = await Notification.requestPermission();
      setPermission(status);
      addLog(`Permissão: ${status}`);

      if (status !== 'granted') {
        showToast('Permissão de notificação negada.', 'warning');
        return;
      }

      // 2. Obter VAPID Public Key da API
      addLog('Buscando VAPID Key no servidor...');
      const configRes = await fetch('/api/config');
      if (!configRes.ok) throw new Error(`Erro API Config: ${configRes.status}`);
      const config = await configRes.json();
      
      if (!config.vapidPublicKey) {
        throw new Error('VAPID Public Key não configurada no servidor (.env).');
      }

      // 3. Registrar/Obter Service Worker
      addLog('Aguardando Service Worker...');
      const registration = await navigator.serviceWorker.ready;
      addLog('Service Worker pronto.');
      
      // 4. Se inscrever no Push do navegador
      addLog('Gerando subscrição no navegador...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey)
      });
      addLog('Subscrição gerada com sucesso.');

      // 5. Salvar subscrição no nosso backend
      addLog('Salvando subscrição no banco de dados...');
      const subscribeRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          subscription: subscription
        })
      });

      if (subscribeRes.ok) {
        addLog('Sucesso: Notificações habilitadas.');
        showToast('Notificações habilitadas com sucesso!', 'success');
      } else {
        const errorData = await subscribeRes.json();
        throw new Error(errorData.error || 'Falha ao salvar subscrição no servidor.');
      }
    } catch (err: any) {
      addLog(`ERRO: ${err.message}`);
      console.error('Erro detalhado:', err);
      showToast(`Erro: ${err.message}`, 'error');
    } finally {
      setIsSubscribing(false);
    }
  };

  const testPush = async () => {
    if (!currentUser?.id) return;
    setIsTesting(true);
    addLog('Enviando push de teste...');
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUser.id,
          title: 'Teste do Capelania 🔔',
          body: 'Se você está vendo isso, o sistema de push está funcionando!'
        })
      });
      if (res.ok) {
        addLog('Teste enviado com sucesso.');
        showToast('Notificação de teste enviada!', 'success');
      } else {
        addLog('Erro ao enviar teste.');
      }
    } catch (err) {
      addLog('Falha na requisição de teste.');
    } finally {
      setIsTesting(false);
    }
  };

  if (!isAuthenticated || !isChaplainOrIntern) return null;

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm mb-6">
      <div className="flex items-center justify-between gap-4">
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
              {permission === 'granted' 
                ? 'Você receberá avisos sobre visitas e relatórios.' 
                : 'Ative para não esquecer seus registros diários.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {permission === 'granted' ? (
            <>
              <button
                onClick={testPush}
                disabled={isTesting}
                className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                {isTesting ? 'Testando...' : 'Testar'}
              </button>
              <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase bg-emerald-50 px-4 py-2 rounded-xl">
                <CheckCircle size={14} />
                <span className="hidden sm:inline">Habilitado</span>
              </div>
            </>
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

      {debugLog.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-50">
          <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2">Logs do Sistema:</p>
          <div className="space-y-1">
            {debugLog.map((log, i) => (
              <div key={i} className="text-[9px] font-mono text-slate-400 flex gap-2">
                <span className="text-indigo-300 opacity-50">#</span>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
