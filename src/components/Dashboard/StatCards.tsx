
import React from 'react';
import { motion } from 'motion/react';
import CountUp from '../Shared/CountUp';

interface Stat {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

// Tailwind não consegue enxergar classe montada por template string em tempo de execução
// (ex: `text-${cor}-600`) -- só reconhece literais que aparecem inteiras em algum arquivo.
// Esse mapa garante que toda combinação usada existe como string completa aqui mesmo, então o
// build sempre gera o CSS certo, não importa se a classe aparece em outro lugar ou não.
const ICON_TEXT_CLASSES: Record<string, string> = {
  'bg-blue-500': 'text-blue-600',
  'bg-emerald-500': 'text-emerald-600',
  'bg-amber-500': 'text-amber-600',
  'bg-rose-500': 'text-rose-600',
  'bg-purple-500': 'text-purple-600',
};

const HIDDEN = { opacity: 0, y: 24, scale: 0.94 };
const VISIBLE = { opacity: 1, y: 0, scale: 1 };
const ICON_HIDDEN = { scale: 0, rotate: -20 };
const ICON_VISIBLE = { scale: 1, rotate: 0 };

interface StatCardsProps {
  stats: Stat[];
  // MainContent.tsx mantém abas já visitadas montadas, só trocando display:none/block --
  // sem isso, a animação de entrada só tocava na primeira vez que o Dashboard aparecia na
  // sessão inteira, nunca de novo ao voltar pra essa aba.
  isVisible?: boolean;
}

const StatCards: React.FC<StatCardsProps> = ({ stats, isVisible = true }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={HIDDEN}
          animate={isVisible ? VISIBLE : HIDDEN}
          transition={{ delay: index * 0.08, duration: 0.4, ease: 'easeOut' }}
          whileHover={{ y: -6, scale: 1.03, boxShadow: '0 12px 24px -8px rgba(15, 23, 42, 0.15)' }}
          whileTap={{ scale: 0.97 }}
          className="bg-white p-5 rounded-3xl flex flex-col items-center text-center border border-slate-200 shadow-sm cursor-default"
        >
          <motion.div
            initial={ICON_HIDDEN}
            animate={isVisible ? ICON_VISIBLE : ICON_HIDDEN}
            transition={{ delay: index * 0.08 + 0.15, type: 'spring', stiffness: 260, damping: 15 }}
            className={`w-10 h-10 ${stat.color} bg-opacity-10 rounded-xl flex items-center justify-center text-xl mb-3 ${ICON_TEXT_CLASSES[stat.color] || 'text-slate-600'}`}
          >
            {stat.icon}
          </motion.div>
          <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em] mb-1">{stat.label}</p>
          <p className="text-xl font-black text-slate-800">
            <CountUp value={stat.value} />
          </p>
        </motion.div>
      ))}
    </div>
  );
};

export default StatCards;
