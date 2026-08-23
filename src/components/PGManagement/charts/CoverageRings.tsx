
import React, { useEffect, useRef } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import CountUp from '../../Shared/CountUp';

interface RingDatum {
  label: string;
  pct: number;
  color: string; // classe Tailwind de cor de texto/stroke, ex: 'text-[#005a9c]'
}

interface CoverageRingsProps {
  outer: RingDatum;
  inner: RingDatum;
  // Normalmente true -- PGDashboard.tsx dá um `key` novo pro componente toda vez que a pessoa
  // sai da aba de Gestão de PGs e volta, forçando um remonte que reanima o anel do zero.
  animate?: boolean;
}

const HIDDEN_LABEL = { opacity: 0, x: -6 };
const VISIBLE_LABEL = { opacity: 1, x: 0 };

// Um anel isolado que sabe crescer sozinho. Quando `animate` é true, faz o traço crescer do
// zero até o valor final; quando é false, já nasce no valor final, sem transição nenhuma.
const Ring: React.FC<{ cx: number; cy: number; r: number; strokeWidth: number; pct: number; colorClass: string; delay?: number; animate: boolean }> = ({ cx, cy, r, strokeWidth, pct, colorClass, delay = 0, animate: shouldAnimate }) => {
  const circumference = 2 * Math.PI * r;
  const target = circumference - (circumference * pct) / 100;
  const offset = useMotionValue(shouldAnimate ? circumference : target);

  useEffect(() => {
    if (!shouldAnimate) {
      offset.set(target);
      return;
    }
    const controls = animate(offset, target, { duration: 1, ease: 'easeOut', delay });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate, pct, circumference, delay]);

  return (
    <motion.circle
      cx={cx} cy={cy} r={r} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent"
      strokeLinecap="round"
      className={colorClass}
      strokeDasharray={circumference}
      style={{ strokeDashoffset: offset }}
    />
  );
};

// Dois anéis concêntricos comparando a cobertura das duas unidades no mesmo desenho -- os
// percentuais ficam os dois DENTRO do anel (empilhados, cada um na cor do seu anel); do lado
// de fora só a legenda (cor + nome da unidade, sem repetir o número).
const CoverageRings: React.FC<CoverageRingsProps> = ({ outer, inner, animate: shouldAnimate = true }) => {
  const size = 128;
  const center = size / 2;
  const strokeWidth = 12;
  const outerR = center - strokeWidth / 2 - 2;
  const innerR = outerR - strokeWidth - 6;

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={center} cy={center} r={outerR} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100" />
          <Ring cx={center} cy={center} r={outerR} strokeWidth={strokeWidth} pct={outer.pct} colorClass={outer.color} animate={shouldAnimate} />
          <circle cx={center} cy={center} r={innerR} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100" />
          <Ring cx={center} cy={center} r={innerR} strokeWidth={strokeWidth} pct={inner.pct} colorClass={inner.color} delay={0.15} animate={shouldAnimate} />
        </svg>
        {/* Os dois percentuais ficam dentro do anel, empilhados na cor do respectivo anel --
            "contam" subindo ao aparecer (só na primeira entrada da sessão). */}
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className={`text-xl font-black ${outer.color}`}>
            {shouldAnimate ? <CountUp value={Math.round(outer.pct)} duration={0.9} /> : Math.round(outer.pct)}%
          </span>
          <span className={`text-xs font-black mt-0.5 ${inner.color}`}>
            {shouldAnimate ? <CountUp value={Math.round(inner.pct)} duration={0.9} /> : Math.round(inner.pct)}%
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <motion.div
          initial={shouldAnimate ? HIDDEN_LABEL : VISIBLE_LABEL}
          animate={VISIBLE_LABEL}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-2"
        >
          <span className={`w-3 h-3 rounded-full bg-current ${outer.color}`} />
          <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{outer.label}</span>
        </motion.div>
        <motion.div
          initial={shouldAnimate ? HIDDEN_LABEL : VISIBLE_LABEL}
          animate={VISIBLE_LABEL}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex items-center gap-2"
        >
          <span className={`w-3 h-3 rounded-full bg-current ${inner.color}`} />
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{inner.label}</span>
        </motion.div>
      </div>
    </div>
  );
};

export default CoverageRings;
