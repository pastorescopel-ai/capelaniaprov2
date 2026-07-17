
import React, { useState, useMemo } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { ActivitySchedule } from '../../../types';

interface ReplicateScaleModalProps {
  selectedMonth: string;
  onClose: () => void;
  onConfirm: (targetMonth: string) => Promise<void>;
  isSaving: boolean;
  formatMonthLabel: (iso: string) => string;
  getPreview: (targetMonth: string) => { toCopy: ActivitySchedule[]; skipped: number; totalSource: number };
}

const ReplicateScaleModal: React.FC<ReplicateScaleModalProps> = ({
  selectedMonth,
  onClose,
  onConfirm,
  isSaving,
  formatMonthLabel,
  getPreview
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [targetMonth, setTargetMonth] = useState('');

  const preview = useMemo(() => {
    if (!targetMonth) return null;
    return getPreview(targetMonth);
  }, [targetMonth, getPreview]);

  const handleContinue = () => {
    if (!targetMonth) return;
    if (targetMonth === selectedMonth) return;
    setStep(2);
  };

  const handleConfirm = () => {
    if (!targetMonth) return;
    onConfirm(targetMonth);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-2 relative">
          {step === 2 && (
            <button onClick={() => setStep(1)} className="absolute -top-2 -left-2 p-2 text-slate-400 hover:text-slate-600 transition-all">
              <ChevronLeft size={20} />
            </button>
          )}
          <button onClick={onClose} className="absolute -top-2 -right-2 p-2 text-slate-400 hover:text-slate-600 transition-all">
            <X size={20} />
          </button>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Replicar Escala</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Copiar agenda de {formatMonthLabel(selectedMonth)}</p>
        </div>

        {step === 1 && (
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

            <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-2xl text-[10px] font-bold text-slate-500">
              <span>Só Blueprint e Setor são copiados (são recorrentes por dia da semana). Encontro e Visite Cantando são eventos de data única e não são replicados.</span>
            </div>

            {targetMonth === selectedMonth && targetMonth !== '' && (
              <p className="text-[10px] font-bold text-rose-500 ml-2">O mês de destino deve ser diferente do atual.</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleContinue}
                disabled={!targetMonth || targetMonth === selectedMonth}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 2 && preview && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase">Destino</span>
                <span className="text-[11px] font-black text-slate-800 uppercase">{formatMonthLabel(targetMonth)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase">Serão copiados</span>
                <span className="text-[11px] font-black text-emerald-600 uppercase">{preview.toCopy.length}</span>
              </div>
              {preview.skipped > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Já existem no destino</span>
                  <span className="text-[11px] font-black text-amber-600 uppercase">{preview.skipped} ignorado(s)</span>
                </div>
              )}
            </div>

            {preview.toCopy.length === 0 ? (
              <p className="text-[10px] font-bold text-rose-500 text-center">Não há nada novo para copiar — o mês de destino já cobre essas vagas de local/dia/período.</p>
            ) : (
              <p className="text-[10px] font-bold text-slate-400 text-center">Vagas que já existem no mês de destino não serão duplicadas.</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSaving || preview.toCopy.length === 0}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Copiando...' : `Copiar ${preview.toCopy.length}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReplicateScaleModal;
