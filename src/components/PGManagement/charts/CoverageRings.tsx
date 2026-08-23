
import React from 'react';
import { motion } from 'motion/react';

interface RingDatum {
  label: string;
  pct: number;
  color: string; // classe Tailwind de cor de texto/stroke, ex: 'text-[#005a9c]'
}

interface CoverageRingsProps {
  outer: RingDatum;
  inner: RingDatum;
}

// Dois anéis concêntricos comparando a cobertura das duas unidades no mesmo desenho -- antes
// era preciso trocar de aba (HAB/HABA) pra comparar os dois números; agora aparecem juntos,
// com a unidade que a pessoa está vendo por fora (maior, cor da marca) e a outra por dentro
// (menor, âmbar), mais a legenda com os dois valores ao lado.
const CoverageRings: React.FC<CoverageRingsProps> = ({ outer, inner }) => {
  const size = 128;
  const center = size / 2;
  const strokeWidth = 12;
  const outerR = center - strokeWidth / 2 - 2;
  const innerR = outerR - strokeWidth - 6;
  const outerCirc = 2 * Math.PI * outerR;
  const innerCirc = 2 * Math.PI * innerR;

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={center} cy={center} r={outerR} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100" />
          <motion.circle
            cx={center} cy={center} r={outerR} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent"
            strokeLinecap="round"
            className={outer.color}
            strokeDasharray={outerCirc}
            initial={{ strokeDashoffset: outerCirc }}
            animate={{ strokeDashoffset: outerCirc - (outerCirc * outer.pct) / 100 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          <circle cx={center} cy={center} r={innerR} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100" />
          <motion.circle
            cx={center} cy={center} r={innerR} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent"
            strokeLinecap="round"
            className={inner.color}
            strokeDasharray={innerCirc}
            initial={{ strokeDashoffset: innerCirc }}
            animate={{ strokeDashoffset: innerCirc - (innerCirc * inner.pct) / 100 }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.15 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-slate-700">{Math.round(outer.pct)}%</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full bg-current ${outer.color}`} />
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{outer.label} {Math.round(outer.pct)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full bg-current ${inner.color}`} />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{inner.label} {Math.round(inner.pct)}%</span>
        </div>
      </div>
    </div>
  );
};

export default CoverageRings;
