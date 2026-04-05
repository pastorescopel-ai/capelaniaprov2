import { useState, useEffect, useMemo } from 'react';
import { getFifthBusinessDay } from '../utils/formatters';

export const useGracePeriod = (normalizedRole: string) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null);
  const [isGracePeriod, setIsGracePeriod] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    if (normalizedRole === 'ADMIN') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsGracePeriod(false);
      return;
    }

    const calculateTime = () => {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const currentDay = today.getDate();

      let targetDate: Date;
      let showNotification = false;
      let startCountdown = false;

      // Se for dia 25 ou mais do mês atual, mostra a notificação para o próximo mês
      if (currentDay >= 25) {
        showNotification = true;
        // O alvo é o 5º dia útil do próximo mês
        targetDate = getFifthBusinessDay(currentYear, currentMonth + 1);
        // A contagem regressiva só começa no dia 1º do próximo mês
        startCountdown = false; 
      } else {
        // Se for antes do dia 25, verifica se estamos no período de tolerância do mês atual
        targetDate = getFifthBusinessDay(currentYear, currentMonth);
        if (today.getTime() <= targetDate.getTime()) {
          showNotification = true;
          startCountdown = true;
        }
      }

      if (showNotification) {
        setIsGracePeriod(true);
        
        if (startCountdown) {
          const diff = targetDate!.getTime() - today.getTime();
          setIsCritical(diff <= 2 * 24 * 60 * 60 * 1000); // Crítico se faltar 2 dias ou menos
          setTimeLeft({
            days: Math.floor(diff / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((diff / 1000 / 60) % 60)
          });
        } else {
          // Mostra a notificação, mas sem contagem regressiva ainda
          setIsCritical(false);
          setTimeLeft(null);
        }
      } else {
        setIsGracePeriod(false);
        setIsCritical(false);
        setTimeLeft(null);
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 60000);
    return () => clearInterval(timer);
  }, [normalizedRole]);

  const prevMonthName = useMemo(() => {
    const now = new Date();
    // Se estivermos no dia 25 ou depois, a notificação se refere ao mês atual (que está acabando)
    // Se estivermos no início do mês (antes do 5º dia útil), a notificação se refere ao mês passado
    const targetMonth = now.getDate() >= 25 ? now.getMonth() : now.getMonth() - 1;
    
    return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
      new Date(now.getFullYear(), targetMonth, 1)
    );
  }, []);

  return { timeLeft, isGracePeriod, isCritical, prevMonthName };
};
