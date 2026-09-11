
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../hooks/useApp';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { UserRole, VisitRequest } from '../types';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { usePGInference } from '../hooks/usePGInference';
import { getTimestamp } from '../utils/formatters';
import { isVisitRequestRegistered } from '../utils/visitRequestHelpers';

interface NotificationCenterProps {
  onGoToReturnHistory?: (visit?: any) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onGoToReturnHistory }) => {
  const { visitRequests, saveRecord, proGroups, proGroupLocations, proSectors, smallGroups, bibleStudies, bibleClasses, staffVisits, proStaff } = useApp();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use centralized inference logic
  const { inferPGDetails } = usePGInference(
    'HAB', // Fallback, we'll pass the unit per request
    proGroups,
    proSectors,
    proGroupLocations,
    proStaff
  );

  // Calcula metas para o lembrete
  const { goals = [], pendingReturns = [], todaysReturns = [] } = useDashboardStats(bibleStudies, bibleClasses, smallGroups, staffVisits, currentUser as any);

  const goalReminders = useMemo(() => {
    return (goals || []).filter(g => g.current < g.target);
  }, [goals]);

  const returnCount = (pendingReturns || []).length;

  const filteredRequests = useMemo(() => {
    if (!currentUser || !visitRequests) return [];
    return (visitRequests || []).filter(req => {
      if (req.status === 'confirmed' || req.status === 'declined') return false;

      // Filtro de Visita Já Registrada -- mesma regra usada no card "Escala de Visitas PG" do
      // Dashboard (ver utils/visitRequestHelpers.ts), pra sino e card nunca mais divergirem.
      if (isVisitRequestRegistered(req, smallGroups)) {
        return false;
      }

      const isUserAdmin = String(currentUser.role).toUpperCase() === 'ADMIN';
      if (isUserAdmin) return true;
      
      return req.assignedChaplainId && String(req.assignedChaplainId) === String(currentUser.id);
    }).sort((a, b) => getTimestamp(a.date) - getTimestamp(b.date));
  }, [visitRequests, currentUser, smallGroups]);

  const getEnhancedInfo = useCallback((req: VisitRequest) => {
    // 1. Tenta usar os dados já presentes na escala
    let sectorName = req.meetingLocation || null;
    let phone = req.leaderPhone || "";

    // 2. Se faltar algo, usa a inteligência centralizada
    if (!sectorName || !phone) {
        // Temporarily set the unit for inference if needed, though inferPGDetails uses the hook's unit.
        // Since NotificationCenter shows all units, we might need to find the PG directly or rely on the hook's fallback.
        // The hook uses the unit passed to it, but we can just find the PG directly here for cross-unit support, 
        // or just use the hook and accept it might miss cross-unit edge cases.
        // Actually, let's just use the hook and if it fails, fallback to direct search.
        const pg = proGroups.find(g => g.name === req.pgName && g.unit === req.unit);
        
        if (pg) {
            if (!phone && pg.leaderPhone) phone = pg.leaderPhone;
            
            if (!sectorName) {
                if (pg.sectorId) {
                    const sec = proSectors.find(s => s.id === pg.sectorId);
                    if (sec) sectorName = sec.name;
                } else {
                    const loc = proGroupLocations.find(l => l.groupId === pg.id);
                    if (loc) {
                        const sec = proSectors.find(s => s.id === loc.sectorId);
                        if (sec) sectorName = sec.name;
                    }
                }
            }
        }
    }

    return { sectorName, phone };
  }, [proGroups, proSectors, proGroupLocations]);

  const unreadCount = useMemo(() => {
    return (filteredRequests || []).filter(req => !req.isRead).length + (goalReminders || []).length + returnCount;
  }, [filteredRequests, goalReminders, returnCount]);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleMarkAllAsRead = async () => {
    const unread = (filteredRequests || []).filter(req => !req.isRead);
    if (unread.length === 0) return;
    try {
      const updates = unread.map(req => ({ ...req, isRead: true }));
      const success = await saveRecord('visitRequests', updates);
      if (!success) {
        showToast("Erro ao limpar notificações.", "error");
        return;
      }
      showToast("Notificações marcadas como lidas.", "success");
    } catch (e) {
      console.error("Erro ao marcar como lido:", e);
      showToast("Erro ao limpar notificações.", "error");
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const formatDate = (d: string) => {
    try {
      const timestamp = getTimestamp(d);
      if (!timestamp) return d;
      return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={handleToggle} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${unreadCount > 0 ? 'bg-amber-100 text-amber-600 shadow-lg' : 'bg-slate-50 text-slate-400 opacity-40 hover:opacity-100'}`}>
        <i className={`fas fa-bell text-lg ${unreadCount > 0 ? 'animate-ring' : ''}`}></i>
        {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[320px] md:w-[380px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 z-[1000] overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Novas Escalas</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{filteredRequests.length} escalas pendentes</p>
            </div>
            {filteredRequests.some(req => !req.isRead) && <button onClick={handleMarkAllAsRead} className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Limpar</button>}
          </div>

          <div className="max-h-[400px] overflow-y-auto no-scrollbar py-2">
            {/* RETORNOS PENDENTES -- uma linha por colaborador, cada uma leva direto ao
                registro específico (antes ia sempre pro primeiro da lista, sem escolha). */}
            {returnCount > 0 && (
              <div className={`border-b border-slate-50 ${todaysReturns.length > 0 ? 'bg-amber-50/30' : 'bg-slate-50/30'}`}>
                <div className="px-5 pt-4 pb-1 flex items-center gap-2">
                  <i className={`fas ${todaysReturns.length > 0 ? 'fa-calendar-check text-amber-500' : 'fa-calendar-alt text-slate-500'} text-xs`}></i>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${todaysReturns.length > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                    {todaysReturns.length > 0 ? 'Retornos para Hoje' : 'Retornos Agendados'}
                  </p>
                </div>
                {[...todaysReturns, ...pendingReturns.filter((p: any) => !todaysReturns.some((t: any) => t.id === p.id))].map((visit: any) => {
                  const isToday = todaysReturns.some((t: any) => t.id === visit.id);
                  const d = typeof visit.returnDate === 'number' ? new Date(visit.returnDate) : new Date(String(visit.returnDate).split('T')[0] + 'T12:00:00');
                  const dateLabel = isNaN(d.getTime()) ? '---' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  return (
                    <div key={visit.id} onClick={() => { setIsOpen(false); onGoToReturnHistory?.(visit); }} className="px-5 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/70 transition-all">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-800 font-bold leading-tight truncate">{visit.staffName}</p>
                        <p className="text-[9px] text-slate-500 font-medium truncate">{visit.sector || 'Sem setor'}</p>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg flex-shrink-0 ${isToday ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{dateLabel}</span>
                    </div>
                  );
                })}
                <div className="pb-2"></div>
              </div>
            )}

            {/* LEMBRETES DE METAS */}
            {goalReminders.map((goal, idx) => (
              <div key={`goal-${idx}`} className="p-5 border-b border-slate-50 bg-indigo-50/20 flex gap-4 animate-in slide-in-from-right duration-300">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-100">
                  <i className="fas fa-bullseye"></i>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Meta Pendente</p>
                  <p className="text-xs text-slate-800 font-bold leading-tight mb-1">
                    {goal.label}: {goal.current} de {goal.target}
                  </p>
                  <p className="text-[9px] text-slate-500 font-medium italic">Faltam {goal.target - goal.current} visitas para bater o alvo.</p>
                </div>
              </div>
            ))}

            {filteredRequests.length > 0 ? (
              filteredRequests.map(req => {
                const { sectorName, phone } = getEnhancedInfo(req);
                const waLink = phone ? `https://wa.me/55${phone.replace(/\D/g, '')}` : null;

                return (
                  <div key={req.id} className={`p-5 border-b border-slate-50 last:border-none flex gap-4 ${!req.isRead ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!req.isRead ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-100 text-slate-400'}`}><i className="fas fa-house-user"></i></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 truncate mr-2">{req.pgName}</p>
                        {waLink && (
                            <a href={waLink} target="_blank" rel="noreferrer" className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all">
                                <i className="fab fa-whatsapp text-[10px]"></i>
                            </a>
                        )}
                      </div>
                      <p className="text-xs text-slate-800 font-bold leading-tight mb-1 truncate">Líder: {req.leaderName}</p>
                      <p className="text-[9px] text-slate-500 font-medium italic">{sectorName ? `Setor: ${sectorName}` : 'Setor Externo'}</p>
                      <div className="flex items-center justify-between mt-2"><span className="text-[9px] font-medium text-slate-400">{formatDate(req.date)}</span>{!req.isRead && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center space-y-4"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200 text-2xl"><i className="fas fa-check-double"></i></div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tudo em dia!</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
