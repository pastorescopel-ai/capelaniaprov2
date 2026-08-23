import React from 'react';
import { motion } from 'motion/react';

interface ChaplainCardProps {
  stat: any;
}

const SEGMENT_COLORS = {
  studies: 'bg-blue-500',
  classes: 'bg-indigo-500',
  groups: 'bg-emerald-500',
  visits: 'bg-rose-500',
};

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

const ChaplainCard: React.FC<ChaplainCardProps> = ({ stat }) => {
  const hasHab = stat.hab.total > 0 || stat.hab.students > 0;
  const hasHaba = stat.haba.total > 0 || stat.haba.students > 0;
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
    <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col space-y-6 hover:border-blue-300 transition-all group">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-2xl group-hover:scale-110 transition-transform">
          {stat.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter truncate">{stat.name}</h3>
          <div className="flex gap-2 mt-1">
            <span className="text-[8px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">Total Alunos: {stat.students}</span>
            <span className="text-[8px] font-black uppercase bg-slate-800 text-white px-2 py-0.5 rounded-md">{stat.totalActions} Ações Globais</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {(hasHab || showBoth) && renderUnitDetails('HAB', stat.hab, 'bg-blue-50', 'text-blue-700')}
        {(hasHaba || showBoth) && renderUnitDetails('HABA', stat.haba, 'bg-amber-50', 'text-amber-700')}
      </div>
    </div>
  );
};

export default ChaplainCard;
