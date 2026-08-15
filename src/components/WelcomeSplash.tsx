
import React, { useEffect } from 'react';
import { motion } from 'motion/react';

// Duração de UM loop completo do gif (29 frames), medida quadro a quadro no arquivo
// original -- não é um número chutado. Se o gif for trocado por outro no futuro, essa
// constante precisa ser recalculada para o novo arquivo (some os delays dos frames em
// centésimos de segundo e divida por 100), senão a tela fecha antes ou depois da hora.
const GIF_DURATION_MS = 5800;

interface WelcomeSplashProps {
  onDone: () => void;
}

// Aparece por cima do Dashboard (que já está montado e carregando por trás, sem atraso
// artificial nos dados) logo após um login digitado na tela -- nunca ao restaurar uma
// sessão existente ao recarregar a página. Fecha sozinha quando o gif termina o loop, ou
// na hora se a pessoa tocar/clicar em qualquer lugar.
const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ onDone }) => {
  useEffect(() => {
    const timer = setTimeout(onDone, GIF_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onDone}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-6 bg-slate-900/85 backdrop-blur-md cursor-pointer"
    >
      <motion.img
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        src="/welcome-logo.gif"
        alt="Hospital Adventista de Belém"
        className="w-56 md:w-72 rounded-[2rem] shadow-2xl"
      />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-[10px] font-black text-white/60 uppercase tracking-widest"
      >
        Toque para continuar
      </motion.span>
    </motion.div>
  );
};

export default WelcomeSplash;
