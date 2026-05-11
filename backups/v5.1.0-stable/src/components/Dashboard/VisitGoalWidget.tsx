
import React from 'react';
import { User } from '../../types';

interface Goal {
  label: string;
  current: number;
  target: number;
  type: 'daily' | 'weekly' | 'monthly';
}

interface AccumulatedGoal {
  expected: number;
  current: number;
  deficit: number;
  historicalTotal: number;
  status: 'success' | 'warning' | 'critical';
}

interface VisitGoalWidgetProps {
  goals: Goal[];
  accumulated: AccumulatedGoal | null;
  currentUser: User;
}

const VisitGoalWidget: React.FC<VisitGoalWidgetProps> = ({ goals, accumulated, currentUser }) => {
  if (!accumulated) return null;

  const { expected, current, deficit, historicalTotal, status } = accumulated;
  
  const isHabaChaplain = currentUser?.attendsHaba === true;
  const habaDays = currentUser?.habaDays || [];
  const isIntern = currentUser?.role === 'INTERN';
  
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isHabaDay = isHabaChaplain && habaDays.includes(dayOfWeek);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const habaDaysStr = habaDays.map(d => dayNames[d]).join(', ');
  const nonHabaDaysStr = [1, 2, 3, 4, 5].filter(d => !habaDays.includes(d)).map(d => dayNames[d]).join(', ');

  let goalMessage = "Meta: 2 visitas por dia útil (HAB)";
  if (isHabaChaplain) {
    goalMessage = `Meta: 2 visitas/dia (${nonHabaDaysStr})`;
  } else if (isIntern) {
    goalMessage = "Meta: 2 visitas por semana (HAB)";
  }
  
  const statusColors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    critical: 'bg-rose-50 border-rose-200 text-rose-700'
  };

  const statusIcons = {
    success: 'fa-check-circle',
    warning: 'fa-exclamation-triangle',
    critical: 'fa-fire'
  };

  const statusMessages = {
    success: 'Em Dia! Excelente trabalho.',
    warning: `Atenção: ${deficit} visitas acumuladas.`,
    critical: `Crítico: ${deficit} colaboradores aguardando visita!`
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-lg shadow-inner border border-indigo-100">
            <i className="fas fa-hands-helping"></i>
          </div>
          <div>
            <h3 className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tight">Visitas a Colaboradores</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acompanhamento de Metas</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
          <i className="fas fa-trophy text-amber-500 text-xs"></i>
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Total Histórico: {historicalTotal} visitas</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Card 1: Progresso do Mês */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center relative overflow-hidden">
          {isHabaDay && (
            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-widest shadow-sm">
              📍 Hoje é dia de HABA!
            </div>
          )}
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Visitas no Mês</p>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-black text-slate-800 leading-none">{current}</span>
            <span className="text-xs font-bold text-slate-400 mb-0.5">/ {expected} esperadas</span>
          </div>
          <p className="text-[8px] font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 inline-block self-start">
            {goalMessage}
          </p>
        </div>

        {/* Card 2: Termômetro de Acúmulo */}
        <div className={`md:col-span-2 p-4 rounded-2xl border flex flex-col justify-center gap-3 ${statusColors[status]}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/50 rounded-xl flex items-center justify-center text-xl shadow-sm">
              <i className={`fas ${statusIcons[status]}`}></i>
            </div>
            <div className="flex-1">
              <h4 className="font-black uppercase text-xs tracking-widest mb-0.5">Status de Acúmulo</h4>
              <p className="font-bold text-xs">{statusMessages[status]}</p>
            </div>
          </div>
          {deficit > 0 && (
            <div className="h-1.5 w-full bg-white/50 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min((deficit / 10) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Seção Extra para Capelão HABA */}
      {isHabaChaplain && (
        <div className="mt-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm">
              <i className="fas fa-hospital"></i>
            </div>
            <div>
              <h4 className="font-black text-indigo-900 text-[10px] uppercase tracking-widest">Meta Mensal HABA ({habaDaysStr})</h4>
              <p className="text-indigo-700 text-[9px] font-bold">Alvo: 8 visitas por mês</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-indigo-900 leading-none">
              {goals.find(g => g.type === 'monthly')?.current || 0}
            </span>
            <span className="text-[10px] font-bold text-indigo-400"> / 8</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitGoalWidget;
