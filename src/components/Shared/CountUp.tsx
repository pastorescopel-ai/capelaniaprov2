
import React, { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react';

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
}

// Faz o número "subir" de 0 até o valor final quando o card entra na tela, em vez de
// aparecer estático -- só conta uma vez (o useInView usa `once: true`), então rolar a tela
// pra cima e pra baixo de novo não fica recontando toda hora.
const CountUp: React.FC<CountUpProps> = ({ value, duration = 1.1, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const count = useMotionValue(0);
  const rounded = useTransform(count, latest => Math.round(latest).toLocaleString('pt-BR'));

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(count, value, { duration, ease: 'easeOut' });
    return controls.stop;
  }, [isInView, value, duration]);

  return <motion.span ref={ref} className={className}>{rounded}</motion.span>;
};

export default CountUp;
