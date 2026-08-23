
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
// da proposta aprovada). Toque/clique expande os detalhes completos (VisitGoalWidget) logo
// abaixo, sem precisar sair da tela. A barra e o número crescem sozinhos ao aparecer, e
// reanimam toda vez que a tela volta a ficar visível (mesmo padrão dos outros gráficos).
const VisitProgressStrip: React.FC<VisitProgressStripProps> = ({ accumulated, isExpanded, onToggle }) => {
  const ref = useRef<HTMLButtonElement>(null);
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
    <motion.button
      ref={ref}
      type="button"
      onClick={onToggle}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm hover:border-blue-200 transition-colors text-left"
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
    </motion.button>
  );
};

export default VisitProgressStrip;
