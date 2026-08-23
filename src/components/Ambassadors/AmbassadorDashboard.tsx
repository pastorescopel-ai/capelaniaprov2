import React from 'react';
import { Users } from 'lucide-react';
import { Unit } from '../../types';
import AdherenceRanking from '../PGManagement/charts/AdherenceRanking';
import CountUp from '../Shared/CountUp';

interface AmbassadorDashboardProps {
  currentUnit: Unit;
  stats: any;
  getChartData: (unit: Unit) => any[];
}

// Unifica o visual com o Ranking de Adesão já usado no Dashboard de PGs -- antes essa tela
// tinha duas listas diferentes (uma feita à mão sem animação, outra um gráfico Recharts
// genérico) mostrando basicamente a mesma coisa em dois estilos destoantes.
const AmbassadorDashboard: React.FC<AmbassadorDashboardProps> = ({ currentUnit, stats, getChartData }) => {
  const chartData = getChartData(currentUnit);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Users size={120} />
        </div>
        <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight mb-2">Total de Embaixadores ({currentUnit})</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black text-blue-600"><CountUp value={stats[currentUnit].total} /></span>
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Colaboradores Capacitados</span>
        </div>
      </div>

      <AdherenceRanking
        title={`Setores por Engajamento (${currentUnit})`}
        metaPct={null}
        data={chartData.map((s: any) => ({ id: s.id, name: s.name, pct: s.percent }))}
      />
    </div>
  );
};

export default AmbassadorDashboard;
