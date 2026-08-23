
import React from 'react';
import { motion } from 'motion/react';

export interface DumbbellDatum {
  name: string;
  prev: number;
  atual: number;
  prevLabel: string; // ex: "Mês Anterior" ou "Ago/2026" -- vem do comparisonLabel já calculado
  onClick?: () => void;
}

interface DumbbellChartProps {
  data: DumbbellDatum[];
  inView: boolean;
}

// Duas bolinhas conectadas por uma linha (uma pro valor anterior, outra pro atual) por
// categoria -- a mesma leitura de "este mês vs. mês passado" que o card de comparação dos
// formulários usa, só que olhando pra equipe inteira. Fica mais fácil ver de relance quem
// subiu (linha/bolinha verde) e quem caiu (rosa) do que comparando a altura de barras
// agrupadas lado a lado.
const DumbbellChart: React.FC<DumbbellChartProps> = ({ data, inView }) => {
  const max = Math.max(...data.flatMap(d => [d.prev, d.atual]), 1) * 1.08;

  return (
    <div className="space-y-4">
      {data.map((d, i) => {
        const isUp = d.atual >= d.prev;
        const color = isUp ? '#059669' : '#e11d48';
        const prevPct = (d.prev / max) * 100;
        const nowPct = (d.atual / max) * 100;
        const segStart = Math.min(prevPct, nowPct);
        const segWidth = Math.abs(nowPct - prevPct);
        const diff = d.atual - d.prev;

        return (
          <motion.div
            key={d.name}
            role={d.onClick ? 'button' : undefined}
            tabIndex={d.onClick ? 0 : undefined}
            onClick={d.onClick}
            onKeyDown={d.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.onClick!(); } } : undefined}
            whileHover={d.onClick ? { x: 2 } : undefined}
            className={`w-full flex items-center gap-3 group ${d.onClick ? 'cursor-pointer' : ''}`}
          >
            <span className="w-14 flex-shrink-0 text-[10px] font-black text-slate-500 uppercase tracking-wide text-right">
              {d.name}
            </span>

            <div className="flex-1 relative h-6 flex items-center">
              <div className="absolute inset-x-0 h-[3px] bg-slate-100 rounded-full" />
              <motion.div
                initial={{ width: 0, left: `${segStart}%` }}
                animate={inView ? { width: `${segWidth}%`, left: `${segStart}%` } : { width: 0, left: `${segStart}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                className="absolute h-[3px] rounded-full"
                style={{ backgroundColor: color }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                transition={{ delay: i * 0.08 + 0.3, type: 'spring', stiffness: 300, damping: 18 }}
                className="absolute w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white shadow-sm"
                style={{ left: `${prevPct}%`, transform: 'translateX(-50%)' }}
                title={`${d.prevLabel}: ${d.prev}`}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                transition={{ delay: i * 0.08 + 0.4, type: 'spring', stiffness: 300, damping: 18 }}
                className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
                style={{ left: `${nowPct}%`, transform: 'translateX(-50%)', backgroundColor: color }}
                title={`Este mês: ${d.atual}`}
              />
            </div>

            <span className="w-16 flex-shrink-0 text-right">
              <span className="text-xs font-black text-slate-800 tabular-nums">{d.atual}</span>
              <span className={`ml-1 text-[9px] font-black ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isUp ? '▲' : '▼'}{Math.abs(diff)}
              </span>
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

export default DumbbellChart;
