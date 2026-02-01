
import React from 'react';

interface Stat {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

const StatCards: React.FC<{ stats: Stat[] }> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white p-6 rounded-[2.5rem] flex flex-col items-center text-center group hover:scale-[1.03] transition-all cursor-default border border-slate-200 shadow-sm">
          <div className={`w-12 h-12 ${stat.color} bg-opacity-10 rounded-2xl flex items-center justify-center text-2xl mb-4 text-${stat.color.split('-')[1]}-600`}>
            {stat.icon}
          </div>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] mb-1">{stat.label}</p>
          <p className="text-2xl font-black text-slate-800">{stat.value}</p>
        </div>
      ))}
    </div>
  );
};

export default StatCards;
