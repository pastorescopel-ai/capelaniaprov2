
import React from 'react';

interface FormScaffoldProps {
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode; // Botões de Toggle e Limpar
  children: React.ReactNode; // O formulário em si (<form>...</form>)
  history?: React.ReactNode; // A seção de histórico abaixo
}

const FormScaffold: React.FC<FormScaffoldProps> = ({ 
  title, 
  subtitle, 
  headerActions, 
  children, 
  history 
}) => {
  return (
    <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        
        {/* Cabeçalho Unificado */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{title}</h2>
            {subtitle && (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{subtitle}</p>
            )}
          </div>
          
          {headerActions && (
            <div className="flex items-center gap-2 self-start md:self-auto">
              {headerActions}
            </div>
          )}
        </div>

        {/* Conteúdo do Formulário */}
        {children}
      </div>

      {/* Seção de Histórico */}
      {history}
    </div>
  );
};

export default FormScaffold;
