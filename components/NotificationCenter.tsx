import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, VisitRequest } from '../types';

const NotificationCenter: React.FC = () => {
  const { visitRequests, saveRecord } = useApp();
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filtrar convites pertinentes ao usuário logado
  const filteredRequests = useMemo(() => {
    if (!currentUser) return [];
    return visitRequests.filter(req => {
      // Admins veem todos
      if (currentUser.role === UserRole.ADMIN) return true;
      // Capelães veem apenas o que foi designado para eles ou o que preferencialmente foi pedido a eles
      return req.assignedChaplainId === currentUser.id || 
             (req.preferredChaplainId === currentUser.id && !req.assignedChaplainId);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visitRequests, currentUser]);

  const unreadCount = useMemo(() => {
    return filteredRequests.filter(req => !req.isRead).length;
  }, [filteredRequests]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllAsRead = async () => {
    const unread = filteredRequests.filter(req => !req.isRead);
    if (unread.length === 0) return;

    try {
      const updates = unread.map(req => ({ ...req, isRead: true }));
      // UpsertRecord aceita array no dataRepository
      await saveRecord('visitRequests', updates);
    } catch (e) {
      console.error("Erro ao marcar como lido:", e);
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Marcar como lido ao abrir (opcional, ou via botão)
      // handleMarkAllAsRead(); 
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Ícone do Sino */}
      <button 
        onClick={handleToggle}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
          unreadCount > 0 ? 'bg-amber-100 text-amber-600 shadow-lg shadow-amber-200/50' : 'bg-slate-50 text-slate-400 opacity-40 hover:opacity-100'
        }`}
      >
        <i className={`fas fa-bell text-lg ${unreadCount > 0 ? 'animate-ring' : ''}`}></i>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown de Notificações */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-[320px] md:w-[380px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 z-[1000] overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Notificações</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{unreadCount} novos alertas</p>
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800"
              >
                Limpar Tudo
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto no-scrollbar py-2">
            {filteredRequests.length > 0 ? (
              filteredRequests.map(req => (
                <div 
                  key={req.id} 
                  className={`p-5 border-b border-slate-50 last:border-none transition-colors flex gap-4 ${!req.isRead ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!req.isRead ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <i className="fas fa-calendar-alt"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                      {req.pgName}
                    </p>
                    <p className="text-xs text-slate-800 font-bold leading-tight mb-1 truncate">
                      {req.leaderName} solicitou presença
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] font-medium text-slate-400">{formatDate(req.date)}</span>
                      {!req.isRead && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200 text-2xl">
                  <i className="fas fa-check-double"></i>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nada pendente por aqui!</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Recebido via App PG (Firebase Bridge)</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;