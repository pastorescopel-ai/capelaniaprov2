import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, Unit } from '../../types';
import { ensureISODate, getStudentKey, countUniqueClasses, countUniqueStudents } from '../../utils/formatters';
import ChaplainPanorama from './ChaplainPanorama';

interface ChaplainCardProps {
  stat: any;
  avgTeamActions: number;
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  // Abrir/fechar e o mês selecionado agora vêm de fora (Reports.tsx) -- assim dois ou mais
  // cards abertos ao mesmo tempo compartilham o mesmo mês quando o usuário clica num deles.
  isOpen: boolean;
  onToggleOpen: () => void;
  selectedMonthKey: string | null;
  onSelectMonth: (key: string | null) => void;
  // true quando este card é um dos 2 abertos simultaneamente -- liga o destaque visual de
  // "modo comparação" (borda azul + selo) pra deixar claro que os dois estão emparelhados.
  isComparing: boolean;
  // Abre o ranking com TODOS os capelães (ChaplainComparisonModal), destacando este.
  onOpenComparison: () => void;
}

const SEGMENT_COLORS = {
  studies: 'bg-blue-500',
  classes: 'bg-indigo-500',
  groups: 'bg-emerald-500',
  visits: 'bg-rose-500',
};

const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_NAMES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Mini barra de composição -- o mesmo espírito do "mix de atividades" do mockup, só que por
// capelão em vez de por mês: mostra de relance pra onde o esforço dessa pessoa foi (mais
// estudos? mais visitas?) antes mesmo de olhar os números individuais logo abaixo.
const CompositionBar: React.FC<{ data: { studies: number; classes: number; groups: number; visits: number } }> = ({ data }) => {
  const total = data.studies + data.classes + data.groups + data.visits;
  const segments = [
    { key: 'studies', value: data.studies, color: SEGMENT_COLORS.studies },
    { key: 'classes', value: data.classes, color: SEGMENT_COLORS.classes },
    { key: 'groups', value: data.groups, color: SEGMENT_COLORS.groups },
    { key: 'visits', value: data.visits, color: SEGMENT_COLORS.visits },
  ].filter(s => s.value > 0);

  if (total === 0) {
    return <div className="h-1.5 w-full bg-slate-100 rounded-full" />;
  }

  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-slate-100">
      {segments.map((s, i) => (
        <motion.div
          key={s.key}
          initial={{ width: 0 }}
          animate={{ width: `${(s.value / total) * 100}%` }}
          transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' }}
          className={s.color}
          title={`${s.key}: ${s.value}`}
        />
      ))}
    </div>
  );
};

const emptyUnitStats = () => ({ studies: 0, classes: 0, groups: 0, visits: 0, total: 0, students: 0 });

const ChaplainCard: React.FC<ChaplainCardProps> = ({
  stat, avgTeamActions, studies, classes, groups, visits,
  isOpen, onToggleOpen, selectedMonthKey, onSelectMonth, isComparing, onOpenComparison,
}) => {
  const userId = stat.user.id;

  // Últimos 6 meses reais de calendário, com a mesma quebra por unidade (HAB/HABA) que os
  // cartões de cima já mostram pro período todo do filtro de Relatórios -- clicar num mês no
  // Panorama troca ESSES números pelos do mês escolhido, em vez de só atualizar o KPI
  // "Alunos" isolado como fazia antes.
  const months = useMemo(() => {
    const now = new Date();
    const list: { key: string; label: string; fullLabel: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: MONTH_NAMES_SHORT[d.getMonth()],
        fullLabel: MONTH_NAMES_FULL[d.getMonth()],
      });
    }
    return list;
  }, []);

  const userStudies = useMemo(() => (studies || []).filter(s => s.userId === userId), [studies, userId]);
  const userClasses = useMemo(() => (classes || []).filter(c => c.userId === userId), [classes, userId]);
  const userGroups = useMemo(() => (groups || []).filter(g => g.userId === userId), [groups, userId]);
  const userVisits = useMemo(() => (visits || []).filter(v => v.userId === userId), [visits, userId]);

  const monthBuckets = useMemo(() => {
    const getUnitStats = (list: { studies: any[]; classes: any[]; groups: any[]; visits: any[] }, unit: Unit) => {
      const uS = list.studies.filter(i => (i.unit || Unit.HAB) === unit);
      const uC = list.classes.filter(i => (i.unit || Unit.HAB) === unit);
      const uG = list.groups.filter(i => (i.unit || Unit.HAB) === unit);
      const uV = list.visits.filter(i => (i.unit || Unit.HAB) === unit);
      const names = new Set<string>();
      uS.forEach(s => { const key = getStudentKey(s.name, s.staffId || s.participantId); if (key) names.add(key); });
      uC.forEach(c => {
        const adventistSet = new Set(c.adventistStudents || []);
        (c.students || []).forEach((n: any) => { if (adventistSet.has(n)) return; const key = getStudentKey(n); if (key) names.add(key); });
      });
      const uniqueClasses = countUniqueClasses(uC);
      // "studies" mostra alunos únicos (não sessões) -- "total" continua somando as sessões
      // brutas porque é usado como indicador de volume de trabalho, não de alcance de pessoas.
      return { students: names.size, studies: countUniqueStudents(uS), classes: uniqueClasses, groups: uG.length, visits: uV.length, total: uS.length + uniqueClasses + uG.length + uV.length };
    };

    return months.map(m => {
      const monthList = {
        studies: userStudies.filter(s => ensureISODate(s.date)?.startsWith(m.key)),
        classes: userClasses.filter(c => ensureISODate(c.date)?.startsWith(m.key)),
        groups: userGroups.filter(g => ensureISODate(g.date)?.startsWith(m.key)),
        visits: userVisits.filter(v => ensureISODate(v.date)?.startsWith(m.key)),
      };
      const hab = getUnitStats(monthList, Unit.HAB);
      const haba = getUnitStats(monthList, Unit.HABA);
      return { ...m, hab, haba, total: hab.total + haba.total, students: hab.students + haba.students };
    });
  }, [months, userStudies, userClasses, userGroups, userVisits]);

  const selectedBucket = selectedMonthKey ? monthBuckets.find(m => m.key === selectedMonthKey) : null;

  const displayHab = selectedBucket ? selectedBucket.hab : (stat.hab || emptyUnitStats());
  const displayHaba = selectedBucket ? selectedBucket.haba : (stat.haba || emptyUnitStats());
  const displayTotalActions = selectedBucket ? selectedBucket.total : stat.totalActions;
  const displayStudents = selectedBucket ? selectedBucket.students : stat.students;

  const hasHab = displayHab.total > 0 || displayHab.students > 0;
  const hasHaba = displayHaba.total > 0 || displayHaba.students > 0;
  const showBoth = (hasHab && hasHaba) || (!hasHab && !hasHaba);

  const renderUnitDetails = (title: string, data: any, colorClass: string, textClass: string) => (
    <div className={`flex-1 rounded-2xl p-4 ${colorClass} border border-slate-100/50`}>
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-black/5">
        <span className={`text-[10px] font-black uppercase tracking-widest ${textClass}`}>{title}</span>
        <span className="text-xs font-black text-slate-800">{data.total} Ações</span>
      </div>
      <div className="mb-3">
        <CompositionBar data={data} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col">
          <span className="text-[7px] font-bold text-slate-400 uppercase flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${SEGMENT_COLORS.studies}`} />Estudos</span>
          <span className="text-[10px] font-black text-slate-700">{data.studies}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[7px] font-bold text-slate-400 uppercase flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${SEGMENT_COLORS.classes}`} />Classes</span>
          <span className="text-[10px] font-black text-slate-700">{data.classes}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[7px] font-bold text-slate-400 uppercase flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${SEGMENT_COLORS.groups}`} />PGs</span>
          <span className="text-[10px] font-black text-slate-700">{data.groups}</span>
        </div>
        <div className={`flex flex-col p-1 rounded-lg ${data.visits > 0 ? 'bg-rose-100/50' : ''}`}>
          <span className={`text-[7px] font-black uppercase flex items-center gap-1 ${data.visits > 0 ? 'text-rose-600' : 'text-slate-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${SEGMENT_COLORS.visits}`} />Visitas</span>
          <span className={`text-[10px] font-black ${data.visits > 0 ? 'text-rose-700' : 'text-slate-700'}`}>{data.visits}</span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-black/5 flex justify-between items-center">
         <span className="text-[8px] font-black text-slate-400 uppercase">Total Alunos</span>
         <span className={`text-xs font-black ${textClass}`}>{data.students}</span>
      </div>
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen(); } }}
      className={`bg-white p-8 rounded-[3rem] shadow-sm border flex flex-col space-y-6 transition-all group cursor-pointer ${
        isComparing ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100 hover:border-blue-300'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-2xl group-hover:scale-110 transition-transform">
          {stat.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter truncate">{stat.name}</h3>
          <div className="flex gap-2 mt-1 flex-wrap items-center">
            {isComparing && (
              <span className="text-[8px] font-black uppercase bg-blue-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                <i className="fas fa-arrows-left-right text-[7px]"></i> Comparando
              </span>
            )}
            <span className="text-[8px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">Total Alunos: {displayStudents}</span>
            <span className="text-[8px] font-black uppercase bg-slate-800 text-white px-2 py-0.5 rounded-md">{displayTotalActions} Ações {selectedBucket ? '' : 'Globais'}</span>
            {selectedBucket && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelectMonth(null); }}
                className="text-[8px] font-black uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md flex items-center gap-1 hover:bg-amber-200 transition-colors"
              >
                {selectedBucket.fullLabel} <i className="fas fa-times text-[7px]"></i>
              </button>
            )}
          </div>
        </div>
        <i className={`fas fa-chevron-down text-slate-300 text-xs flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {(hasHab || showBoth) && renderUnitDetails('HAB', displayHab, 'bg-blue-50', 'text-blue-700')}
        {(hasHaba || showBoth) && renderUnitDetails('HABA', displayHaba, 'bg-amber-50', 'text-amber-700')}
      </div>

      {isOpen && (
        <div onClick={(e) => e.stopPropagation()} className="cursor-default">
          <ChaplainPanorama
            userName={stat.name}
            totalActions={stat.totalActions}
            avgTeamActions={avgTeamActions}
            monthBuckets={monthBuckets}
            selectedMonthKey={selectedMonthKey}
            onSelectMonth={onSelectMonth}
            userStudies={userStudies}
            userClasses={userClasses}
            userGroups={userGroups}
            userVisits={userVisits}
            onCompareClick={onOpenComparison}
          />
        </div>
      )}
    </div>
  );
};

export default ChaplainCard;
