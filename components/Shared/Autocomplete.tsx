
import React, { useState, useMemo } from 'react';
import { normalizeString } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';

export interface AutocompleteOption {
  value: string;      // O valor real que será salvo (ex: nome limpo ou formatado)
  label: string;      // Título principal (Nome + Matrícula)
  subLabel?: string;  // Informação secundária (Setor)
  category?: 'RH' | 'History';
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (v: string) => void;
  onSelectOption?: (v: string) => void;
  placeholder: string;
  isStrict?: boolean;
  required?: boolean; // Nova prop para controle de validação
  className?: string;
}

const Autocomplete: React.FC<AutocompleteProps> = ({ 
  options, 
  value, 
  onChange, 
  onSelectOption, 
  placeholder, 
  isStrict, 
  required = true, // Padrão continua sendo obrigatório
  className 
}) => {
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();

  const filtered = useMemo(() => {
    const search = normalizeString(value);
    if (!search && !open) return [];

    // Filtra por label ou subLabel
    const results = options.filter(o => 
      normalizeString(o.label).includes(search) || 
      (o.subLabel && normalizeString(o.subLabel).includes(search))
    );

    // Ordenação: 1. Oficiais (RH), 2. Histórico
    return results.sort((a, b) => {
      if (a.category === 'RH' && b.category !== 'RH') return -1;
      if (a.category !== 'RH' && b.category === 'RH') return 1;
      return a.label.localeCompare(b.label);
    });
  }, [options, value, open]);

  const validateInput = (currentValue: string) => {
    // Apenas valida se estiver no modo estrito e houver algum valor digitado
    if (isStrict && currentValue.trim()) {
        const normVal = normalizeString(currentValue);
        // Verifica se o valor digitado corresponde a alguma das opções disponíveis (pelo value ou label)
        // Isso permite que o usuário digite apenas o nome (value) ou veja o nome com matrícula (label)
        const match = options.some(o => normalizeString(o.value) === normVal || normalizeString(o.label) === normVal);
        
        if (!match) {
            showToast("Valor não encontrado no banco de dados.", "warning");
            onChange(''); // Limpa o campo para forçar seleção correta
        }
    }
  };

  return (
    <div className="relative">
      <input 
        required={required} // Usa a prop dinâmica aqui
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
            if (e.key === 'Enter') {
                // Ao dar Enter, valida imediatamente o texto
                validateInput(value);
                setOpen(false);
            }
        }}
        onBlur={() => {
           // Delay para permitir que o clique na opção ocorra antes do blur fechar/validar
           setTimeout(() => {
             setOpen(false);
             validateInput(value);
           }, 250);
        }}
        className={className || "w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 transition-all placeholder:text-slate-400"}
      />
      
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] w-full mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-80 overflow-y-auto no-scrollbar animate-in slide-in-from-top-2 duration-200">
          <div className="p-2">
            {filtered.map((o, idx) => {
              const isOfficial = o.category === 'RH';
              const showHeader = idx === 0 || filtered[idx-1].category !== o.category;
              
              return (
                <React.Fragment key={o.label + idx}>
                  {/* Header de Categoria */}
                  {showHeader && (
                    <div className={`px-4 py-2 text-[8px] font-black uppercase tracking-[0.2em] mb-1 mt-1 rounded-lg ${
                      isOfficial ? 'text-blue-500 bg-blue-50/50' : 'text-slate-400 bg-slate-50'
                    }`}>
                      <i className={`fas ${isOfficial ? 'fa-certificate' : 'fa-history'} mr-2`}></i>
                      {isOfficial ? 'Colaboradores (RH)' : 'Seu Histórico'}
                    </div>
                  )}

                  <button 
                    type="button" 
                    className={`w-full text-left p-3 transition-all rounded-xl flex items-center justify-between group mb-1 border-2 border-transparent
                      ${isOfficial 
                        ? 'hover:bg-blue-600 hover:text-white text-slate-800' 
                        : 'hover:bg-slate-100 text-slate-700'
                      }`} 
                    onMouseDown={(e) => { 
                      e.preventDefault(); 
                      onChange(o.value);
                      if(onSelectOption) onSelectOption(o.label); // Passa o label para o parser de matrícula
                      setOpen(false); 
                    }}
                  >
                    <div className="min-w-0">
                      <span className={`block text-sm uppercase tracking-tight whitespace-normal leading-tight ${isOfficial ? 'font-black' : 'font-bold'}`}>
                        {o.label}
                      </span>
                      {o.subLabel && (
                        <span className={`block text-[9px] uppercase font-bold tracking-wider mt-0.5 opacity-60 flex items-center gap-1`}>
                          <i className="fas fa-building text-[8px]"></i> {o.subLabel}
                        </span>
                      )}
                    </div>
                    {isOfficial && (
                      <i className="fas fa-magic text-[10px] text-blue-500 group-hover:text-white transition-transform group-hover:scale-125 ml-2"></i>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Autocomplete;
