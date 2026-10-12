import React from 'react';

interface Props {
  title: string;
  detail: string;
  onEdit?: () => void;
  onDismiss: () => void;
}

const DuplicateNotice: React.FC<Props> = ({ title, detail, onEdit, onDismiss }) => (
  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-1.5"><i className="fas fa-triangle-exclamation"></i> {title}</p>
      <p className="text-[11px] font-bold text-amber-800/80 mt-1">{detail}</p>
    </div>
    <div className="flex gap-2 flex-wrap">
      {onEdit && (
        <button type="button" onClick={onEdit} className="px-3 py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 active:scale-95 transition-all">Editar o de hoje</button>
      )}
      <button type="button" onClick={onDismiss} className="px-3 py-2 rounded-xl bg-white border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 active:scale-95 transition-all">Lançar outro mesmo assim</button>
    </div>
  </div>
);

export default DuplicateNotice;
