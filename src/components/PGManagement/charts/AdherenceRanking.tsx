
import React, { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';

export interface AdherenceRankingDatum {
  id: string;
  name: string;
  pct: number;
  onClick?: () => void;
}

interface AdherenceRankingProps {
  data: AdherenceRankingDatum[];
  title: string;
  // Passe `null` explicitamente pra esconder de vez a linha/legenda de meta (contextos sem uma
  // meta definida, ex: engajamento de Embaixadores) -- omitir o prop mantém a meta padrão 80%.
  metaPct?: number | null;
  // Normalmente true -- quem controla se isso reanima ou não é o `key` que o componente pai
  // (ex: PGDashboard.tsx) dá pra esta lista: um remonte reanima do zero, um re-render comum
  // (busca, filtro) não.
  animate?: boolean;
}

const colorFor = (pct: number) => pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500';
const textColorFor = (pct: number) => pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600';

const Row: React.FC<{ d: AdherenceRankingDatum; index: number; metaPct?: number | null; animate: boolean }> = ({ d, index, metaPct, animate: shouldAnimate }) => {
  const width = useMotionValue(shouldAnimate ? 0 : d.pct);
  const roundedPct = useTransform(width, latest => `${Math.round(latest)}%`);

  useEffect(() => {
    if (!shouldAnimate) {
      width.set(d.pct);
      return;
    }
    const controls = animate(width, d.pct, { duration: 0.9, ease: 'easeOut', delay: index * 0.05 });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate, d.pct, index]);

  return (
    <motion.div
      role={d.onClick ? 'button' : undefined}
      tabIndex={d.onClick ? 0 : undefined}
      onClick={d.onClick}
      onKeyDown={d.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.onClick!(); } } : undefined}
      whileHover={d.onClick ? { x: 2 } : undefined}
      className={`w-full flex items-center gap-3 group ${d.onClick ? 'cursor-pointer' : ''}`}
    >
      <span className="w-28 flex-shrink-0 text-[10px] font-black text-slate-500 uppercase tracking-wide truncate text-right" title={d.name}>
        {d.name}
      </span>
      <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden relative">
        {typeof metaPct === 'number' && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-slate-300 z-10" style={{ left: `${metaPct}%` }} />
        )}
        <motion.div
          className={`h-full rounded-lg group-hover:brightness-110 transition-[filter] ${colorFor(d.pct)}`}
          style={{ width: useTransform(width, w => `${w}%`) }}
        />
      </div>
      <span className={`w-10 flex-shrink-0 text-xs font-black tabular-nums text-right ${textColorFor(d.pct)}`}>
        <motion.span>{roundedPct}</motion.span>
      </span>
    </motion.div>
  );
};

// Ranking de adesão ordenado do maior pro menor -- versão compacta de "quem precisa de
// atenção primeiro", complementar aos cards detalhados de cada setor/PG logo abaixo (que
// continuam existindo com o botão de ver colaboradores). Reaproveitado também em Embaixadores.
const AdherenceRanking: React.FC<AdherenceRankingProps> = ({ data, title, metaPct = 80, animate: shouldAnimate = true }) => {
  const sorted = [...data].sort((a, b) => b.pct - a.pct);
  if (sorted.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          <i className="fas fa-ranking-star text-blue-600"></i> {title}
        </h3>
        {typeof metaPct === 'number' && (
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="w-2 h-3 bg-slate-300 inline-block rounded-sm" /> Meta {metaPct}%
          </div>
        )}
      </div>
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-5">
        Ordenado do maior pro menor -- toque numa barra pra ver os detalhes
      </p>
      <div className="space-y-2.5">
        {sorted.map((d, i) => <Row key={d.id} d={d} index={i} metaPct={metaPct} animate={shouldAnimate} />)}
      </div>
    </div>
  );
};

export default AdherenceRanking;
