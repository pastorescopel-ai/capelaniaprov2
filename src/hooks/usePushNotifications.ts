
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// A chave pública VAPID vem em base64url; o navegador espera um Uint8Array bruto.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export type PushSupportState = 'unsupported' | 'default' | 'granted' | 'denied';

// Ativa/gerencia o lembrete diário por push (12h e 18h) para o usuário logado. Nenhum
// navegador tem suporte universal: no iPhone/iPad só funciona se o app já foi instalado na
// tela de início (regra da Apple, não tem como contornar) -- o hook detecta isso e reporta
// via `isSupported`, então a UI que usa este hook sabe quando esconder a opção.
export const usePushNotifications = () => {
  const { currentUser } = useAuth();
  const [permission, setPermission] = useState<PushSupportState>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;

  const refreshStatus = useCallback(async () => {
    if (!isSupported) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PushSupportState);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setIsSubscribed(!!existing);
    } catch {
      setIsSubscribed(false);
    }
  }, [isSupported]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const subscribe = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!isSupported || !currentUser || !supabase) {
      return { success: false, error: 'Notificações não são suportadas neste navegador.' };
    }
    setIsBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushSupportState);
      if (perm !== 'granted') {
        return { success: false, error: 'Permissão não concedida.' };
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!)
        });
      }

      const json = subscription.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: currentUser.id,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });

      if (error) {
        return { success: false, error: error.message };
      }

      setIsSubscribed(true);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao ativar notificações.' };
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, currentUser]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !supabase) return false;
    setIsBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
      setIsSubscribed(false);
      return true;
    } catch {
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [isSupported]);

  return { isSupported, permission, isSubscribed, isBusy, subscribe, unsubscribe };
};
