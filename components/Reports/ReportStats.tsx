
import React from 'react';

interface StatsProps {
  totalStats: {
    totalStudentsPeriod: number;
    totalStudentsYTD: number;
    studies: number;
    classes: number;
    groups: number;
    visits: number;
  };
}

const ReportStats: React.FC<StatsProps> = ({ totalStats }) => {
  const cards = [
    { 
        label: 'Total de Estudantes da Bíblia (Ano)', 
        value: totalStats.totalStudentsYTD, 
        color: 'bg-slate-800 shadow-slate-200', 
        sub: 'Acumulado 2025' 
    },
    { 
        label: 'Total de Estudantes da Bíblia (Período)', 
        value: totalStats.totalStudentsPeriod, 
        color: 'bg-blue-600 shadow-blue-100',
        sub: 'Neste Filtro'
    },
    { label: 'Estudos Bíblicos Individuais', value: totalStats.studies, color: 'bg-blue-500' },
    { label: 'Classes Bíblicas', value: totalStats.classes, color: 'bg-indigo-500' },
    { label: 'PGs', value: totalStats.groups, color: 'bg-emerald-500' },
    { label: 'Total de visitas ao colaborador', value: totalStats.visits, color: 'bg-rose-500 shadow-rose-100' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
      {cards.map((card, i) => (
        <div key={i} className={`${card.color} p-4 rounded-[2rem] text-white shadow-xl flex flex-col items-center justify-center hover:scale-105 transition-all group min-h-[110px]`}>
          <p className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-1 group-hover:opacity-100 text-center leading-tight">{card.label}</p>
          <p className="text-2xl font-black leading-none">{card.value}</p>
          {card.sub && <p className="text-[7px] font-bold uppercase mt-1 opacity-60 bg-black/20 px-2 py-0.5 rounded-full">{card.sub}</p>}
        </div>
      ))}
    </div>
  );
};

export default ReportStats;
