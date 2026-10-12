import React from 'react';

interface Props {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

const FormDraftBanner: React.FC<Props> = ({ savedAt, onRestore, onDiscard }) => {
  const time = new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sameDay = new Date(savedAt).toDateString() === new Date().toDateString();
  const when = sameDay ? `às ${time}` : `em ${new Date(savedAt).toLocaleDateString('pt-BR')} às ${time}`;
  return (
    <div className="mb-4 p-3.5 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-between gap-3 flex-wrap animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 min-w-0">
        <i className="fas fa-floppy-disk text-sky-500"></i>
        <span className="text-[10px] font-black uppercase tracking-wide text-sky-800">Rascunho salvo {when} — continuar de onde parou?</span>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onRestore} className="px-3 py-2 rounded-xl bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 active:scale-95 transition-all">Continuar</button>
        <button type="button" onClick={onDiscard} className="px-3 py-2 rounded-xl bg-white border border-sky-200 text-sky-700 text-[10px] font-black uppercase tracking-widest hover:bg-sky-100 active:scale-95 transition-all">Descartar</button>
      </div>
    </div>
  );
};

export default FormDraftBanner;
