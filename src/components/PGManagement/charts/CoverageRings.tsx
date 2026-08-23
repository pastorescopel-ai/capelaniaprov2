
import React, { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue } from 'motion/react';
import CountUp from '../../Shared/CountUp';

interface RingDatum {
  label: string;
  pct: number;
  color: string; // classe Tailwind de cor de texto/stroke, ex: 'text-[#005a9c]'
}

interface CoverageRingsProps {
  outer: RingDatum;
  inner: RingDatum;
}

const HIDDEN_LABEL = { opacity: 0, x: -6 };

// Um anel isolado que sabe crescer sozinho (igual o CountUp sabe contar sozinho): usa
// useInView + animate() imperativo no próprio strokeDashoffset, em vez de depender de um
// "isVisible" repassado corretamente por 3 componentes pai -- assim funciona mesmo se algum
// elo dessa cadeia de props quebrar, e sempre reanima ao entrar na tela de novo (troca de aba
// e volta, ou rolagem).
const Ring: React.FC<{ cx: number; cy: number; r: number; strokeWidth: number; pct: number; colorClass: string; delay?: number }> = ({ cx, cy, r, strokeWidth, pct, colorClass, delay = 0 }) => {
  const ref = useRef<SVGCircleElement>(null);
  const isInView = useInView(ref, { once: false, margin: '-20px' });
  const circumference = 2 * Math.PI * r;
  const offset = useMotionValue(circumference);

  useEffect(() => {
    if (!isInView) {
      offset.set(circumference);
      return;
    }
    const controls = animate(offset, circumference - (circumference * pct) / 100, {
      duration: 1, ease: 'easeOut', delay
    });
    return controls.stop;
  }, [isInView, pct, circumference, delay]);

  return (
    <motion.circle
      ref={ref}
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
const CoverageRings: React.FC<CoverageRingsProps> = ({ outer, inner }) => {
  const size = 128;
  const center = size / 2;
  const strokeWidth = 12;
  const outerR = center - strokeWidth / 2 - 2;
  const innerR = outerR - strokeWidth - 6;

  const legendRef = useRef<HTMLDivElement>(null);
  const isLegendInView = useInView(legendRef, { once: false, margin: '-20px' });

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={center} cy={center} r={outerR} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100" />
          <Ring cx={center} cy={center} r={outerR} strokeWidth={strokeWidth} pct={outer.pct} colorClass={outer.color} />
          <circle cx={center} cy={center} r={innerR} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100" />
          <Ring cx={center} cy={center} r={innerR} strokeWidth={strokeWidth} pct={inner.pct} colorClass={inner.color} delay={0.15} />
        </svg>
        {/* Os dois percentuais ficam dentro do anel, empilhados na cor do respectivo anel --
            "contam" subindo ao aparecer, igual aos cartões de estatística do Dashboard. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className={`text-xl font-black ${outer.color}`}>
            <CountUp value={Math.round(outer.pct)} duration={0.9} />%
          </span>
          <span className={`text-xs font-black mt-0.5 ${inner.color}`}>
            <CountUp value={Math.round(inner.pct)} duration={0.9} />%
          </span>
        </div>
      </div>
      <div ref={legendRef} className="flex flex-col gap-2.5">
        <motion.div
          initial={HIDDEN_LABEL}
          animate={isLegendInView ? { opacity: 1, x: 0 } : HIDDEN_LABEL}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-2"
        >
          <span className={`w-3 h-3 rounded-full bg-current ${outer.color}`} />
          <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{outer.label}</span>
        </motion.div>
        <motion.div
          initial={HIDDEN_LABEL}
          animate={isLegendInView ? { opacity: 1, x: 0 } : HIDDEN_LABEL}
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
