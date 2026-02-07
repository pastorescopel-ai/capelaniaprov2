
import React from 'react';

interface StatsProps {
  totalStats: {
    totalStudents: number;
    studies: number;
    classes: number;
    groups: number;
    visits: number;
  };
}

const ReportStats: React.FC<StatsProps> = ({ totalStats }) => {
  const cards = [
    { label: 'Total Alunos', value: totalStats.totalStudents, color: 'bg-blue-600 shadow-blue-100' },
    { label: 'Estudos', value: totalStats.studies, color: 'bg-blue-500' },
    { label: 'Classes', value: totalStats.classes, color: 'bg-indigo-500' },
    { label: 'PGs', value: totalStats.groups, color: 'bg-emerald-500' },
    { label: 'Visitas', value: totalStats.visits, color: 'bg-rose-500 shadow-rose-100' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <div key={i} className={`${card.color} p-6 rounded-[2.5rem] text-white shadow-xl flex flex-col items-center hover:scale-105 transition-all group`}>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1 group-hover:opacity-100">{card.label}</p>
          <p className="text-2xl font-black">{card.value}</p>
        </div>
      ))}
    </div>
  );
};

export default ReportStats;
