
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ReplicateScaleModalProps {
  selectedMonth: string;
  onClose: () => void;
  onConfirm: (targetMonth: string) => Promise<void>;
  isSaving: boolean;
  formatMonthLabel: (iso: string) => string;
}

const ReplicateScaleModal: React.FC<ReplicateScaleModalProps> = ({
  selectedMonth,
  onClose,
  onConfirm,
  isSaving,
  formatMonthLabel
}) => {
  const [targetMonth, setTargetMonth] = useState('');

  const handleConfirm = () => {
    if (!targetMonth) return;
    onConfirm(targetMonth);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-2 relative">
          <button onClick={onClose} className="absolute -top-2 -right-2 p-2 text-slate-400 hover:text-slate-600 transition-all">
            <X size={20} />
          </button>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Replicar Escala</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Copiar agenda de {formatMonthLabel(selectedMonth)}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Mês de Destino</label>
            <input
              type="month"
              value={targetMonth.substring(0, 7)}
              onChange={e => setTargetMonth(e.target.value + '-01')}
              className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSaving || !targetMonth}
              className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Copiando...' : 'Confirmar Cópia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplicateScaleModal;
