import React from 'react';
import { Users } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { Unit } from '../../types';

interface AmbassadorDashboardProps {
  currentUnit: Unit;
  stats: any;
  getChartData: (unit: Unit) => any[];
}

const AmbassadorDashboard: React.FC<AmbassadorDashboardProps> = ({ currentUnit, stats, getChartData }) => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Users size={120} />
          </div>
          <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight mb-2">Total de Embaixadores ({currentUnit})</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-blue-600">{stats[currentUnit].total}</span>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Colaboradores Capacitados</span>
          </div>
          <div className="mt-8">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Top 5 Setores (Engajamento)</h4>
            <div className="space-y-3">
              {getChartData(currentUnit).slice(0, 5).map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-4">{i+1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">{s.name}</span>
                      <span className="font-mono text-slate-500">{s.percent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${s.percent}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight mb-4">Desempenho por Setor</h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getChartData(currentUnit).slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 9}} interval={0} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="percent" radius={[0, 4, 4, 0]} barSize={12}>
                  {getChartData(currentUnit).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.percent >= 5 ? '#22c55e' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmbassadorDashboard;
