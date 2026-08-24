import React from 'react';
import { motion } from 'motion/react';
import CountUp from '../Shared/CountUp';

interface StatsProps {
  totalStats: {
    totalStudentsPeriod: number;
    averageStudentsMonthly: number;
    averageActiveMonths?: number;
    studies: number;
    uniqueIndividualStudents: number;
    classes: number;
    groups: number;
    visits: number;
    pgPercentage?: number;
    isLocked?: boolean;
    adventistUniqueStudents?: number;
    adventistAttendances?: number;
    patientStudents?: number;
    providerStudents?: number;
  };
}

const HIDDEN = { opacity: 0, y: 16, scale: 0.95 };
const VISIBLE = { opacity: 1, y: 0, scale: 1 };

// Mesma linguagem visual dos cartões de estatística do Dashboard: entram em cascata e o
// número conta subindo, em vez de aparecer estático.
const ReportStats: React.FC<StatsProps> = ({ totalStats }) => {
  const cards = [
    {
        label: 'Média de Alunos (Mensal)',
        value: totalStats.averageStudentsMonthly,
        color: 'bg-slate-800 shadow-slate-200',
        sub: `${totalStats.averageActiveMonths ?? 0} Meses Ativos no Período`
    },
    {
        label: 'Total de Estudantes da Bíblia (Período)',
        value: totalStats.totalStudentsPeriod,
        color: 'bg-blue-600 shadow-blue-100',
        sub: 'Neste Filtro'
    },
    {
        label: 'Adesão aos PGs (%)',
        value: totalStats.pgPercentage || 0,
        suffix: '%',
        color: 'bg-emerald-600 shadow-emerald-100',
        sub: totalStats.isLocked ? 'DADO TRAVADO' : 'TEMPO REAL'
    },
    {
        label: 'Estudos Bíblicos Individuais',
        value: totalStats.uniqueIndividualStudents,
        color: 'bg-blue-500',
        sub: `${totalStats.studies} Sessões no Período`
    },
    { label: 'Classes Bíblicas', value: totalStats.classes, color: 'bg-indigo-500' },
    { label: 'Total de visitas ao colaborador', value: totalStats.visits, color: 'bg-rose-500 shadow-rose-100' },
    {
      label: 'Adventistas em Classes',
      value: totalStats.adventistUniqueStudents || 0,
      color: 'bg-purple-600 shadow-purple-100',
      sub: `${totalStats.adventistAttendances || 0} Presenças no Período`
    },
    {
      label: 'Alunos Pacientes',
      value: totalStats.patientStudents || 0,
      color: 'bg-amber-500',
      sub: 'Já somam no Total de Alunos'
    },
    {
      label: 'Alunos Prestadores',
      value: totalStats.providerStudents || 0,
      color: 'bg-teal-500',
      sub: 'Já somam no Total de Alunos'
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={i}
          initial={HIDDEN}
          animate={VISIBLE}
          transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' }}
          whileHover={{ scale: 1.05, y: -2 }}
          className={`${card.color} p-4 rounded-[2rem] text-white shadow-xl flex flex-col items-center justify-center transition-shadow group min-h-[110px] relative overflow-hidden`}
        >
          {card.label === 'Adesão aos PGs (%)' && totalStats.isLocked && (
            <div className="absolute top-2 right-2 text-[8px] bg-white/20 px-2 py-0.5 rounded-full font-black">
              <i className="fas fa-lock mr-1"></i>
            </div>
          )}
          <p className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-1 group-hover:opacity-100 text-center leading-tight">{card.label}</p>
          <p className="text-2xl font-black leading-none">
            <CountUp value={card.value} duration={0.9} />{card.suffix || ''}
          </p>
          {card.sub && <p className="text-[7px] font-bold uppercase mt-1 opacity-60 bg-black/20 px-2 py-0.5 rounded-full">{card.sub}</p>}
        </motion.div>
      ))}
    </div>
  );
};

export default ReportStats;
