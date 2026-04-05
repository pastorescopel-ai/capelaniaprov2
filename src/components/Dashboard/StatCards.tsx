
import React from 'react';
import { motion } from 'motion/react';

interface Stat {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

const StatCards: React.FC<{ stats: Stat[] }> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
      {stats.map((stat, index) => (
        <motion.div 
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-white p-5 rounded-3xl flex flex-col items-center text-center group hover:-translate-y-1 transition-all cursor-default border border-slate-200 shadow-sm"
        >
          <div className={`w-10 h-10 ${stat.color} bg-opacity-10 rounded-xl flex items-center justify-center text-xl mb-3 text-${stat.color.split('-')[1]}-600`}>
            {stat.icon}
          </div>
          <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em] mb-1">{stat.label}</p>
          <p className="text-xl font-black text-slate-800">{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
};

export default StatCards;
