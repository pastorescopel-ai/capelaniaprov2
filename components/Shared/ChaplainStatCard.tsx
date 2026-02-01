import React from 'react';

interface ChaplainStatCardProps {
  stat: {
    name: string;
    hab: { total: number; studies: number; classes: number; visits: number; groups: number };
    haba: { total: number; studies: number; classes: number; visits: number; groups: number };
    maxVal: number;
  };
  primaryColor: string;
}

const ChaplainStatCard: React.FC<ChaplainStatCardProps> = ({ stat, primaryColor }) => {
  const total = stat.hab.total + stat.haba.total;
  
  const showHab = stat.hab.total > 0;
  const showHaba = stat.haba.total > 0;
  
  // Se tiver atividade nas duas, ou em nenhuma, mostra as duas.
  // Se tiver apenas em uma, mostra apenas a respectiva.
  const showBoth = (showHab && showHaba) || (!showHab && !showHaba);

  const renderUnitColumn = (unitName: string, data: any, bgColor: string, textColor: string) => {
    return (
      <div className={`flex-1 rounded-2xl p-3 ${bgColor} border border-slate-100/50 flex flex-col gap-2`}>
        <div className="flex justify-between items-center pb-2 border-b border-black/5">
          <span className={`text-[10px] font-black uppercase tracking-widest ${textColor}`}>{unitName}</span>
          <span className="text-xs font-black text-slate-800">{data.total}</span>
        </div>
        <div className="space-y-1.5">
           {[
             { label: 'Estudos', val: data.studies },
             { label: 'Classes', val: data.classes },
             { label: 'Visitas', val: data.visits },
             { label: 'PGs', val: data.groups }
           ].map((metric, i) => (
             metric.val > 0 && (
               <div key={i} className="flex justify-between items-center text-[9px]">
                 <span className="text-slate-500 font-medium uppercase tracking-tight">{metric.label}</span>
                 <span className="font-bold text-slate-700 bg-white/60 px-1.5 rounded">{metric.val}</span>
               </div>
             )
           ))}
           {data.total === 0 && <span className="text-[8px] text-slate-400 italic text-center block pt-2">Sem atividades</span>}
        </div>
      </div>
    );
  };
  
  return (
    <div className="p-5 rounded-[2rem] bg-white border border-slate-100 h-full flex flex-col justify-between shadow-sm" style={{ breakInside: 'avoid' }}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-black text-slate-800 uppercase tracking-tighter truncate max-w-[150px]" title={stat.name}>
          {stat.name}
        </span>
        <span className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 rounded-lg">
          {total} Ações
        </span>
      </div>
      
      <div className="flex gap-3 flex-1">
        {(showHab || showBoth) && renderUnitColumn('HAB', stat.hab, 'bg-blue-50', 'text-blue-700')}
        {(showHaba || showBoth) && renderUnitColumn('HABA', stat.haba, 'bg-amber-50', 'text-amber-700')}
      </div>
    </div>
  );
};

export default ChaplainStatCard;