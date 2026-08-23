
import React, { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react';

export interface PersonalAchievementDatum {
  name: string;
  current: number;
  prev: number;
  color: string; // hex, ex: '#3b82f6'
  onClick?: () => void;
}

interface PersonalAchievementProps {
  data: PersonalAchievementDatum[];
  // Rótulo do "mês passado" pra usar na legenda/mensagem de alerta (ex: "Julho").
  prevMonthLabel: string;
}

// Uma barrinha do par (mês passado ou este mês). Sabe crescer sozinha (useInView próprio) --
// reanima toda vez que entra na tela, igual aos outros gráficos do Dashboard.
const Bar: React.FC<{ value: number; maxHeightPx: number; color: string; delay: number }> = ({ value, maxHeightPx, color, delay }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: '-20px' });
  const height = useMotionValue(0);

  useEffect(() => {
    if (!isInView) { height.set(0); return; }
    const controls = animate(height, maxHeightPx, { duration: 0.8, ease: 'easeOut', delay });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, maxHeightPx, delay]);

  return <motion.div ref={ref} className="w-7 sm:w-8 rounded-t-md rounded-b-sm" style={{ height, backgroundColor: color }} />;
};

// Alcance Pessoal -- substitui o antigo "Desempenho Individual" (que só mostrava o número
// absoluto do mês, sem dizer se isso é bom ou ruim). Cada categoria vira um cartão com duas
// barrinhas lado a lado (mês passado x este mês); o cartão que caiu fica destacado em vermelho
// e entra no alerta do topo. Clicar em qualquer parte do cartão leva pro formulário daquele
// tipo de registro.
const PersonalAchievement: React.FC<PersonalAchievementProps> = ({ data, prevMonthLabel }) => {
  const barsMaxHeightPx = 64;
  const globalMax = Math.max(...data.flatMap(d => [d.current, d.prev]), 1);

  const dropped = data.filter(d => d.prev > 0 && d.current < d.prev);
  const worst = dropped.sort((a, b) => (a.current - a.prev) / a.prev - (b.current - b.prev) / b.prev)[0];
  const worstPct = worst ? Math.round(Math.abs(((worst.current - worst.prev) / worst.prev) * 100)) : 0;
  const worstDeficit = worst ? worst.prev - worst.current : 0;

  return (
    <div>
      {worst && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3 mb-5">
          <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0">
            <i className="fas fa-triangle-exclamation text-xs"></i>
          </div>
          <p className="text-xs font-bold text-rose-700 leading-snug">
            Atenção: suas <b className="font-black">{worst.name}</b> estão <b className="font-black">{worstPct}% abaixo</b> de {prevMonthLabel} -- faltam {worstDeficit} pra igualar.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.map((d, i) => {
          const isDown = d.prev > 0 && d.current < d.prev;
          const isUp = d.current > d.prev;
          const deltaPct = d.prev > 0 ? Math.round(((d.current - d.prev) / d.prev) * 100) : (d.current > 0 ? 100 : 0);
          return (
            <motion.div
              key={d.name}
              role={d.onClick ? 'button' : undefined}
              tabIndex={d.onClick ? 0 : undefined}
              onClick={d.onClick}
              onKeyDown={d.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.onClick!(); } } : undefined}
              whileHover={d.onClick ? { y: -2 } : undefined}
              className={`rounded-2xl p-3 text-center ${d.onClick ? 'cursor-pointer' : ''} ${isDown ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50 border border-transparent'}`}
            >
              <p className={`text-[9px] font-black uppercase tracking-wide ${isDown ? 'text-rose-600' : 'text-slate-500'}`}>{d.name}</p>
              <div className="flex items-end justify-center gap-3 mt-2" style={{ height: barsMaxHeightPx }}>
                <div className="flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[9px] font-bold text-slate-400">{d.prev}</span>
                  <Bar value={d.prev} maxHeightPx={(d.prev / globalMax) * barsMaxHeightPx} color="#cbd5e1" delay={i * 0.05} />
                </div>
                <div className="flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[9px] font-black text-slate-800">{d.current}</span>
                  <Bar value={d.current} maxHeightPx={(d.current / globalMax) * barsMaxHeightPx} color={d.color} delay={i * 0.05 + 0.1} />
                </div>
              </div>
              <span className={`inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full ${
                isUp ? 'bg-emerald-100 text-emerald-700' : isDown ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500'
              }`}>
                {isUp ? '▲' : isDown ? '▼' : '='} {Math.abs(deltaPct)}%
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-dashed border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 rounded-sm bg-slate-300" /> {prevMonthLabel} (mês passado)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 rounded-sm bg-blue-500" /> Este mês</span>
      </div>
      <p className="text-[9px] font-bold text-slate-400 mt-1.5 normal-case tracking-normal">
        Quanto mais alta a barra colorida em relação à cinza, melhor o mês está indo -- toque num cartão pra abrir o formulário daquele registro.
      </p>
    </div>
  );
};

export default PersonalAchievement;
