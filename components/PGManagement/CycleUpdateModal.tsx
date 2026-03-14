
import React from 'react';

interface CycleUpdateModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  selectedMonth: string;
  memberCount: number;
}

const CycleUpdateModal: React.FC<CycleUpdateModalProps> = ({ isOpen, onCancel, onConfirm, selectedMonth, memberCount }) => {
  if (!isOpen) return null;

  const [year, month] = selectedMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <i className="fas fa-sync-alt text-blue-500"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Ajustar Ciclo e Datas</h3>
          <p className="text-slate-500 text-sm mb-6">
            Você está prestes a ajustar o Ciclo de Competência e a Data de Entrada de <span className="font-bold text-slate-700">{memberCount} membros</span> para <span className="font-bold text-blue-600 capitalize">{monthName}</span>.
          </p>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
            <div className="flex gap-3">
              <i className="fas fa-exclamation-triangle text-amber-500 mt-0.5"></i>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Esta ação irá sobrescrever o <span className="font-bold">joined_at</span> de todos os membros ativos deste PG para o dia 01 do mês selecionado às 12:00:00, garantindo consistência no B.I.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors">Cancelar</button>
            <button onClick={onConfirm} className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">Ajustar Agora</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CycleUpdateModal;
