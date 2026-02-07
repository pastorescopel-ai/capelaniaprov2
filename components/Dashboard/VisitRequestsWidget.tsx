
import React, { useState, useMemo } from 'react';
import { User, VisitRequest, UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';

interface VisitRequestsWidgetProps {
  requests: VisitRequest[];
  currentUser: User;
  users: User[];
}

const VisitRequestsWidget: React.FC<VisitRequestsWidgetProps> = ({ requests, currentUser, users }) => {
  const { saveRecord, proGroups, proSectors, proGroupLocations } = useApp();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VisitRequest | null>(null);
  const [actionType, setActionType] = useState<'assign' | 'decline' | null>(null);
  const [reason, setReason] = useState('');
  const [selectedChaplainId, setSelectedChaplainId] = useState('');

  const myRequests = useMemo(() => {
    return requests.filter(req => {
      if (req.status === 'confirmed' || req.status === 'declined') return false;
      if (currentUser.role === UserRole.ADMIN) return true;
      return req.assignedChaplainId === currentUser.id || (req.preferredChaplainId === currentUser.id && !req.assignedChaplainId);
    }).sort((a, b) => new Date(a.date).getTime() - new Date(a.date).getTime());
  }, [requests, currentUser]);

  const getMeetingSector = (req: VisitRequest) => {
      const pg = proGroups.find(g => g.name === req.pgName && g.unit === req.unit);
      if (pg) {
          const loc = proGroupLocations.find(l => l.groupId === pg.id);
          if (loc) {
              const sec = proSectors.find(s => s.id === loc.sectorId);
              return sec ? sec.name : 'Setor não informado';
          }
      }
      return 'Setor não informado';
  };

  if (myRequests.length === 0) return null;

  const handleUpdateStatus = async (req: VisitRequest, newStatus: string, notes?: string, assignedId?: string) => {
    setIsProcessing(true);
    try {
      const updatedReq = {
        ...req,
        status: newStatus,
        chaplainResponse: notes || req.chaplainResponse,
        assignedChaplainId: assignedId || req.assignedChaplainId,
        isRead: false
      };
      await saveRecord('visitRequests', updatedReq);
      showToast(newStatus === 'confirmed' ? 'Visita confirmada!' : 'Solicitação atualizada.', 'success');
      setSelectedRequest(null);
      setActionType(null);
    } catch (e) {
      showToast('Erro ao atualizar.', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return dateString; }
  };

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-blue-100 shadow-lg mb-8 animate-in slide-in-from-top duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center animate-pulse"><i className="fas fa-bell text-lg"></i></div>
        <div>
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Agenda de Pequenos Grupos</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{myRequests.length} convite(s) pendente(s)</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {myRequests.map(req => {
          const sector = getMeetingSector(req);
          const waLink = req.leaderPhone ? `https://wa.me/55${req.leaderPhone.replace(/\D/g, '')}` : null;
          
          return (
            <div key={req.id} className="min-w-[280px] max-w-[300px] bg-slate-50 p-5 rounded-[2rem] border border-slate-200 flex flex-col justify-between relative group">
              {req.status === 'pending' && <span className="absolute top-4 right-4 w-3 h-3 bg-amber-400 rounded-full animate-ping"></span>}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-start">
                  <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase">{req.unit}</span>
                  <span className="text-[10px] font-bold text-slate-400">{formatDate(req.date)}</span>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-sm leading-tight mb-1">{req.pgName}</h4>
                  <p className="text-[9px] text-blue-600 font-black uppercase flex items-center gap-1 mb-2">
                    <i className="fas fa-map-marker-alt"></i> {sector}
                  </p>
                  <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Líder do Grupo</p>
                        <p className="text-[10px] font-bold text-slate-700 truncate">{req.leaderName}</p>
                    </div>
                    {waLink && (
                        <a href={waLink} target="_blank" rel="noreferrer" className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                            <i className="fab fa-whatsapp"></i>
                        </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                {currentUser.role === UserRole.ADMIN ? (
                  <button onClick={() => { setSelectedRequest(req); setActionType('assign'); }} className="flex-1 bg-slate-800 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Designar</button>
                ) : (
                  <>
                    <button onClick={() => handleUpdateStatus(req, 'confirmed')} disabled={isProcessing} className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200">Aceitar</button>
                    <button onClick={() => { setSelectedRequest(req); setActionType('decline'); }} className="flex-1 bg-rose-100 text-rose-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Recusar</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => { setSelectedRequest(null); setActionType(null); }} />
          <div className="relative bg-white w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300">
            <h4 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight">{actionType === 'assign' ? 'Designar Capelão' : 'Motivo da Recusa'}</h4>
            {actionType === 'assign' ? (
              <div className="space-y-4">
                <select className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-xs" value={selectedChaplainId} onChange={e => setSelectedChaplainId(e.target.value)}>
                  <option value="">Selecione um Capelão...</option>
                  {users.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
                </select>
                <button onClick={() => selectedChaplainId && handleUpdateStatus(selectedRequest, 'assigned', undefined, selectedChaplainId)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase">Confirmar Designação</button>
              </div>
            ) : (
              <div className="space-y-4">
                <textarea className="w-full p-4 bg-slate-50 border-none rounded-xl font-medium text-xs h-24" placeholder="Justificativa..." value={reason} onChange={e => setReason(e.target.value)}/>
                <button onClick={() => reason && handleUpdateStatus(selectedRequest, 'declined', reason)} className="w-full py-4 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase">Confirmar Recusa</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitRequestsWidget;
