import React from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  colorClass?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  actionText, 
  onAction,
  colorClass = "text-blue-500 bg-blue-50 border-blue-100"
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner border ${colorClass}`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">{title}</h3>
      <p className="text-sm font-bold text-slate-500 max-w-xs mx-auto mb-8 leading-relaxed">
        {description}
      </p>
      
      {actionText && onAction && (
        <button 
          onClick={onAction}
          className="px-8 py-3 bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-slate-200 hover:bg-slate-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3"
        >
          <span>{actionText}</span>
          <i className="fas fa-arrow-right"></i>
        </button>
      )}
    </div>
  );
};

export default EmptyState;
