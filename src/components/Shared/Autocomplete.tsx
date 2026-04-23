
import React, { useState, useMemo, useEffect } from 'react';
import { normalizeString } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';

export interface AutocompleteOption {
  value: string;      // O valor real que será salvo (ex: nome limpo ou formatado)
  label: string;      // Título principal (Nome + Matrícula)
  subLabel?: string;  // Informação secundária (Setor)
  category?: 'RH' | 'History' | 'MyStudents' | 'MyClasses' | 'Migration';
  highlight?: boolean; // Nova flag para destacar em amarelo
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
  const [inputValue, setInputValue] = useState(value);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const { showToast } = useToast();

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [inputValue]);

  const filtered = useMemo(() => {
    const normSearch = normalizeString(debouncedValue);
    if (!normSearch && !open) return [];

    // BUSCA INTELIGENTE: Quebra a busca em termos (palavras)
    const searchTerms = normSearch.split(' ').filter(t => t.trim() !== '');

    // Filtra opções onde TODOS os termos digitados aparecem no label OU no subLabel
    const results = options.filter(o => {
      const normLabel = normalizeString(o.label);
      const normSub = o.subLabel ? normalizeString(o.subLabel) : '';
      
      // Combina Label e SubLabel para permitir buscas como "João UTI"
      const fullText = `${normLabel} ${normSub}`;

      // Verifica se CADA termo da busca está presente no texto combinado
      return searchTerms.every(term => fullText.includes(term));
    });

    // Ordenação: 1. Meus Alunos/Classes (Destaque), 2. Oficiais (RH), 3. Histórico Geral, 4. Migração
    return results.sort((a, b) => {
      if (a.highlight && !b.highlight) return -1;
      if (!a.highlight && b.highlight) return 1;
      if (a.category === 'RH' && b.category !== 'RH') return -1;
      if (a.category !== 'RH' && b.category === 'RH') return 1;
      if (a.category === 'History' && b.category === 'Migration') return -1;
      if (a.category === 'Migration' && b.category === 'History') return 1;
      return a.label.localeCompare(b.label);
    });
  }, [options, debouncedValue, open]);

  const validateInput = (currentValue: string) => {
    // Apenas valida se estiver no modo estrito e houver algum valor digitado
    if (isStrict && currentValue.trim()) {
        const normVal = normalizeString(currentValue);
        // Verifica se o valor digitado corresponde a alguma das opções disponíveis (pelo value ou label)
        const match = options.some(o => normalizeString(o.value) === normVal || normalizeString(o.label) === normVal);
        
        if (!match) {
            showToast("Valor não encontrado no banco de dados. Selecione uma opção da lista.", "warning");
            onChange(''); // Limpa o campo para forçar seleção correta
        }
    }
  };

  return (
    <div className="relative">
      <input 
        required={required} // Usa a prop dinâmica aqui
        placeholder={placeholder}
        value={inputValue || ''}
        onChange={(e) => { 
            const val = e.target.value;
            setInputValue(val); 
            onChange(val); 
            setOpen(true); 
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
            if (e.key === 'Enter') {
                // Ao dar Enter, valida imediatamente o texto
                validateInput(inputValue);
                setOpen(false);
            }
        }}
        onBlur={() => {
           // Delay para permitir que o clique na opção ocorra antes do blur fechar/validar
           setTimeout(() => {
             setOpen(false);
             validateInput(inputValue);
           }, 250);
        }}
        className={className || "w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-800 transition-all placeholder:text-slate-400"}
      />
      
      {open && filtered.length > 0 && (
        <div className="absolute z-[9999] min-w-full w-max max-w-[85vw] md:max-w-[450px] mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-80 overflow-y-auto no-scrollbar animate-in slide-in-from-top-2 duration-200">
          <div className="p-2">
            {filtered.map((o, idx) => {
              const isOfficial = o.category === 'RH';
              const showHeader = idx === 0 || filtered[idx-1].category !== o.category;
              
              return (
                <React.Fragment key={o.label + idx}>
                  {/* Header de Categoria */}
                  {showHeader && (
                    <div className={`px-4 py-2 text-[8px] font-black uppercase tracking-[0.2em] mb-1 mt-1 rounded-lg ${
                      o.highlight ? 'text-amber-600 bg-amber-100' :
                      isOfficial ? 'text-blue-500 bg-blue-50/50' : 
                      o.category === 'Migration' ? 'text-purple-600 bg-purple-50' : 'text-slate-400 bg-slate-50'
                    }`}>
                      <i className={`fas ${o.highlight ? 'fa-star' : isOfficial ? 'fa-certificate' : o.category === 'Migration' ? 'fa-exchange-alt' : 'fa-history'} mr-2`}></i>
                      {o.highlight ? (o.category === 'MyClasses' ? 'Minhas Classes' : 'Meus Alunos') : isOfficial ? 'Colaboradores (RH)' : o.category === 'Migration' ? 'Migrar de Outra Aba' : 'Histórico Geral'}
                    </div>
                  )}

                  <button 
                    type="button" 
                    className={`w-full text-left p-3 transition-all rounded-xl flex items-center justify-between group mb-1 border-2 border-transparent
                      ${o.highlight
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                        : isOfficial 
                        ? 'hover:bg-blue-600 hover:text-white text-slate-800' 
                        : o.category === 'Migration'
                        ? 'hover:bg-purple-50 text-slate-700'
                        : 'hover:bg-slate-100 text-slate-700'
                      }`} 
                    onMouseDown={(e) => { 
                      e.preventDefault(); 
                      onChange(o.value); // Define o valor limpo (ex: Nome)
                      if(onSelectOption) onSelectOption(o.label); // Passa o label completo (com matrícula) para processamento
                      setOpen(false); 
                    }}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <span className={`block text-sm uppercase tracking-tight whitespace-normal break-words leading-tight ${isOfficial ? 'font-black' : 'font-bold'}`}>
                        {o.label}
                      </span>
                      {o.subLabel && (
                        <span className={`block text-[9px] uppercase font-bold tracking-wider mt-0.5 opacity-60 flex items-start gap-1 whitespace-normal break-words`}>
                          <i className="fas fa-building text-[8px] mt-0.5 flex-shrink-0"></i> 
                          <span className="flex-1">{o.subLabel}</span>
                        </span>
                      )}
                    </div>
                    {isOfficial && (
                      <i className="fas fa-magic text-[10px] text-blue-500 group-hover:text-white transition-transform group-hover:scale-125 ml-2 flex-shrink-0"></i>
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
