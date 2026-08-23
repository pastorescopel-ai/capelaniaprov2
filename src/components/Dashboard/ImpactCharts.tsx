
import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { GlobalImpactComparisonMode } from '../../hooks/useDashboardStats';
import { formatMonthLabel } from '../../utils/formatters';
import RankedBarChart, { RankedBarDatum } from './charts/RankedBarChart';
import DumbbellChart, { DumbbellDatum } from './charts/DumbbellChart';

interface ImpactChartsProps {
  individualData: { name: string; val: number }[];
  globalData: any;
  comparisonMode: GlobalImpactComparisonMode;
  onComparisonModeChange: (mode: GlobalImpactComparisonMode) => void;
  availableMonths: string[];
  selectedAverageMonths: string[];
  onToggleAverageMonth: (month: string) => void;
  onGoToTab?: (tab: string) => void;
}

const MODE_OPTIONS: { mode: GlobalImpactComparisonMode; label: string }[] = [
  { mode: 'previousMonth', label: 'Mês Anterior' },
  { mode: 'sameMonthLastYear', label: 'Ano Passado' },
  { mode: 'average', label: 'Média de Meses' },
];

// Cada categoria leva pro formulário correspondente ao clicar na barra/bolinha -- "Alunos" não
// tem formulário próprio (é derivado dos estudos/classes), então fica sem ação de clique.
const CATEGORY_TAB: Record<string, string> = {
  'Estudos': 'bibleStudy',
  'Classes': 'bibleClass',
  'PGs': 'smallGroup',
  'Visitas': 'staffVisit',
};

const CATEGORY_COLOR: Record<string, string> = {
  'Estudos': '#3b82f6',
  'Classes': '#6366f1',
  'PGs': '#10b981',
  'Visitas': '#f43f5e',
};

const ImpactCharts: React.FC<ImpactChartsProps> = ({
  individualData, globalData,
  comparisonMode, onComparisonModeChange,
  availableMonths, selectedAverageMonths, onToggleAverageMonth,
  onGoToTab
}) => {
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  // once: false -- o gráfico reanima toda vez que entra na tela: seja rolando até ele, seja
  // saindo da aba do Dashboard e voltando (a aba fica escondida via display:none, o que já
  // conta como "saiu da tela" pro observer, e reaparece do zero quando a aba é reaberta).
  const isCard1InView = useInView(card1Ref, { once: false, margin: '-80px' });
  const isCard2InView = useInView(card2Ref, { once: false, margin: '-80px' });

  const rankedData: RankedBarDatum[] = individualData.map(d => ({
    name: d.name,
    value: d.val,
    color: CATEGORY_COLOR[d.name] || '#64748b',
    onClick: onGoToTab && CATEGORY_TAB[d.name] ? () => onGoToTab(CATEGORY_TAB[d.name]) : undefined,
  }));

  const dumbbellData: DumbbellDatum[] = (globalData.chartData || []).map((d: any) => ({
    name: d.name,
    prev: d.anterior,
    atual: d.atual,
    prevLabel: globalData.comparisonLabel || 'Mês Anterior',
    onClick: onGoToTab && CATEGORY_TAB[d.name] ? () => onGoToTab(CATEGORY_TAB[d.name]) : undefined,
  }));

  return (
    <div className="space-y-8">
      {/* Gráfico Individual -- barras horizontais ordenadas do maior pro menor, cada uma
          clicável (leva pro formulário daquele tipo de registro) */}
      <motion.div
        ref={card1Ref}
        initial={{ opacity: 0, y: 30 }}
        animate={isCard1InView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm"
      >
        <h3 className="text-sm md:text-lg font-black text-slate-800 mb-1 flex items-center gap-2 uppercase tracking-tighter">
          <i className="fas fa-chart-bar text-blue-600"></i> Desempenho Individual
        </h3>
        <p className="text-slate-400 text-[8px] font-black uppercase tracking-[0.2em] mb-6">
          Ordenado do maior pro menor
        </p>
        <RankedBarChart data={rankedData} inView={isCard1InView} />
      </motion.div>

      {/* Gráfico de Impacto Global -- pares de bolinhas conectadas (mês anterior → mês atual)
          por categoria, mesma leitura do comparativo dos formulários, só que pra equipe toda */}
      <motion.div
        ref={card2Ref}
        initial={{ opacity: 0, y: 30 }}
        animate={isCard2InView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
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

        <DumbbellChart data={dumbbellData} inView={isCard2InView} />

        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-dashed border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" /> {globalData.comparisonLabel || 'Mês Anterior'}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Este mês (subiu)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Este mês (caiu)</span>
        </div>
      </motion.div>
    </div>
  );
};

export default ImpactCharts;
