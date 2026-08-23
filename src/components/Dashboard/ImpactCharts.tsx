
import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, Legend, YAxis } from 'recharts';
import { GlobalImpactComparisonMode } from '../../hooks/useDashboardStats';
import { formatMonthLabel } from '../../utils/formatters';

interface ImpactChartsProps {
  individualData: any[];
  globalData: any;
  comparisonMode: GlobalImpactComparisonMode;
  onComparisonModeChange: (mode: GlobalImpactComparisonMode) => void;
  availableMonths: string[];
  selectedAverageMonths: string[];
  onToggleAverageMonth: (month: string) => void;
}

const MODE_OPTIONS: { mode: GlobalImpactComparisonMode; label: string }[] = [
  { mode: 'previousMonth', label: 'Mês Anterior' },
  { mode: 'sameMonthLastYear', label: 'Ano Passado' },
  { mode: 'average', label: 'Média de Meses' },
];

// Placeholder do mesmo tamanho do gráfico real, mostrado enquanto o card ainda não entrou na
// tela -- evita o "pulo" de altura quando o gráfico (e a animação de crescimento das barras do
// Recharts) só monta ao rolar até ele.
const ChartSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div className="w-full flex items-end gap-3 px-2" style={{ height }}>
    {[0.4, 0.7, 0.5, 0.9, 0.3, 0.6].map((h, i) => (
      <div key={i} className="flex-1 bg-slate-100 rounded-t-lg animate-pulse" style={{ height: `${h * 100}%` }} />
    ))}
  </div>
);

const ImpactCharts: React.FC<ImpactChartsProps> = ({
  individualData, globalData,
  comparisonMode, onComparisonModeChange,
  availableMonths, selectedAverageMonths, onToggleAverageMonth
}) => {
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  // once: true -- o gráfico anima ao entrar na tela e fica assim; rolar pra cima e pra baixo
  // de novo não fica disparando a animação toda hora.
  const isCard1InView = useInView(card1Ref, { once: true, margin: '-80px' });
  const isCard2InView = useInView(card2Ref, { once: true, margin: '-80px' });

  return (
    <div className="space-y-8">
      {/* Gráfico Individual */}
      <motion.div
        ref={card1Ref}
        initial={{ opacity: 0, y: 30 }}
        animate={isCard1InView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm"
      >
        <h3 className="text-sm md:text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter">
          <i className="fas fa-chart-bar text-blue-600"></i> Desempenho Individual
        </h3>
        <div className="h-[200px] w-full min-h-[200px]">
          {isCard1InView ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
              <BarChart data={individualData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 9, fontWeight: 800}} />
                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{borderRadius: '1rem', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="val" radius={[8, 8, 0, 0]} barSize={32} animationDuration={900} animationEasing="ease-out">
                  { individualData.map((_, i) => <Cell key={i} fill={['#3b82f6', '#6366f1', '#10b981', '#f43f5e'][i]} />) }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartSkeleton height={200} />}
        </div>
      </motion.div>

      {/* Gráfico de Impacto Global */}
      <motion.div
        ref={card2Ref}
        initial={{ opacity: 0, y: 30 }}
        animate={isCard2InView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-sm md:text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
              <i className="fas fa-globe-americas text-[#005a9c]"></i> Impacto Global (Equipe)
            </h3>
            <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em] mt-1">
              Comparativo de Metas Mensais
            </p>
          </div>
          <div className={`px-4 py-1.5 rounded-xl flex items-center gap-2 border ${globalData.isUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
            <i className={`fas fa-arrow-${globalData.isUp ? 'up' : 'down'} text-[9px]`}></i>
            <span className="text-[10px] font-black uppercase tracking-widest">{globalData.isUp ? '+' : ''}{globalData.pct}% alcance</span>
          </div>
        </div>

        {/* Seletor de comparação */}
        <div className="flex flex-wrap gap-2 mb-4">
          {MODE_OPTIONS.map(opt => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => onComparisonModeChange(opt.mode)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                comparisonMode === opt.mode
                  ? 'bg-[#005a9c] text-white border-[#005a9c]'
                  : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {comparisonMode === 'average' && (
          <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Selecione os meses para calcular a média {selectedAverageMonths.length === 0 && '(nenhum selecionado)'}
            </p>
            <div className="flex flex-wrap gap-2">
              {availableMonths.map(month => (
                <button
                  key={month}
                  type="button"
                  onClick={() => onToggleAverageMonth(month)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border capitalize ${
                    selectedAverageMonths.includes(month)
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {formatMonthLabel(`${month}-01`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="h-[250px] w-full min-h-[250px]">
          {isCard2InView ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
              <BarChart
                data={globalData.chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#475569', fontSize: 9, fontWeight: 900}}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{fill: 'rgba(0,0,0,0.03)'}}
                  contentStyle={{borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '15px', background: '#ffffff'}}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={40}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '20px' }}
                />
                <Bar
                  name={globalData.comparisonLabel || 'Mês Anterior'}
                  dataKey="anterior"
                  radius={[6, 6, 0, 0]}
                  barSize={18}
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {globalData.chartData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-prev-${index}`}
                      fill={entry.atual >= entry.anterior ? '#10b981' : '#f43f5e'}
                    />
                  ))}
                </Bar>
                <Bar
                  name="Mês Atual"
                  dataKey="atual"
                  fill="#005a9c"
                  radius={[6, 6, 0, 0]}
                  barSize={18}
                  animationDuration={900}
                  animationEasing="ease-out"
                  animationBegin={150}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartSkeleton height={250} />}
        </div>
      </motion.div>
    </div>
  );
};

export default ImpactCharts;
