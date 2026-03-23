
import React from 'react';
import { User, VisitRequest, SmallGroup, UserRole } from '../../types';
import { useApp } from '../../hooks/useApp';
import { useToast } from '../../contexts/ToastProvider';

interface SmallGroupVisitWidgetProps {
  requests: VisitRequest[];
  registeredGroups: SmallGroup[];
  currentUser: User;
  onGoToTab: (tab: string) => void;
  onRegisterMission: (visit: VisitRequest) => void;
}

const SmallGroupVisitWidget: React.FC<SmallGroupVisitWidgetProps> = ({ requests, registeredGroups, currentUser, onGoToTab, onRegisterMission }) => {
  const { deleteRecord } = useApp();
  const { showToast } = useToast();

  // Pegar data de hoje no formato YYYY-MM-DD considerando fuso local
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
  
  const todaysVisits = requests.filter(req => {
    const reqDate = req.date.split('T')[0];
    
    // 1. Deve ser hoje e estar 'assigned' ou 'confirmed'
    const isValidStatus = req.status === 'assigned' || req.status === 'confirmed';
    const isToday = reqDate === todayStr;
    if (!isValidStatus || !isToday) return false;

    // 2. Visibilidade
    const isAssignedToMe = req.assignedChaplainId === currentUser.id;
    const isAdmin = currentUser.role === UserRole.ADMIN;
    
    // Se for Admin, vê tudo. Se não, vê só o dele.
    if (!isAdmin && !isAssignedToMe) return false;

    // 3. Filtro de Conclusão
    const alreadyVisited = registeredGroups.some(group => {
      const groupDate = group.date.split('T')[0];
      const isSameGroup = group.groupName === req.pgName;
      const isSameDate = groupDate === todayStr;
      
      if (isAdmin) {
        // Para o Admin na visão geral, some se alguém visitou
        return isSameGroup && isSameDate;
      } else {
        // Para o Capelão, some se ele visitou
        return isSameGroup && isSameDate && group.userId === currentUser.id;
      }
    });

    return !alreadyVisited;
  }).sort((a, b) => {
    // Admin vê os dele primeiro
    const aIsMine = a.assignedChaplainId === currentUser.id;
    const bIsMine = b.assignedChaplainId === currentUser.id;
    if (aIsMine && !bIsMine) return -1;
    if (!aIsMine && bIsMine) return 1;
    return 0;
  });

  const handleRemove = async (id: string) => {
    if (window.confirm('Deseja realmente remover este agendamento da agenda de hoje?')) {
      try {
        await deleteRecord('visitRequests', id);
        showToast('Agendamento removido.', 'success');
      } catch (e) {
        showToast('Erro ao remover.', 'warning');
      }
    }
  };

  if (todaysVisits.length === 0) return null;

  return (
    <div className="bg-white p-5 md:p-6 rounded-3xl border border-indigo-100 shadow-sm mb-6 animate-in slide-in-from-top duration-500">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
          <i className="fas fa-calendar-check text-lg"></i>
        </div>
        <div>
          <h3 className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tight">Painel de Missões - PG</h3>
          <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">
            {todaysVisits.length} missão(ões) para hoje
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {todaysVisits.map((visit) => {
          const isMine = visit.assignedChaplainId === currentUser.id;
          const isAdmin = currentUser.role === UserRole.ADMIN;

          return (
            <div 
              key={visit.id}
              className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl border transition-all ${
                isMine 
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-100' 
                  : 'bg-indigo-50/50 text-slate-800 border-indigo-100/50'
              }`}
            >
              <div className="flex items-center gap-3 mb-3 sm:mb-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${
                  isMine ? 'bg-white/20 text-white' : 'bg-white text-indigo-600 border border-indigo-100'
                }`}>
                  <i className="fas fa-users text-xs"></i>
                </div>
                <div className="min-w-0">
                  <h4 className={`font-black text-sm uppercase tracking-tight truncate ${isMine ? 'text-white' : 'text-slate-800'}`}>
                    {visit.pgName}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest truncate ${isMine ? 'text-indigo-100' : 'text-slate-400'}`}>
                      Líder: {visit.leaderName}
                    </span>
                    {!isMine && visit.assignedChaplainId && (
                      <>
                        <div className={`w-1 h-1 rounded-full ${isMine ? 'bg-indigo-300' : 'bg-slate-300'}`}></div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isMine ? 'text-indigo-200' : 'text-indigo-400'}`}>
                          Equipe
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {isMine ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegisterMission(visit);
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-white text-indigo-600 rounded-xl font-black text-[9px] uppercase shadow-sm hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Registrar Visita</span>
                    <i className="fas fa-arrow-right text-[8px]"></i>
                  </button>
                ) : isAdmin ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(visit.id);
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-trash-alt text-[10px]"></i>
                    <span>Excluir</span>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SmallGroupVisitWidget;
