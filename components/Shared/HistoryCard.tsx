
import React, { useState } from 'react';
import { User } from '../../types';

interface HistoryCardProps {
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  chaplainName: string;
  isLocked?: boolean;
  isAdmin?: boolean;
  users?: User[];
  onEdit: () => void;
  onDelete: () => void;
  onTransfer?: (newUserId: string) => void;
  extra?: React.ReactNode;
  middle?: React.ReactNode;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ icon, color, title, subtitle, chaplainName, isLocked, isAdmin, users, onEdit, onDelete, onTransfer, extra, middle }) => {
  const [showTransfer, setShowTransfer] = useState(false);

  return (
    <div className="bg-white p-5 md:p-6 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between shadow-sm hover:border-blue-200 transition-all group gap-4">
      <div className="flex items-center gap-4 flex-1">
        <div className={`w-12 h-12 ${color} bg-opacity-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0`}>{icon}</div>
        <div className="min-w-0">
          <h4 className="font-bold text-slate-800 leading-tight truncate">{title}</h4>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1 truncate">{subtitle}</p>
          <div className="flex items-center gap-1 mt-1">
             <i className="fas fa-user-tie text-[8px] text-blue-400"></i>
             <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter">Responsável: {chaplainName}</span>
          </div>
        </div>
      </div>
      
      {middle && (
        <div className="flex flex-1 justify-center items-center">
          {middle}
        </div>
      )}

      <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
        {extra}
        
        {isLocked ? (
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100" title="Mês encerrado. Edição permitida apenas para administradores.">
            <i className="fas fa-lock text-slate-300 text-xs"></i>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Somente Leitura</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 ml-auto md:ml-0">
            {isAdmin && users && (
              <div className="relative">
                <button 
                  onClick={() => setShowTransfer(!showTransfer)} 
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${showTransfer ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600'}`}
                  title="Transferir Responsável"
                >
                  <i className="fas fa-exchange-alt text-xs"></i>
                </button>
                {showTransfer && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[110] animate-in zoom-in duration-200">
                    <p className="text-[8px] font-black uppercase text-slate-400 p-2 border-b border-slate-50 mb-1">Transferir para:</p>
                    <div className="max-h-40 overflow-y-auto no-scrollbar">
                      {users.map(u => (
                        <button 
                          key={u.id} 
                          onClick={() => { onTransfer?.(u.id); setShowTransfer(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg text-[10px] font-bold text-slate-700 transition-colors uppercase"
                        >
                          {u.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button onClick={onEdit} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors"><i className="fas fa-edit text-xs"></i></button>
            <button onClick={onDelete} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors"><i className="fas fa-trash text-xs"></i></button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryCard;
