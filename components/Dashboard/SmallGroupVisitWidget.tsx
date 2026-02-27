
import React from 'react';
import { User, VisitRequest } from '../../types';

interface SmallGroupVisitWidgetProps {
  requests: VisitRequest[];
  currentUser: User;
  onGoToTab: (tab: string) => void;
}

const SmallGroupVisitWidget: React.FC<SmallGroupVisitWidgetProps> = ({ requests, currentUser, onGoToTab }) => {
  // Pegar data de hoje no formato YYYY-MM-DD considerando fuso local
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
  
  const todaysVisits = requests.filter(req => {
    // A data no VisitRequest pode vir como ISO ou apenas YYYY-MM-DD
    const reqDate = req.date.split('T')[0];
    return req.status === 'confirmed' && 
           req.assignedChaplainId === currentUser.id && 
           reqDate === todayStr;
  });

  if (todaysVisits.length === 0) return null;

  return (
    <div 
      onClick={() => onGoToTab('smallGroup')}
      className="bg-indigo-50 border border-indigo-200 p-5 rounded-3xl flex items-center justify-between shadow-sm group cursor-pointer hover:bg-indigo-100 transition-all animate-in slide-in-from-top duration-500 mb-6"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
          <i className="fas fa-users"></i>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
            <h4 className="font-black text-indigo-900 text-sm md:text-base uppercase tracking-tight">Hoje tem PG!</h4>
          </div>
          <p className="text-indigo-700 font-bold text-[10px] md:text-xs leading-tight">
            {todaysVisits.length === 1 
              ? `Visita agendada: ${todaysVisits[0].pgName}`
              : `Você tem ${todaysVisits.length} visitas de PGs para realizar hoje.`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-[9px] font-black text-indigo-400 uppercase tracking-widest">Registrar</span>
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:translate-x-1 transition-transform border border-indigo-100">
          <i className="fas fa-arrow-right"></i>
        </div>
      </div>
    </div>
  );
};

export default SmallGroupVisitWidget;
