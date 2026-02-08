
import React from 'react';
import { Unit } from '../../types';
import PGMaestro from '../Admin/PGMaestro';
import { useApp } from '../../contexts/AppContext';

// Reutiliza o PGMaestro existente que já é poderoso e faz exatamente o que precisamos
// (Linkar PGs a Setores e Gerenciar PGs)

interface PGStructureProps {
  unit: Unit;
}

const PGStructure: React.FC<PGStructureProps> = () => {
  // PGMaestro agora acessa o context diretamente
  return (
    <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex gap-4 items-center mb-4">
            <div className="w-12 h-12 bg-amber-200 text-amber-700 rounded-xl flex items-center justify-center text-xl">
                <i className="fas fa-info-circle"></i>
            </div>
            <div>
                <h4 className="font-black text-amber-800 text-sm uppercase">Gerenciamento Estrutural</h4>
                <p className="text-xs text-amber-700/70">Use esta ferramenta para criar novos PGs, fundir duplicatas e definir quais setores cada PG atende.</p>
            </div>
        </div>
        <PGMaestro />
    </div>
  );
};

export default PGStructure;
