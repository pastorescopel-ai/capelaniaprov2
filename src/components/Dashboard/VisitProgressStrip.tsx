
import React, { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react';

interface AccumulatedGoal {
  expected: number;
  current: number;
  deficit: number;
  historicalTotal: number;
  status: 'success' | 'warning' | 'critical';
}

interface VisitProgressStripProps {
  accumulated: AccumulatedGoal | null;
  isExpanded: boolean;
  onToggle: () => void;
}

const STATUS_FILL: Record<AccumulatedGoal['status'], string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-400',
  critical: 'bg-rose-500',
};
const STATUS_ICON_BG: Record<AccumulatedGoal['status'], string> = {
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  critical: 'bg-rose-50 text-rose-600',
};

// Versão compacta do card "Metas de Visitas" -- uma faixa fina com barra de progresso (Opção A
// da proposta aprovada). Clicar em qualquer lugar da faixa expande os detalhes completos
// (VisitGoalWidget) logo abaixo -- ir pro formulário de Visita ao Colaborador é ação do card
// expandido, não da faixa fechada (ver Dashboard/index.tsx). A barra e o número crescem
// sozinhos ao aparecer, e reanimam toda vez que a tela volta a ficar visível.
const VisitProgressStrip: React.FC<VisitProgressStripProps> = ({ accumulated, isExpanded, onToggle }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: '-20px' });
  const width = useMotionValue(0);
  const current = useMotionValue(0);
  const roundedCurrent = useTransform(current, latest => Math.round(latest).toLocaleString('pt-BR'));

  if (!accumulated) return null;
  const { expected, current: currentVal, status } = accumulated;
  const pct = expected > 0 ? Math.min((currentVal / expected) * 100, 100) : 0;

  useEffect(() => {
    if (!isInView) {
      width.set(0);
      current.set(0);
      return;
    }
    const c1 = animate(width, pct, { duration: 1, ease: 'easeOut' });
    const c2 = animate(current, currentVal, { duration: 1, ease: 'easeOut' });
    return () => { c1.stop(); c2.stop(); };
  }, [isInView, pct, currentVal]);

  return (
    <div className="w-full">
      <motion.div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97, rotateX: 8, y: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        style={{ transformPerspective: 700 }}
        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm hover:border-blue-200 hover:shadow-md transition-[border-color,box-shadow] cursor-pointer select-none"
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${STATUS_ICON_BG[status]}`}>
          <i className="fas fa-hands-helping text-xs"></i>
        </div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex-shrink-0 hidden sm:inline">
          Visitas
        </span>
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div className={`h-full rounded-full ${STATUS_FILL[status]}`} style={{ width: useTransform(width, w => `${w}%`) }} />
        </div>
        <span className="text-xs font-black text-slate-800 tabular-nums flex-shrink-0">
          <motion.span>{roundedCurrent}</motion.span>
          <span className="text-slate-400 font-bold"> / {expected}</span>
        </span>
        <i className={`fas fa-chevron-down text-[10px] text-slate-300 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
      </motion.div>
      {!isExpanded && (
        <p className="text-[9px] font-black uppercase tracking-wide text-right mt-1.5 mr-1 truncate flex items-center justify-end gap-1 text-[#005a9c]">
          <i className="fas fa-hand-pointer text-[8px] animate-pulse"></i>
          <span className="animate-pulse">Toque para ampliar</span>
        </p>
      )}
    </div>
  );
};

export default VisitProgressStrip;
