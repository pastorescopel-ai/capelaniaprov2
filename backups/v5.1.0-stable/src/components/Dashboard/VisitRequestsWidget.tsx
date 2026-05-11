
import React from 'react';
import { User, VisitRequest, UserRole } from '../../types';
import Button from '../Shared/Button';
import { useVisitRequestsWidget } from '../../hooks/useVisitRequestsWidget';

interface VisitRequestsWidgetProps {
  requests: VisitRequest[];
  currentUser: User;
  users: User[];
  onRegisterMission?: (visit: VisitRequest) => void;
}

const VisitRequestsWidget: React.FC<VisitRequestsWidgetProps> = ({ requests, currentUser, users, onRegisterMission }) => {
  const {
    isProcessing,
    selectedRequest, setSelectedRequest,
    actionType, setActionType,
    selectedChaplainId, setSelectedChaplainId,
    todayStr,
    myRequests,
    getMeetingSector,
    getChaplainName,
    handleUpdateStatus,
    handleDeleteRequest,
    formatDate
  } = useVisitRequestsWidget({ requests, currentUser, users });

  if (myRequests.length === 0) return null;

  return (
    <div className="bg-white p-5 md:p-6 rounded-3xl border border-blue-100 shadow-sm mb-6 animate-in slide-in-from-top duration-500">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><i className="fas fa-calendar-alt text-lg"></i></div>
        <div>
          <h3 className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tight">
            {currentUser.role === UserRole.ADMIN ? 'Escala de Visitas PG' : 'Minha Escala de Visitas'}
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{myRequests.length} visita(s) programada(s)</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {myRequests.map(req => {
          const sector = getMeetingSector(req);
          const waLink = req.leaderPhone ? `https://wa.me/55${req.leaderPhone.replace(/\D/g, '')}` : null;
          const assignedChaplainName = getChaplainName(req.assignedChaplainId);
          
          const dateStr = req.date ? (typeof req.date === 'string' ? req.date.split('T')[0] : (req.date instanceof Date ? req.date.toISOString().split('T')[0] : '')) : '';
          const isToday = dateStr === todayStr;
          
          return (
            <div key={req.id} className={`min-w-[260px] max-w-[280px] p-4 rounded-2xl border flex flex-col justify-between relative group transition-all ${
              isToday ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100' : 'bg-slate-50 border-slate-100 hover:border-blue-200'
            }`}>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded uppercase">{req.unit}</span>
                    {isToday && (
                      <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse">Hoje</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-black text-slate-600 block leading-tight">{formatDate(req.date)}</span>
                    {req.scheduledTime && (
                      <span className="text-[11px] font-black text-blue-600 block uppercase tracking-tighter mt-0.5">
                        <i className="far fa-clock mr-1 text-[9px]"></i>{req.scheduledTime}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-sm leading-tight mb-1">{req.pgName}</h4>
                  <p className="text-[9px] text-blue-600 font-bold uppercase flex items-center gap-1 mb-3">
                    <i className="fas fa-map-marker-alt"></i> {sector}
                  </p>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100">
                      <div className="min-w-0">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Líder</p>
                          <p className="text-[10px] font-bold text-slate-700 truncate">{req.leaderName}</p>
                      </div>
                      {waLink && (
                          <a href={waLink} target="_blank" rel="noreferrer" className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all">
                              <i className="fab fa-whatsapp"></i>
                          </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100 relative">
                      <div className="min-w-0">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Capelão Designado</p>
                          <p className="text-[10px] font-bold text-slate-700 truncate">{assignedChaplainName}</p>
                      </div>
                      {currentUser.role === UserRole.ADMIN && (
                        <div className="flex items-center gap-1 absolute right-2 top-2">
                          <button 
                            onClick={() => { setSelectedRequest(req); setActionType('assign'); }}
                            className="w-7 h-7 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all"
                            title="Alterar Capelão"
                          >
                            <i className="fas fa-pencil-alt text-[10px]"></i>
                          </button>
                          <button 
                            onClick={() => { setSelectedRequest(req); setActionType('delete'); }}
                            className="w-7 h-7 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all"
                            title="Excluir Agendamento"
                          >
                            <i className="fas fa-trash-alt text-[10px]"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {onRegisterMission && req.assignedChaplainId === currentUser.id && (
                <div className="flex gap-2 mt-auto">
                  <Button 
                    onClick={() => onRegisterMission(req)} 
                    className="flex-1 py-2 text-[10px]"
                  >
                    <span>Registrar Visita</span>
                    <i className="fas fa-arrow-right"></i>
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedRequest && actionType === 'assign' && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => { setSelectedRequest(null); setActionType(null); }} />
          <div className="relative bg-white w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300">
            <h4 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight">Alterar Capelão</h4>
            <div className="space-y-4">
              <select className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-xs" value={selectedChaplainId} onChange={e => setSelectedChaplainId(e.target.value)}>
                <option value="">Selecione um Capelão...</option>
                {users.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>
              <Button 
                onClick={() => selectedChaplainId && handleUpdateStatus(selectedRequest, 'assigned', undefined, selectedChaplainId)} 
                isLoading={isProcessing}
                className="w-full py-4 text-[10px]"
              >
                Salvar Alteração
              </Button>
            </div>
          </div>
        </div>
      )}
      {selectedRequest && actionType === 'delete' && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => { setSelectedRequest(null); setActionType(null); }} />
          <div className="relative bg-white w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300">
            <h4 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-tight">Excluir Agendamento?</h4>
            <p className="text-sm text-slate-500 font-medium mb-6">Esta ação removerá permanentemente a missão de {selectedRequest.pgName} da escala.</p>
            <div className="flex gap-3">
              <Button 
                variant="ghost"
                onClick={() => { setSelectedRequest(null); setActionType(null); }} 
                className="flex-1 py-4 text-[10px]"
              >
                Cancelar
              </Button>
              <Button 
                variant="danger"
                onClick={() => handleDeleteRequest(selectedRequest.id)} 
                isLoading={isProcessing} 
                className="flex-1 py-4 text-[10px]"
              >
                Confirmar Exclusão
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitRequestsWidget;
