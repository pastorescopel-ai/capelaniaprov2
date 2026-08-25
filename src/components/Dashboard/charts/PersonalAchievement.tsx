import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue } from 'motion/react';

export interface PersonalAchievementDatum {
  name: string;
  current: number;
  prev: number;
  color: string; // hex, ex: '#3b82f6'
  // Nomes por trás de cada barra (mesma ideia do tooltip do MonthComparisonBars nos
  // formulários) -- opcional pra não quebrar quem não passa isso.
  curNames?: string[];
  prevNames?: string[];
  onClick?: () => void;
}

interface PersonalAchievementProps {
  data: PersonalAchievementDatum[];
  // Rótulo do "mês passado" pra usar na legenda/mensagem de alerta (ex: "Julho").
  prevMonthLabel: string;
}

// Quantos nomes mostrar antes de resumir em "+N mais" -- a caixa não é rolável (é
// pointer-events-none pra não atrapalhar o hover), então precisa de um teto fixo.
const MAX_VISIBLE_NAMES = 10;

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

type BarKey = 'prev' | 'current';
interface ActivePoint { key: BarKey; x: number; y: number; }

// Um cartão de categoria inteiro -- cuida do próprio tooltip (cada categoria tem seus nomes),
// e do clique/toque pro formulário sem que um atrapalhe o outro: tocar numa barra pra ver os
// nomes não deve também navegar pro formulário.
const AchievementCard: React.FC<{ d: PersonalAchievementDatum; index: number; globalMax: number; barsMaxHeightPx: number }> = ({ d, index, globalMax, barsMaxHeightPx }) => {
  const isDown = d.prev > 0 && d.current < d.prev;
  const isUp = d.current > d.prev;
  const deltaPct = d.prev > 0 ? Math.round(((d.current - d.prev) / d.prev) * 100) : (d.current > 0 ? 100 : 0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ActivePoint | null>(null);
  const [pinned, setPinned] = useState(false);

  const toRelative = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleMouseActivate = (key: BarKey, clientX: number, clientY: number) => {
    if (pinned) return;
    setActive({ key, ...toRelative(clientX, clientY) });
  };
  const handleMouseDeactivate = () => { if (!pinned) setActive(null); };

  const handleTouchActivate = (key: BarKey, clientX: number, clientY: number) => {
    const { x, y } = toRelative(clientX, clientY);
    setActive(prevState => {
      if (pinned && prevState?.key === key) { setPinned(false); return null; }
      setPinned(true);
      return { key, x, y };
    });
  };

  useEffect(() => {
    if (!pinned) return;
    const closeIfOutside = (e: TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPinned(false);
        setActive(null);
      }
    };
    document.addEventListener('touchstart', closeIfOutside);
    return () => document.removeEventListener('touchstart', closeIfOutside);
  }, [pinned]);

  const names = active ? (active.key === 'current' ? d.curNames : d.prevNames) : undefined;
  const activeValue = active ? (active.key === 'current' ? d.current : d.prev) : 0;

  const barColumnProps = (key: BarKey) => ({
    onMouseMove: (e: React.MouseEvent) => handleMouseActivate(key, e.clientX, e.clientY),
    onMouseLeave: handleMouseDeactivate,
    onTouchStart: (e: React.TouchEvent) => {
      e.stopPropagation(); // não deixa o toque também disparar a navegação do cartão
      const t = e.touches[0];
      handleTouchActivate(key, t.clientX, t.clientY);
    },
  });

  return (
    <motion.div
      ref={containerRef}
      role={d.onClick ? 'button' : undefined}
      tabIndex={d.onClick ? 0 : undefined}
      onClick={d.onClick}
      onKeyDown={d.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.onClick!(); } } : undefined}
      whileHover={d.onClick ? { y: -2 } : undefined}
      // z-30 quando o tooltip está aberto -- sem isso, o cartão vizinho no grid (que vem depois
      // no DOM, sem z-index próprio) desenhava por cima da caixa de nomes que vaza pra fora
      // dos limites deste cartão.
      className={`relative rounded-2xl p-3 text-center ${active ? 'z-30' : ''} ${d.onClick ? 'cursor-pointer' : ''} ${isDown ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50 border border-transparent'}`}
    >
      <p className={`text-[9px] font-black uppercase tracking-wide ${isDown ? 'text-rose-600' : 'text-slate-500'}`}>{d.name}</p>
      <div className="flex items-end justify-center gap-3 mt-2" style={{ height: barsMaxHeightPx }}>
        <div className="flex flex-col items-center gap-1 h-full justify-end" {...barColumnProps('prev')}>
          <span className="text-[9px] font-bold text-slate-400">{d.prev}</span>
          <Bar value={d.prev} maxHeightPx={(d.prev / globalMax) * barsMaxHeightPx} color="#cbd5e1" delay={index * 0.05} />
        </div>
        <div className="flex flex-col items-center gap-1 h-full justify-end" {...barColumnProps('current')}>
          <span className="text-[9px] font-black text-slate-800">{d.current}</span>
          <Bar value={d.current} maxHeightPx={(d.current / globalMax) * barsMaxHeightPx} color={d.color} delay={index * 0.05 + 0.1} />
        </div>
      </div>
      <span className={`inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full ${
        isUp ? 'bg-emerald-100 text-emerald-700' : isDown ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500'
      }`}>
        {isUp ? '▲' : isDown ? '▼' : '='} {Math.abs(deltaPct)}%
      </span>

      {active && (
        <div
          className="absolute z-20 bg-slate-800 text-white rounded-xl px-3 py-2 shadow-xl pointer-events-none min-w-[140px] max-w-[220px] text-left"
          style={{ left: Math.min(active.x + 10, 140), top: active.y - 10 }}
        >
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-300 mb-1">
            {active.key === 'current' ? 'Este mês' : 'Mês passado'}: {activeValue} {d.name}
            {names && names.length > 0 && names.length !== activeValue && ` (${names.length} nomes)`}
          </p>
          {names && names.length > 0 ? (
            <div className="space-y-0.5">
              {names.slice(0, MAX_VISIBLE_NAMES).map((n, i) => (
                <p key={i} className="text-[10px] font-bold leading-tight">{n}</p>
              ))}
              {names.length > MAX_VISIBLE_NAMES && (
                <p className="text-[9px] font-bold text-slate-400 pt-0.5">+{names.length - MAX_VISIBLE_NAMES} mais</p>
              )}
            </div>
          ) : (
            <p className="text-[10px] font-bold text-slate-400">{activeValue === 0 ? 'Nenhum registro' : 'Sem detalhes'}</p>
          )}
        </div>
      )}
    </motion.div>
  );
};

// Alcance Pessoal -- substitui o antigo "Desempenho Individual" (que só mostrava o número
// absoluto do mês, sem dizer se isso é bom ou ruim). Cada categoria vira um cartão com duas
// barrinhas lado a lado (mês passado x este mês); o cartão que caiu fica destacado em vermelho
// e entra no alerta do topo. Clicar em qualquer parte do cartão leva pro formulário daquele
// tipo de registro; passar o mouse (ou tocar, no celular) numa barra mostra os nomes por trás
// do número, igual à caixinha que já existe nos formulários.
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
        {data.map((d, i) => (
          <AchievementCard key={d.name} d={d} index={i} globalMax={globalMax} barsMaxHeightPx={barsMaxHeightPx} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-dashed border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 rounded-sm bg-slate-300" /> {prevMonthLabel} (mês passado)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 rounded-sm bg-blue-500" /> Este mês</span>
      </div>
      <p className="text-[9px] font-bold text-slate-400 mt-1.5 normal-case tracking-normal">
        Toque numa barra pra ver os nomes por trás do número -- toque no cartão pra abrir o formulário daquele registro.
      </p>
    </div>
  );
};

export default PersonalAchievement;
