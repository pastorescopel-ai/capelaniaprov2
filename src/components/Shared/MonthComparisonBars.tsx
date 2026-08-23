import React, { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue } from 'motion/react';

interface MonthComparisonBarsProps {
  label: string; // ex: "Estudos", "Classes", "PGs", "Visitas"
  color: string; // hex da barra "este mês", ex: '#3b82f6'
  current: number;
  prev: number;
  deltaPct: number;
  prevMonthLabel: string;
}

// Uma barrinha do par -- mesmo padrão "reliable growth" do Alcance Pessoal (useMotionValue +
// animate() imperativo, useInView próprio) pra garantir que ela sempre cresça de verdade ao
// aparecer, em vez de depender de initial/animate declarativo.
const Bar: React.FC<{ heightPx: number; color: string; delay: number }> = ({ heightPx, color, delay }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: '-10px' });
  const height = useMotionValue(0);

  useEffect(() => {
    if (!isInView) { height.set(0); return; }
    const controls = animate(height, heightPx, { duration: 0.7, ease: 'easeOut', delay });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, heightPx, delay]);

  return <motion.div ref={ref} className="w-6 sm:w-7 rounded-t-md rounded-b-sm" style={{ height, backgroundColor: color }} />;
};

// Uma coluna de barra (mês passado ou este mês) com tooltip -- passa o mouse em cima pra ver o
// nome do mês e a quantidade exata, sem precisar decorar o que cada barrinha representa.
const BarColumn: React.FC<{ monthLabel: string; value: number; heightPx: number; color: string; delay: number; valueTextClass: string }> = ({ monthLabel, value, heightPx, color, delay, valueTextClass }) => (
  <div className="group relative flex flex-col items-center gap-1 h-full justify-end cursor-default">
    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800 text-white text-[9px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 capitalize">
      {monthLabel}: {value}
    </div>
    <span className={`text-[8px] ${valueTextClass}`}>{value}</span>
    <Bar heightPx={heightPx} color={color} delay={delay} />
  </div>
);

// Mini gráfico de barras "este mês x mês passado" pro cabeçalho dos 4 formulários de registro
// -- mesmo espírito visual do Alcance Pessoal do Dashboard, só que resumido a uma categoria só
// (o formulário já é dessa categoria) pra caber ao lado do título sem brigar por espaço.
const MonthComparisonBars: React.FC<MonthComparisonBarsProps> = ({ label, color, current, prev, deltaPct, prevMonthLabel }) => {
  const barsMaxHeightPx = 40;
  const max = Math.max(current, prev, 1);
  const isDown = current < prev;
  const isUp = current > prev;
  // "Mês igual" (neutro) é current === prev, incluindo os dois zerados -- fundo amarelo claro
  // pra diferenciar de "subiu" (verde) e "caiu" (vermelho), a pedido do usuário.
  const tone = isUp
    ? 'bg-emerald-50 border-emerald-100'
    : isDown
    ? 'bg-rose-50 border-rose-100'
    : 'bg-amber-50 border-amber-100';
  const numberTone = isUp ? 'text-emerald-700' : isDown ? 'text-rose-600' : 'text-amber-700';
  const currentMonthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        whileHover={{ y: -3, boxShadow: '0 8px 20px -4px rgba(0,0,0,0.12)' }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`inline-flex items-center gap-4 px-4 py-2.5 rounded-2xl border ${tone}`}
      >
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label} este mês</span>
          <span className={`text-lg font-black leading-tight ${numberTone}`}>{current}</span>
        </div>

        <div className="flex items-end justify-center gap-2.5" style={{ height: barsMaxHeightPx }}>
          <BarColumn monthLabel={prevMonthLabel} value={prev} heightPx={(prev / max) * barsMaxHeightPx} color="#cbd5e1" delay={0} valueTextClass="font-bold text-slate-400" />
          <BarColumn monthLabel={currentMonthLabel} value={current} heightPx={(current / max) * barsMaxHeightPx} color={color} delay={0.1} valueTextClass="font-black text-slate-700" />
        </div>

        <div className="flex flex-col items-start gap-0.5">
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
            isUp ? 'bg-emerald-100 text-emerald-700' : isDown ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {isUp ? '▲' : isDown ? '▼' : '='} {Math.abs(deltaPct)}%
          </span>
          <span className="text-[8px] font-bold text-slate-400 normal-case whitespace-nowrap">vs {prevMonthLabel}</span>
        </div>
      </motion.div>

      {/* Legenda das cores de fundo do cartão -- pra não precisar adivinhar o que verde,
          amarelo e vermelho significam à primeira vista. */}
      <div className="flex items-center gap-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Subiu</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Igual</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Caiu</span>
      </div>
    </div>
  );
};

export default MonthComparisonBars;
