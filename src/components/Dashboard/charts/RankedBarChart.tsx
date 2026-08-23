
import React from 'react';
import { motion } from 'motion/react';

export interface RankedBarDatum {
  name: string;
  value: number;
  color: string; // cor sólida em hex, ex: '#3b82f6'
  onClick?: () => void;
}

interface RankedBarChartProps {
  data: RankedBarDatum[];
  inView: boolean;
}

// Barras horizontais ordenadas do maior pro menor -- em vez de 4 colunas verticais do mesmo
// tamanho lado a lado (difícil comparar de relance), fica óbvio pra qual atividade o esforço
// do mês foi maior sem precisar ler os números. Cada barra é clicável (leva pro formulário
// daquele tipo de registro) e mostra o valor sempre visível, sem precisar de hover.
const RankedBarChart: React.FC<RankedBarChartProps> = ({ data, inView }) => {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map(d => d.value), 1);

  return (
    <div className="space-y-3">
      {sorted.map((d, i) => {
        const pct = Math.max((d.value / max) * 100, 4);
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
            <span className="w-16 flex-shrink-0 text-[10px] font-black text-slate-500 uppercase tracking-wide text-right">
              {d.name}
            </span>
            <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={inView ? { width: `${pct}%` } : { width: 0 }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeOut' }}
                className="h-full rounded-lg group-hover:brightness-110 transition-[filter]"
                style={{ backgroundColor: d.color }}
              />
            </div>
            <span className="w-8 flex-shrink-0 text-xs font-black text-slate-800 tabular-nums text-right">
              {d.value}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

export default RankedBarChart;
