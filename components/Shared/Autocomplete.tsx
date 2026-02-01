import React, { useState } from 'react';

interface AutocompleteProps {
  options: string[];
  highlightOptions?: string[]; // Itens que ganharão brilho e ícone
  value: string;
  onChange: (v: string) => void;
  onSelectOption?: (v: string) => void;
  placeholder: string;
  isStrict?: boolean;
  className?: string;
}

const Autocomplete: React.FC<AutocompleteProps> = ({ options, highlightOptions = [], value, onChange, onSelectOption, placeholder, isStrict, className }) => {
  const [open, setOpen] = useState(false);
  const filtered = options.filter(o => o.toLowerCase().includes(String(value || "").toLowerCase()));

  return (
    <div className="relative">
      <input 
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
           setTimeout(() => {
             setOpen(false);
             if (isStrict && value && !options.includes(value)) {
               onChange("");
             }
           }, 250);
        }}
        className={className || "w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-64 overflow-y-auto no-scrollbar">
          {filtered.map(o => {
            const isHighlighted = highlightOptions.includes(o);
            return (
              <button 
                key={o} 
                type="button" 
                className={`w-full text-left p-4 transition-all border-b border-slate-50 last:border-none flex items-center justify-between
                  ${isHighlighted 
                    ? 'bg-blue-50/50 hover:bg-blue-100 text-blue-700 font-black' 
                    : 'hover:bg-slate-50 text-slate-700 font-bold'
                  }`} 
                onMouseDown={(e) => { 
                  e.preventDefault(); 
                  onChange(o);
                  if(onSelectOption) onSelectOption(o);
                  setOpen(false); 
                }}
              >
                <span className="text-sm uppercase tracking-tight">{o}</span>
                {isHighlighted && (
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Sugerido</span>
                    <i className="fas fa-magic text-blue-500 animate-pulse"></i>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Autocomplete;