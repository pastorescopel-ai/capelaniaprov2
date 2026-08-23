import React from 'react';
import { motion } from 'motion/react';

interface MonthComparisonBadgeProps {
  label: string; // ex: "Estudos", "Classes", "PGs", "Visitas"
  current: number;
  prev: number;
  deltaPct: number;
  prevMonthLabel: string;
}

// Selo compacto "vs. mês anterior" pro cabeçalho dos 4 formulários de registro -- mesmo
// espírito do "Alcance Pessoal" do Dashboard, só que resumido numa linha só (sem barras) pra
// caber ao lado do título sem brigar por espaço com os botões de ação do formulário.
const MonthComparisonBadge: React.FC<MonthComparisonBadgeProps> = ({ label, current, prev, deltaPct, prevMonthLabel }) => {
  const isUp = current > prev;
  const isDown = prev > 0 && current < prev;
  const tone = isDown ? 'bg-rose-50 text-rose-700 border-rose-100' : isUp ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${tone}`}
      title={`${current} ${label.toLowerCase()} este mês vs ${prev} em ${prevMonthLabel}`}
    >
      <i className={`fas ${isDown ? 'fa-arrow-trend-down' : isUp ? 'fa-arrow-trend-up' : 'fa-minus'} text-[9px]`}></i>
      <span>{current} este mês</span>
      <span className="opacity-50 font-bold normal-case">vs {prev} em {prevMonthLabel}</span>
      {(isUp || isDown) && (
        <span className="font-black">{isUp ? '▲' : '▼'} {Math.abs(deltaPct)}%</span>
      )}
    </motion.div>
  );
};

export default MonthComparisonBadge;
