import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue } from 'motion/react';

interface MonthComparisonBarsProps {
  label: string; // ex: "Estudos", "Classes", "PGs", "Visitas"
  color: string; // hex da barra "este mês", ex: '#3b82f6'
  current: number;
  prev: number;
  deltaPct: number;
  prevMonthLabel: string;
  // Nomes dos registros de cada mês (aluno, PG, colaborador visitado, turma...) -- opcional pra
  // não quebrar quem ainda não passa isso; sem eles o tooltip mostra só a quantidade.
  curNames?: string[];
  prevNames?: string[];
  // Como chamar os itens no cabeçalho do tooltip (ex: "PGs", "alunos") -- usa `label` se omitido.
  itemLabel?: string;
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

// Quantos nomes mostrar antes de resumir em "+N mais" -- a caixa não é rolável (ver comentário
// no ponto de uso), então precisa de um teto fixo em vez de deixar o overflow cortar em silêncio.
const MAX_VISIBLE_NAMES = 10;

type BarKey = 'prev' | 'current';
interface ActivePoint { key: BarKey; x: number; y: number; }

// Uma coluna de barra (mês passado ou este mês) -- passa o mouse (ou toca, no celular) em cima
// pra ver os nomes de quem entrou naquela contagem, numa caixa que acompanha o cursor/dedo.
const BarColumn: React.FC<{
  barKey: BarKey; value: number; heightPx: number; color: string; delay: number; valueTextClass: string;
  onMouseActivate: (key: BarKey, x: number, y: number) => void;
  onMouseDeactivate: () => void;
  onTouchActivate: (key: BarKey, x: number, y: number) => void;
}> = ({ barKey, value, heightPx, color, delay, valueTextClass, onMouseActivate, onMouseDeactivate, onTouchActivate }) => (
  <div
    className="relative flex flex-col items-center gap-1 h-full justify-end cursor-default touch-manipulation"
    onMouseMove={(e) => onMouseActivate(barKey, e.clientX, e.clientY)}
    onMouseLeave={onMouseDeactivate}
    onTouchStart={(e) => {
      const touch = e.touches[0];
      onTouchActivate(barKey, touch.clientX, touch.clientY);
    }}
  >
    <span className={`text-[8px] ${valueTextClass}`}>{value}</span>
    <Bar heightPx={heightPx} color={color} delay={delay} />
  </div>
);

// Mini gráfico de barras "este mês x mês passado" pro cabeçalho dos 4 formulários de registro
// -- mesmo espírito visual do Alcance Pessoal do Dashboard, só que resumido a uma categoria só
// (o formulário já é dessa categoria) pra caber ao lado do título sem brigar por espaço.
const MonthComparisonBars: React.FC<MonthComparisonBarsProps> = ({ label, color, current, prev, deltaPct, prevMonthLabel, curNames, prevNames, itemLabel }) => {
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

  // Tooltip com nomes -- segue o mouse enquanto o cursor está em cima da barra; no celular, um
  // toque abre e prende a caixa perto do dedo até tocar fora dela.
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ActivePoint | null>(null);
  const [pinned, setPinned] = useState(false);

  // clientX/clientY (coordenadas de tela) convertidas pra relativas ao card -- é onde o
  // tooltip precisa ser posicionado, já que ele é absolute dentro do containerRef.
  const toRelative = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleMouseActivate = (key: BarKey, clientX: number, clientY: number) => {
    if (pinned) return;
    const { x, y } = toRelative(clientX, clientY);
    setActive({ key, x, y });
  };
  const handleMouseDeactivate = () => { if (!pinned) setActive(null); };

  const handleTouchActivate = (key: BarKey, clientX: number, clientY: number) => {
    const { x, y } = toRelative(clientX, clientY);
    setActive(prevState => {
      if (pinned && prevState?.key === key) {
        setPinned(false);
        return null;
      }
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

  const names = active ? (active.key === 'current' ? curNames : prevNames) : undefined;
  const activeMonthLabel = active ? (active.key === 'current' ? currentMonthLabel : prevMonthLabel) : '';
  const activeValue = active ? (active.key === 'current' ? current : prev) : 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: -4 }}
        whileHover={{ y: -3, boxShadow: '0 8px 20px -4px rgba(0,0,0,0.12)' }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`relative inline-flex items-center gap-4 px-4 py-2.5 rounded-2xl border ${tone}`}
      >
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label} este mês</span>
          <span className={`text-lg font-black leading-tight ${numberTone}`}>{current}</span>
        </div>

        <div className="flex items-end justify-center gap-2.5" style={{ height: barsMaxHeightPx }}>
          <BarColumn
            barKey="prev" value={prev} heightPx={(prev / max) * barsMaxHeightPx} color="#cbd5e1" delay={0}
            valueTextClass="font-bold text-slate-400"
            onMouseActivate={handleMouseActivate}
            onMouseDeactivate={handleMouseDeactivate}
            onTouchActivate={handleTouchActivate}
          />
          <BarColumn
            barKey="current" value={current} heightPx={(current / max) * barsMaxHeightPx} color={color} delay={0.1}
            valueTextClass="font-black text-slate-700"
            onMouseActivate={handleMouseActivate}
            onMouseDeactivate={handleMouseDeactivate}
            onTouchActivate={handleTouchActivate}
          />
        </div>

        <div className="flex flex-col items-start gap-0.5">
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
            isUp ? 'bg-emerald-100 text-emerald-700' : isDown ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {isUp ? '▲' : isDown ? '▼' : '='} {Math.abs(deltaPct)}%
          </span>
          <span className="text-[8px] font-bold text-slate-400 normal-case whitespace-nowrap">vs {prevMonthLabel}</span>
        </div>

        {active && (
          <div
            className="absolute z-20 bg-slate-800 text-white rounded-xl px-3 py-2 shadow-xl pointer-events-none min-w-[140px] max-w-[220px]"
            style={{ left: Math.min(active.x + 14, 260), top: active.y - 10 }}
          >
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-300 capitalize mb-1">
              {activeMonthLabel}: {activeValue} {itemLabel || label}
            </p>
            {names && names.length > 0 ? (
              // A caixa é pointer-events-none (pra não atrapalhar o hover na barra embaixo dela),
              // então não dá pra rolar com o mouse -- em vez de cortar a lista em silêncio com
              // overflow escondido, mostra só o que cabe e avisa quantos ficaram de fora.
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
