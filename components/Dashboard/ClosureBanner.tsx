
import React, { useState, useEffect } from 'react';
import { UserRole } from '../../types';

interface ClosureBannerProps {
  userRole: UserRole;
}

const ClosureBanner: React.FC<ClosureBannerProps> = ({ userRole }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null);
  
  const now = new Date();
  const currentDay = now.getDate();
  const isGracePeriod = currentDay <= 7;

  useEffect(() => {
    if (userRole === UserRole.ADMIN) return;

    const calculateTime = () => {
      const today = new Date();
      // Data alvo: Dia 8 do mês atual às 00:00:00
      const target = new Date(today.getFullYear(), today.getMonth(), 8, 0, 0, 0);
      const diff = target.getTime() - today.getTime();

      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60)
        });
      } else {
        setTimeLeft(null);
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 60000); // Atualiza a cada minuto
    return () => clearInterval(timer);
  }, [userRole]);

  if (userRole === UserRole.ADMIN) return null;

  // Obter nome do mês anterior
  const prevMonthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(now.getFullYear(), now.getMonth() - 1, 1)
  );

  if (!isGracePeriod) {
    return (
      <div className="bg-slate-800 p-5 rounded-[2rem] flex items-center justify-between shadow-lg border border-slate-700 animate-in fade-in duration-500 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-700 text-slate-400 rounded-xl flex items-center justify-center">
            <i className="fas fa-lock"></i>
          </div>
          <div>
            <h4 className="text-white font-black text-xs uppercase tracking-widest">Mês de {prevMonthName} Encerrado</h4>
            <p className="text-slate-400 text-[9px] font-bold uppercase">Edições retroativas apenas via administração.</p>
          </div>
        </div>
      </div>
    );
  }

  const isCritical = currentDay >= 5;

  return (
    <div className={`${isCritical ? 'bg-amber-500' : 'bg-blue-600'} p-5 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between shadow-xl shadow-blue-100 transition-all duration-500 mb-6 group`}>
      <div className="flex items-center gap-4 mb-4 md:mb-0">
        <div className={`w-12 h-12 ${isCritical ? 'bg-amber-400' : 'bg-blue-500'} text-white rounded-2xl flex items-center justify-center text-xl shadow-inner animate-pulse`}>
          <i className={`fas ${isCritical ? 'fa-hourglass-half' : 'fa-calendar-check'}`}></i>
        </div>
        <div className="text-center md:text-left">
          <h4 className="text-white font-black text-sm uppercase tracking-tighter">Finalize seus registros de {prevMonthName}!</h4>
          <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">O sistema será bloqueado para este mês em breve.</p>
        </div>
      </div>

      {timeLeft && (
        <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-4 border border-white/30">
          <div className="text-center">
            <span className="block text-white font-black text-lg leading-none">{timeLeft.days}</span>
            <span className="text-[7px] text-white/70 font-black uppercase tracking-widest">Dias</span>
          </div>
          <div className="w-px h-6 bg-white/20"></div>
          <div className="text-center">
            <span className="block text-white font-black text-lg leading-none">{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="text-[7px] text-white/70 font-black uppercase tracking-widest">Horas</span>
          </div>
          <div className="w-px h-6 bg-white/20"></div>
          <div className="text-center">
            <span className="block text-white font-black text-lg leading-none">{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="text-[7px] text-white/70 font-black uppercase tracking-widest">Min</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClosureBanner;
