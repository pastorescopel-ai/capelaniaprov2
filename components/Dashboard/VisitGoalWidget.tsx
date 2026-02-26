
import React from 'react';

interface Goal {
  label: string;
  current: number;
  target: number;
  type: 'daily' | 'weekly' | 'monthly';
}

interface VisitGoalWidgetProps {
  goals: Goal[];
}

const VisitGoalWidget: React.FC<VisitGoalWidgetProps> = ({ goals }) => {
  if (goals.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {goals.map((goal, idx) => {
        const progress = Math.min((goal.current / goal.target) * 100, 100);
        const isCompleted = goal.current >= goal.target;
        
        return (
          <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest leading-tight">{goal.label}</h4>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {goal.current} <span className="text-slate-300 text-sm">/ {goal.target}</span>
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                <i className={`fas ${isCompleted ? 'fa-check-circle' : 'fa-bullseye'}`}></i>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-out rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                  {isCompleted ? 'Alvo atingido! 🎉' : `${goal.target - goal.current} visitas restantes`}
                </span>
                <span className={`text-[9px] font-black uppercase ${isCompleted ? 'text-emerald-600' : 'text-indigo-600'}`}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VisitGoalWidget;
