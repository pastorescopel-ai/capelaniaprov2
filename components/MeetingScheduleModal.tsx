
import React, { useState, useEffect } from 'react';
import { Clock, Calendar, X, User, AlertTriangle, Check } from 'lucide-react';
import { MeetingSchedule, Chaplain, Leader, VisitRequest } from '../types';
import { useApp } from '../contexts/AppContext';

interface MeetingScheduleModalProps {
  user: Leader;
  currentSchedule?: MeetingSchedule;
  chaplains: Chaplain[];
  allSchedules?: MeetingSchedule[];
  onClose: () => void;
  onSave: (schedule: Partial<MeetingSchedule>) => void;
}

const MeetingScheduleModal: React.FC<MeetingScheduleModalProps> = ({ 
  user, currentSchedule, chaplains, allSchedules = [], onClose, onSave 
}) => {
  const { saveRecord } = useApp();
  const [date, setDate] = useState(currentSchedule?.full_date || '');
  const [requestChaplain, setRequestChaplain] = useState(currentSchedule?.request_chaplain || false);
  const [preferredId, setPreferredId] = useState(currentSchedule?.preferred_chaplain_id || '');
  const [requestNotes, setRequestNotes] = useState(currentSchedule?.request_notes || '');
  const [isSaving, setIsSaving] = useState(false);

  // Normalização do Hospital
  const isBelem = user.hospital === 'Belém' || user.hospital === 'HAB';

  const checkConflict = (chaplainId: string) => {
    if (!date) return false;
    return allSchedules.some(s => 
      s.assigned_chaplain_id === chaplainId && 
      s.full_date === date && 
      (s.chaplain_status === 'confirmed' || s.chaplain_status === 'pending')
    );
  };

  useEffect(() => {
    if (date && date !== currentSchedule?.full_date && !requestChaplain && !isBelem) {
      handleAutoSave();
    }
  }, [date]);

  const handleAutoSave = () => {
    setIsSaving(true);
    onSave({ 
      full_date: date, 
      request_chaplain: false,
      chaplain_status: 'none',
      leader_name: user.full_name,
      leader_whatsapp: user.whatsapp,
      pg_name: user.pg_name || `PG ${user.sector_name || 'Setor'}`,
      sector_name: user.sector_name,
      hospital: user.hospital
    });
    setTimeout(onClose, 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setIsSaving(true);
    
    // --- LÓGICA DE INTEGRAÇÃO (UNIFIED DB) ---
    if (isBelem && requestChaplain) {
        // Cria a solicitação diretamente na tabela 'visitRequests' usando o AppContext
        const newRequest: VisitRequest = {
            id: crypto.randomUUID(),
            pgName: user.pg_name || `PG ${user.sector_name || 'Sem Setor'}`,
            leaderName: user.full_name,
            leaderPhone: user.whatsapp || '',
            unit: 'HAB',
            date: new Date(date).toISOString(),
            requestNotes: requestNotes,
            preferredChaplainId: preferredId || undefined,
            status: 'pending',
            isRead: false
        };

        // Envia para o banco unificado sem travar a UI
        saveRecord('visitRequests', newRequest)
          .then(success => {
             if(success) console.log("Convite enviado com sucesso!");
             else console.warn("Erro ao enviar convite.");
          });
    }
    // ----------------------------

    // Salva localmente no estado do componente pai
    onSave({ 
      full_date: date, 
      request_chaplain: isBelem ? requestChaplain : false,
      request_notes: isBelem ? requestNotes : undefined,
      preferred_chaplain_id: isBelem && requestChaplain ? preferredId : undefined,
      chaplain_status: (isBelem && requestChaplain) ? 'pending' : 'none',
      leader_name: user.full_name,
      leader_whatsapp: user.whatsapp,
      pg_name: user.pg_name || `PG ${user.sector_name || 'Setor'}`,
      sector_name: user.sector_name,
      hospital: user.hospital
    });
    
    setTimeout(() => {
        onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[210]">
      <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-lg max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        <div className="p-8 pb-4 flex justify-between items-start border-b border-slate-50">
          <div>
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Clock className="text-blue-600" size={28}/> Cronograma PG
            </h3>
            <p className="text-slate-500 font-medium text-xs mt-1">Defina a data do encontro semanal.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:text-slate-800 transition-all"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Data e Hora do Encontro</label>
              <div className="relative">
                <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24}/>
                <input 
                  type="datetime-local" 
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className={`w-full pl-16 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-800 outline-none focus:ring-4 focus:ring-blue-600/10 transition-all ${isSaving && !requestChaplain ? 'border-green-500 bg-green-50' : ''}`}
                  required
                />
                {isSaving && !requestChaplain && (
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-green-500 animate-in fade-in">
                    <Check size={24} />
                  </div>
                )}
              </div>
            </div>

            {isBelem && (
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Escala Pastoral</h4>
                
                <label className={`flex items-start gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                  requestChaplain ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
                }`}>
                   <input type="checkbox" className="mt-1 w-5 h-5 rounded accent-blue-600" checked={requestChaplain} onChange={e => setRequestChaplain(e.target.checked)} />
                   <div>
                     <span className="text-sm font-black text-slate-800 block">Solicitar Presença Pastoral</span>
                     <span className="text-[10px] text-slate-500 font-medium italic">O sistema enviará um convite oficial à Capelania.</span>
                   </div>
                </label>

                {requestChaplain && (
                  <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-2">Sugerir Capelão (Opcional)</label>
                      <div className="grid grid-cols-1 gap-2">
                        {chaplains.filter(c => c.active && (c.hospital === 'Belém' || c.hospital === 'HAB')).map(c => {
                          const conflict = checkConflict(c.id);
                          return (
                            <button 
                              key={c.id}
                              type="button"
                              onClick={() => !conflict && setPreferredId(c.id === preferredId ? '' : c.id)}
                              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                conflict ? 'bg-red-50 border-red-100 opacity-60 cursor-not-allowed' :
                                preferredId === c.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white border-slate-100 hover:border-blue-200'
                              }`}
                            >
                              <div className="flex items-center gap-3 text-left">
                                <User size={16} />
                                <span className="text-sm font-bold">{c.name}</span>
                              </div>
                              {conflict && (
                                <span className="text-[8px] font-black uppercase bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-1.5">
                                  <AlertTriangle size={10}/> Já convidado
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    <textarea 
                      value={requestNotes}
                      onChange={e => setRequestNotes(e.target.value)}
                      placeholder="Algum motivo especial ou pedido de oração?"
                      className="w-full h-24 p-4 bg-blue-50/30 border border-blue-100 rounded-xl text-sm font-medium outline-none resize-none placeholder-blue-300"
                    />
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={isSaving || !date} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
              {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {requestChaplain ? 'Enviando Convite...' : 'Registrando...'}
                  </>
              ) : 'Confirmar e Fechar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MeetingScheduleModal;
