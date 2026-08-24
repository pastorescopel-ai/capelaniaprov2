import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ChaplainStatLite {
  user: { id: string };
  name: string;
  totalActions: number;
}

interface ChaplainComparisonModalProps {
  chaplainStats: ChaplainStatLite[];
  avgTeamActions: number;
  highlightedUserId: string | null;
  onClose: () => void;
}

// Aberto ao clicar no "Vs. Média Equipe" dentro do Panorama de um capelão -- mostra o mesmo
// totalActions de todos os capelães lado a lado (ranking), com o capelão clicado destacado,
// pra dar o contexto por trás do percentual (quem está puxando a média pra cima/baixo).
const ChaplainComparisonModal: React.FC<ChaplainComparisonModalProps> = ({ chaplainStats, avgTeamActions, highlightedUserId, onClose }) => {
  if (!highlightedUserId) return null;

  const sorted = [...chaplainStats].sort((a, b) => b.totalActions - a.totalActions);
  const maxVal = Math.max(...sorted.map(s => s.totalActions), avgTeamActions, 1);
  const highlighted = sorted.find(s => s.user.id === highlightedUserId);
  const avgPct = Math.min((avgTeamActions / maxVal) * 100, 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-8 space-y-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Comparativo entre Capelães</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Total de ações no período filtrado{highlighted ? ` -- ${highlighted.name} em destaque` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          <div className="space-y-4">
            {sorted.map((s, i) => {
              const isHighlighted = s.user.id === highlightedUserId;
              const pct = s.totalActions > 0 ? Math.max((s.totalActions / maxVal) * 100, 3) : 0;
              return (
                <div key={s.user.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-black uppercase tracking-tight truncate flex items-center gap-1.5 ${isHighlighted ? 'text-blue-700' : 'text-slate-500'}`}>
                      {i === 0 && s.totalActions > 0 && <i className="fas fa-crown text-amber-400 text-[9px]"></i>}
                      {s.name}
                      {isHighlighted && (
                        <span className="text-[7px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-md uppercase tracking-widest">Selecionado</span>
                      )}
                    </span>
                    <span className={`text-[11px] font-black flex-shrink-0 ${isHighlighted ? 'text-blue-700' : 'text-slate-400'}`}>{s.totalActions}</span>
                  </div>
                  <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, delay: i * 0.03, ease: 'easeOut' }}
                      className={`h-full rounded-full ${isHighlighted ? 'bg-blue-600' : 'bg-slate-300'}`}
                    />
                  </div>
                </div>
              );
            })}

            {sorted.length === 0 && (
              <p className="text-xs font-bold text-slate-400 text-center py-6">Nenhum capelão com dados no período filtrado.</p>
            )}
          </div>

          <div className="pt-4 border-t border-dashed border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Média da equipe (só quem teve ação no período)</span>
              <span className="text-sm font-black text-slate-700">{avgTeamActions.toFixed(1)}</span>
            </div>
            <div className="h-2 w-full bg-slate-50 rounded-full relative">
              <div className="absolute top-0 bottom-0 w-0.5 bg-slate-400" style={{ left: `${avgPct}%` }} />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChaplainComparisonModal;
