import React from 'react';

export interface ReportDetailsRow {
  primary: string;
  secondary?: string;
  badge?: string;
}

interface ReportDetailsModalProps {
  title: string;
  subtitle: string;
  rows: ReportDetailsRow[];
  onClose: () => void;
}

// Mesmo estilo do modal "Auditando: {setor}" já usado em Gestão de PGs -- reaproveitado aqui
// pra todo card clicável de Relatórios (alunos, colaboradores, classes, visitas, meses).
const ReportDetailsModal: React.FC<ReportDetailsModalProps> = ({ title, subtitle, rows, onClose }) => {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
      >
        <div className="p-8 border-b flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{title}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-2xl bg-white text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 transition-all flex items-center justify-center flex-shrink-0"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto no-scrollbar">
          {rows.length === 0 ? (
            <p className="text-center text-slate-400 font-bold uppercase tracking-widest text-xs py-10">Nada encontrado neste período/filtro.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{r.primary}</h4>
                      {r.secondary && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{r.secondary}</p>}
                    </div>
                  </div>
                  {r.badge && (
                    <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1 rounded-lg flex-shrink-0 ml-2">
                      {r.badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportDetailsModal;
