import React, { useState } from 'react';
import { motion } from 'motion/react';
import CountUp from '../Shared/CountUp';
import ReportDetailsModal, { ReportDetailsRow } from './ReportDetailsModal';

interface ReportDetails {
  allStudentNames: string[];
  individualStudentNames: string[];
  patientStudentNames: string[];
  providerStudentNames: string[];
  adventistStudentNames: string[];
  monthlyBreakdown: { label: string; count: number }[];
  classSessions: { label: string; sector: string; date: string; studentsCount: number }[];
  visitRecords: { label: string; sector: string; date: string }[];
}

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
    details?: ReportDetails;
  };
}

const HIDDEN = { opacity: 0, y: 16, scale: 0.95 };
const VISIBLE = { opacity: 1, y: 0, scale: 1 };

const formatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date((iso.split('T')[0]) + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const namesToRows = (names: string[]): ReportDetailsRow[] => names.map(n => ({ primary: n }));

// Cada card sabe transformar o `details` cru em linhas prontas pro modal -- centralizado aqui
// pra não espalhar essa lógica pelos 9 `onClick`.
const buildRows = (cardKey: string, details?: ReportDetails): ReportDetailsRow[] => {
  if (!details) return [];
  switch (cardKey) {
    case 'total': return namesToRows(details.allStudentNames);
    case 'individual': return namesToRows(details.individualStudentNames);
    case 'patients': return namesToRows(details.patientStudentNames);
    case 'providers': return namesToRows(details.providerStudentNames);
    case 'adventists': return namesToRows(details.adventistStudentNames);
    case 'average': return details.monthlyBreakdown.map(m => ({ primary: m.label, badge: `${m.count} alunos` }));
    case 'classes': return details.classSessions.map(c => ({ primary: c.label, secondary: `${c.sector} • ${formatDate(c.date)}`, badge: `${c.studentsCount} alunos` }));
    case 'visits': return details.visitRecords.map(v => ({ primary: v.label, secondary: v.sector, badge: formatDate(v.date) }));
    default: return [];
  }
};

// Mesma linguagem visual dos cartões de estatística do Dashboard: entram em cascata e o
// número conta subindo, em vez de aparecer estático. Todo card com uma lista de pessoas/registros
// por trás é clicável e abre o detalhe (ReportDetailsModal) -- só "Adesão aos PGs (%)" fica de
// fora porque não vem dessa mesma fonte de dados (é calculado à parte, com o cadastro de PGs).
const ReportStats: React.FC<StatsProps> = ({ totalStats }) => {
  const [openCard, setOpenCard] = useState<string | null>(null);

  const cards = [
    {
        key: 'average',
        label: 'Média de Alunos (Mensal)',
        value: totalStats.averageStudentsMonthly,
        color: 'bg-slate-800 shadow-slate-200',
        // Sempre o ano corrente inteiro, não o período selecionado no calendário (ver
        // useReportLogic.ts) -- por isso "do Ano" e não "no Período".
        sub: `${totalStats.averageActiveMonths ?? 0} Meses do Ano`
    },
    {
        key: 'total',
        label: 'Total de Estudantes da Bíblia (Período)',
        value: totalStats.totalStudentsPeriod,
        color: 'bg-blue-600 shadow-blue-100',
        sub: 'Neste Filtro'
    },
    {
        key: null,
        label: 'Adesão aos PGs (%)',
        value: totalStats.pgPercentage || 0,
        suffix: '%',
        color: 'bg-emerald-600 shadow-emerald-100',
        sub: totalStats.isLocked ? 'DADO TRAVADO' : 'TEMPO REAL'
    },
    {
        key: 'individual',
        label: 'Estudos Bíblicos Individuais',
        value: totalStats.uniqueIndividualStudents,
        color: 'bg-blue-500',
        sub: `${totalStats.studies} Sessões no Período`
    },
    { key: 'classes', label: 'Classes Bíblicas', value: totalStats.classes, color: 'bg-indigo-500' },
    { key: 'visits', label: 'Total de visitas ao colaborador', value: totalStats.visits, color: 'bg-rose-500 shadow-rose-100' },
    {
      key: 'adventists',
      label: 'Adventistas em Classes',
      value: totalStats.adventistUniqueStudents || 0,
      color: 'bg-purple-600 shadow-purple-100',
      sub: `${totalStats.adventistAttendances || 0} Presenças no Período`
    },
    {
      key: 'patients',
      label: 'Alunos Pacientes',
      value: totalStats.patientStudents || 0,
      color: 'bg-amber-500',
      sub: 'Já somam no Total de Alunos'
    },
    {
      key: 'providers',
      label: 'Alunos Prestadores',
      value: totalStats.providerStudents || 0,
      color: 'bg-teal-500',
      sub: 'Já somam no Total de Alunos'
    },
  ];

  // openCard começa null, e o card "Adesão aos PGs" também tem key:null (de propósito, pra não
  // ser clicável) -- sem o `openCard &&` aqui, os dois "null" batiam entre si e o modal já
  // abria sozinho ao entrar em Relatórios, travado (fechar só voltava openCard pra null, que
  // batia de novo com o mesmo card).
  const activeCard = openCard ? cards.find(c => c.key === openCard) : undefined;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={i}
          role={card.key ? 'button' : undefined}
          tabIndex={card.key ? 0 : undefined}
          onClick={card.key ? () => setOpenCard(card.key) : undefined}
          onKeyDown={card.key ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCard(card.key); } } : undefined}
          initial={HIDDEN}
          animate={VISIBLE}
          transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={card.key ? { scale: 0.97 } : undefined}
          className={`${card.color} p-4 rounded-[2rem] text-white shadow-xl flex flex-col items-center justify-center transition-shadow group min-h-[110px] relative overflow-hidden ${card.key ? 'cursor-pointer' : ''}`}
        >
          {card.label === 'Adesão aos PGs (%)' && totalStats.isLocked && (
            <div className="absolute top-2 right-2 text-[8px] bg-white/20 px-2 py-0.5 rounded-full font-black">
              <i className="fas fa-lock mr-1"></i>
            </div>
          )}
          {card.key && (
            <div className="absolute top-2 right-2 text-[9px] bg-white/15 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="fas fa-list"></i>
            </div>
          )}
          <p className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-1 group-hover:opacity-100 text-center leading-tight">{card.label}</p>
          <p className="text-2xl font-black leading-none">
            <CountUp value={card.value} duration={0.9} />{card.suffix || ''}
          </p>
          {card.sub && <p className="text-[7px] font-bold uppercase mt-1 opacity-60 bg-black/20 px-2 py-0.5 rounded-full">{card.sub}</p>}
        </motion.div>
      ))}

      {activeCard && (
        <ReportDetailsModal
          title={activeCard.label}
          subtitle={`${activeCard.value}${activeCard.suffix || ''} neste filtro`}
          rows={buildRows(activeCard.key as string, totalStats.details)}
          onClose={() => setOpenCard(null)}
        />
      )}
    </div>
  );
};

export default ReportStats;
