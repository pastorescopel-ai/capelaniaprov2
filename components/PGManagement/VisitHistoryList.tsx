
import React from 'react';
import { VisitRequest, User, UserRole } from '../../types';

interface VisitHistoryListProps {
  requests: VisitRequest[];
  users: User[];
  currentUser: User | null;
  editingRequestId: string | null;
  onEdit: (req: VisitRequest) => void;
  onDelete: (id: string) => void;
}

const VisitHistoryList: React.FC<VisitHistoryListProps> = ({ 
  requests, 
  users, 
  currentUser, 
  editingRequestId, 
  onEdit, 
  onDelete 
}) => {
  if (requests.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-[2rem]">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Tudo em dia!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-black text-slate-400 uppercase text-xs tracking-widest px-4">Histórico de Agendamentos Recentes</h3>
      {requests.map(req => {
        const chaplain = users.find(u => u.id === req.assignedChaplainId);
        return (
          <div key={req.id} className={`bg-white p-6 rounded-[2rem] border transition-all shadow-sm flex items-center justify-between group ${
            editingRequestId === req.id ? 'border-blue-500 ring-1 ring-blue-100' : 'border-slate-100'
          }`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${req.status === 'assigned' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                <h4 className="font-bold text-slate-800 text-sm uppercase truncate">{req.pgName}</h4>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase truncate">Designado: {chaplain?.name || 'Aguardando'}</p>
            </div>
            <div className="text-right flex items-center gap-4 flex-shrink-0 ml-4">
              <div>
                <span className="block text-[10px] font-black text-slate-600 uppercase tracking-tight">
                  {(() => {
                    try {
                      const datePart = req.date.split('T')[0];
                      const [year, month, day] = datePart.split('-').map(Number);
                      const d = new Date(year, month - 1, day);
                      return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '').toUpperCase();
                    } catch { return req.date; }
                  })()}
                  {req.scheduledTime && ` às ${req.scheduledTime}`}
                </span>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${req.status === 'assigned' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                  {req.status === 'assigned' ? 'Pendente' : 'Designado'}
                </span>
              </div>
              {currentUser?.role === UserRole.ADMIN && (
                <div className="flex items-center gap-2 transition-all">
                  <button 
                    onClick={() => onEdit(req)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                      editingRequestId === req.id ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-500 hover:bg-blue-600 hover:text-white'
                    }`}
                    title="Editar Agendamento"
                  >
                    <i className="fas fa-edit text-xs"></i>
                  </button>
                  <button 
                    onClick={() => onDelete(req.id)}
                    className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                    title="Excluir Convite"
                  >
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VisitHistoryList;
