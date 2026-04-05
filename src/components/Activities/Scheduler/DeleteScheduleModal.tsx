
import React from 'react';
import { X } from 'lucide-react';
import { ActivitySchedule } from '../../../types';

interface DeleteScheduleModalProps {
  deletingSchedule: ActivitySchedule;
  hasMultiple: boolean;
  onClose: () => void;
  onConfirm: (type: 'single' | 'all') => Promise<void>;
  isSaving: boolean;
}

const DeleteScheduleModal: React.FC<DeleteScheduleModalProps> = ({
  deletingSchedule,
  hasMultiple,
  onClose,
  onConfirm,
  isSaving
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-2 relative">
          <button onClick={onClose} className="absolute -top-2 -right-2 p-2 text-slate-400 hover:text-slate-600 transition-all">
            <X size={20} />
          </button>
          <h3 className="text-xl font-black text-rose-600 uppercase tracking-tighter">Remover Agendamento</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {deletingSchedule.location}
          </p>
        </div>

        {hasMultiple ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 text-center font-medium">
              Este agendamento se repete em outros dias neste mês. O que você deseja fazer?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => onConfirm('single')}
                disabled={isSaving}
                className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-100 transition-all disabled:opacity-50"
              >
                Apagar SOMENTE deste dia
              </button>
              <button
                onClick={() => onConfirm('all')}
                disabled={isSaving}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-900/20 transition-all disabled:opacity-50"
              >
                Apagar de TODOS os dias do mês
              </button>
              <button
                onClick={onClose}
                className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 text-center font-medium">
              Tem certeza que deseja remover este agendamento?
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => onConfirm('single')}
                disabled={isSaving}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-900/20 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeleteScheduleModal;
