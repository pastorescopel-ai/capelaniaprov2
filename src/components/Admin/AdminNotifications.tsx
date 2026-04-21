
import React, { useState, useEffect } from 'react';
import { Bell, Send, Clock, ToggleLeft, ToggleRight, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationSetting {
  id: string;
  enabled: boolean;
  scheduled_time: string;
  description: string;
}

export const AdminNotifications: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState({ title: '', body: '' });
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVercel, setIsVercel] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchSettings();
    setIsVercel(window.location.hostname.includes('vercel.app'));
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/push/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      showToast('Erro ao carregar configurações de push', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSetting = async (id: string, updates: Partial<NotificationSetting>) => {
    try {
      const res = await fetch(`/api/push/settings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        showToast('Configuração atualizada!', 'success');
        fetchSettings();
      }
    } catch (error) {
      showToast('Erro ao atualizar configuração', 'error');
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.title || !broadcastMessage.body) {
      showToast('Preencha o título e o corpo da mensagem', 'warning');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(broadcastMessage)
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`Mensagem enviada para ${result.sent} aparelhos!`, 'success');
        setBroadcastMessage({ title: '', body: '' });
      }
    } catch (error) {
      showToast('Erro ao enviar transmissão', 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center animate-pulse">
        <Bell size={48} className="text-slate-200 mb-4" />
        <div className="h-4 bg-slate-100 w-48 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32">
      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Lado Esquerdo: Comunicado Geral */}
        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Send size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Comunicado Geral</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enviar Push para toda a equipe</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título do Alerta</label>
              <input 
                type="text"
                placeholder="Ex: Reunião de Urgência"
                value={broadcastMessage.title}
                onChange={e => setBroadcastMessage({...broadcastMessage, title: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mensagem (Corpo)</label>
              <textarea 
                placeholder="Descreva o comunicado brevemente..."
                rows={3}
                value={broadcastMessage.body}
                onChange={e => setBroadcastMessage({...broadcastMessage, body: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
              />
            </div>

            <button
              onClick={handleBroadcast}
              disabled={isSending}
              className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-xl transition-all shadow-indigo-200 active:scale-95 disabled:opacity-50"
            >
              {isSending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Disparando Mensagens...
                </span>
              ) : 'Enviar para Todos Agora'}
            </button>
            <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-wider">Apenas usuários com notificações ativas receberão.</p>
          </div>
        </section>

        {/* Lado Direito: Configuração de Gatilhos */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Agendamentos Automáticos</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de horários e gatilhos</p>
            </div>
          </div>

          <div className="space-y-4">
            {settings.map(setting => (
              <div key={setting.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                <div className="flex gap-4 items-center">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${setting.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                    {setting.enabled ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">{setting.description}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status: {setting.enabled ? 'Ativo' : 'Desativado'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end gap-1">
                    <label className="text-[8px] font-black text-slate-300 uppercase">Horário/Freq</label>
                    <input 
                      type={setting.id === 'visit_alert' ? 'number' : 'time'}
                      value={setting.scheduled_time}
                      onChange={e => handleUpdateSetting(setting.id, { scheduled_time: e.target.value })}
                      className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-[10px] font-black text-slate-600 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all w-24 text-center"
                    />
                  </div>
                  
                  <button 
                    onClick={() => handleUpdateSetting(setting.id, { enabled: !setting.enabled })}
                    className={`p-1 transition-all ${setting.enabled ? 'text-emerald-500' : 'text-slate-300'}`}
                  >
                    {setting.enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
            <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-2 mb-2">
              <AlertCircle size={14} /> Nota Técnica
            </h5>
            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest leading-loose mb-3">
              O sistema utiliza serviços externos para verificar estes gatilhos. Se você mudar o horário aqui, o robô externo avisará às pessoas conforme a nova regra.
            </p>
            <div className="flex items-center gap-2 bg-white/50 p-3 rounded-xl border border-blue-100">
               <div className={`w-2 h-2 rounded-full ${isVercel ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
               <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                 {isVercel ? 'Vercel Cron Engine Ativo' : 'Cron Engine Padrão'}
               </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
