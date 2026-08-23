
import React, { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react';

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
}

// Faz o número "subir" de 0 até o valor final quando o card entra na tela -- once: false pra
// recontar toda vez que reaparece (rolando a tela, ou saindo da aba do Dashboard e voltando:
// a aba fica display:none, que já conta como "saiu da tela" pro observer).
const CountUp: React.FC<CountUpProps> = ({ value, duration = 1.1, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: false, margin: '-40px' });
  const count = useMotionValue(0);
  const rounded = useTransform(count, latest => Math.round(latest).toLocaleString('pt-BR'));

  useEffect(() => {
    if (!isInView) {
      count.set(0);
      return;
    }
    const controls = animate(count, value, { duration, ease: 'easeOut' });
    return controls.stop;
  }, [isInView, value, duration]);

  return <motion.span ref={ref} className={className}>{rounded}</motion.span>;
};

export default CountUp;
