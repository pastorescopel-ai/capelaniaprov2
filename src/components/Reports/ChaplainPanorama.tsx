import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit } from '../../types';
import { ensureISODate, getStudentKey } from '../../utils/formatters';

interface ChaplainPanoramaProps {
  userId: string;
  userName: string;
  totalActions: number;
  avgTeamActions: number;
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
}

const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_NAMES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type ActivityType = 'study' | 'class' | 'group' | 'visit';

const ACTIVITY_META: Record<ActivityType, { icon: string; bg: string; label: string }> = {
  study: { icon: 'fa-book-open', bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600', label: 'Estudo Bíblico' },
  class: { icon: 'fa-chalkboard', bg: 'bg-indigo-50 text-indigo-600', label: 'Classe Bíblica' },
  group: { icon: 'fa-house-user', bg: 'bg-emerald-50 text-emerald-600', label: 'Reunião PG' },
  visit: { icon: 'fa-hands-helping', bg: 'bg-rose-50 text-rose-600', label: 'Visita' },
};

// Painel de "panorama" de um capelão específico -- abre dentro do próprio ChaplainCard ao
// clicar nele. Filtra as listas brutas (studies/classes/groups/visits, que já chegam pra
// Relatórios inteiras, sem filtro de capelão) por este userId, calcula os últimos 6 meses
// reais de calendário, e deixa cada mês clicável pra atualizar a composição/números mostrados
// no card acima (ver ChaplainCard.tsx).
const ChaplainPanorama: React.FC<ChaplainPanoramaProps> = ({ userId, userName, totalActions, avgTeamActions, studies, classes, groups, visits }) => {
  const months = useMemo(() => {
    const now = new Date();
    const list: { key: string; label: string; year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTH_NAMES_SHORT[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
    }
    return list;
  }, []);

  const [selectedMonthKey, setSelectedMonthKey] = useState(months[months.length - 1].key);

  const userStudies = useMemo(() => (studies || []).filter(s => s.userId === userId), [studies, userId]);
  const userClasses = useMemo(() => (classes || []).filter(c => c.userId === userId), [classes, userId]);
  const userGroups = useMemo(() => (groups || []).filter(g => g.userId === userId), [groups, userId]);
  const userVisits = useMemo(() => (visits || []).filter(v => v.userId === userId), [visits, userId]);

  const monthBuckets = useMemo(() => {
    return months.map(m => {
      const st = userStudies.filter(s => ensureISODate(s.date)?.startsWith(m.key));
      const cl = userClasses.filter(c => ensureISODate(c.date)?.startsWith(m.key));
      const gr = userGroups.filter(g => ensureISODate(g.date)?.startsWith(m.key));
      const vi = userVisits.filter(v => ensureISODate(v.date)?.startsWith(m.key));

      const studentKeys = new Set<string>();
      st.forEach(s => studentKeys.add(getStudentKey(s.name, s.staffId || s.participantId)));
      cl.forEach(c => (c.students || []).forEach(name => studentKeys.add(getStudentKey(name))));

      return {
        ...m,
        studies: st.length, classes: cl.length, groups: gr.length, visits: vi.length,
        total: st.length + cl.length + gr.length + vi.length,
        alunos: studentKeys.size,
      };
    });
  }, [months, userStudies, userClasses, userGroups, userVisits]);

  const selected = monthBuckets.find(m => m.key === selectedMonthKey) || monthBuckets[monthBuckets.length - 1];
  const maxTotal = Math.max(...monthBuckets.map(m => m.total), 1);

  const monthsActiveCount = useMemo(() => monthBuckets.filter(m => m.total > 0).length, [monthBuckets]);

  const vsTeamPct = avgTeamActions > 0 ? Math.round(((totalActions - avgTeamActions) / avgTeamActions) * 100) : null;

  const recentActivity = useMemo(() => {
    const all: { type: ActivityType; date: string; title: string }[] = [
      ...userStudies.map(s => ({ type: 'study' as ActivityType, date: s.date, title: s.name || s.guide })),
      ...userClasses.map(c => ({ type: 'class' as ActivityType, date: c.date, title: c.guide })),
      ...userGroups.map(g => ({ type: 'group' as ActivityType, date: g.date, title: g.groupName })),
      ...userVisits.map(v => ({ type: 'visit' as ActivityType, date: v.date, title: v.staffName })),
    ];
    return all
      .filter(a => !!ensureISODate(a.date))
      .sort((a, b) => (ensureISODate(b.date) || '').localeCompare(ensureISODate(a.date) || ''))
      .slice(0, 5);
  }, [userStudies, userClasses, userGroups, userVisits]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="mt-4 pt-5 border-t border-dashed border-slate-200 space-y-5">
        <div>
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Panorama · {userName}</h4>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Estudos, classes, PGs e visitas registrados por este capelão</p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-slate-50 rounded-2xl p-3">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Alunos ({selected.label})</p>
            <p className="text-lg font-black text-slate-800 mt-0.5">{selected.alunos}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Meses Ativos</p>
            <p className="text-lg font-black text-slate-800 mt-0.5">{monthsActiveCount}<span className="text-[10px] text-slate-400 font-bold"> /6</span></p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Vs. Média Equipe</p>
            <p className={`text-lg font-black mt-0.5 ${vsTeamPct === null ? 'text-slate-400' : vsTeamPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {vsTeamPct === null ? '--' : `${vsTeamPct >= 0 ? '+' : ''}${vsTeamPct}%`}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Ações nos últimos 6 meses</p>
          <div className="flex items-end gap-2 h-16">
            {monthBuckets.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMonthKey(m.key)}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end group"
              >
                <div
                  className={`w-full rounded-t-md rounded-b-sm transition-colors ${m.key === selectedMonthKey ? 'bg-[#005a9c]' : 'bg-slate-200 group-hover:bg-blue-200'}`}
                  style={{ height: `${Math.max((m.total / maxTotal) * 100, 6)}%` }}
                />
                <span className={`text-[8px] font-black uppercase ${m.key === selectedMonthKey ? 'text-[#005a9c]' : 'text-slate-400'}`}>{m.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[8px] font-bold text-slate-400 mt-1.5">Toque num mês pra ver o desempenho detalhado dele acima</p>
        </div>

        {recentActivity.length > 0 && (
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Atividade recente</p>
            <div className="divide-y divide-slate-100">
              {recentActivity.map((a, i) => {
                const meta = ACTIVITY_META[a.type];
                return (
                  <div key={i} className="flex items-center gap-2.5 py-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] flex-shrink-0 ${meta.bg}`}>
                      <i className={`fas ${meta.icon}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate">{meta.label}: <span className="font-black">{a.title || '--'}</span></p>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 flex-shrink-0">
                      {new Date((ensureISODate(a.date) || '') + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChaplainPanorama;
