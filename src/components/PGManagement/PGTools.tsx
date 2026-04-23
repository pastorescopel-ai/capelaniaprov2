
import React, { useState, useMemo } from 'react';
import { Unit, ProGroup } from '../../types';
import { useApp } from '../../hooks/useApp';
import { useToast } from '../../contexts/ToastContext';
import { cleanID } from '../../utils/formatters';

interface PGToolsProps {
  unit: Unit;
}

const PGTools: React.FC<PGToolsProps> = ({ unit }) => {
  const { proGroups, saveRecord, config } = useApp();
  const { showToast } = useToast();
  const [newPGName, setNewPGName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Lógica para encontrar o próximo ID disponível (preenchendo lacunas ou incrementando o maior)
  const nextAvailableId = useMemo(() => {
    const unitGroups = proGroups.filter(g => g.unit === unit && g.active !== false);
    const ids = unitGroups
      .map(g => parseInt(cleanID(g.id)))
      .filter(id => !isNaN(id))
      .sort((a, b) => a - b);

    if (ids.length === 0) return 1;

    // Tenta encontrar a primeira lacuna na sequência
    for (let i = 0; i < ids.length; i++) {
        const expected = i + 1;
        if (ids[i] !== expected) {
            return expected;
        }
    }

    // Se não houver lacunas, retorna o maior + 1
    return ids[ids.length - 1] + 1;
  }, [proGroups, unit]);

  const handleCreatePG = async () => {
    if (!newPGName.trim()) {
      showToast("Por favor, insira o nome do PG.", "warning");
      return;
    }

    // Verifica se já existe um PG com o mesmo nome na mesma unidade
    const exists = proGroups.some(g => 
        g.unit === unit && 
        g.active !== false && 
        g.name.trim().toUpperCase() === newPGName.trim().toUpperCase()
    );

    if (exists) {
        showToast("Já existe um PG com este nome nesta unidade.", "warning");
        return;
    }

    setIsSaving(true);
    try {
      const newPG: ProGroup = {
        id: String(nextAvailableId),
        name: newPGName.trim().toUpperCase(),
        unit: unit,
        active: true,
        cycleMonth: config.activeCompetenceMonth || new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await saveRecord('proGroups', newPG);
      showToast(`PG ${newPG.id} - ${newPG.name} criado com sucesso!`, "success");
      setNewPGName('');
    } catch (error) {
      console.error("Erro ao criar PG:", error);
      showToast("Erro ao criar PG no banco de dados.", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 relative overflow-hidden">
        {/* Decoração de Fundo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none"></div>
        
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200">
            <i className="fas fa-plus-circle"></i>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Criar Novo Pequeno Grupo</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Configuração de Infraestrutura Estratégica</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-end relative z-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-2">Código Sugerido (Automático)</label>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-black text-slate-400 flex items-center justify-between group hover:border-blue-200 transition-all">
                <div className="flex items-center gap-3">
                    <span className="text-lg text-slate-800">{nextAvailableId}</span>
                    <span className="text-[8px] bg-blue-100 text-blue-600 px-2 py-1 rounded-full uppercase tracking-tighter">ID Sequencial</span>
                </div>
                <i className="fas fa-magic text-blue-200 group-hover:text-blue-400 transition-colors"></i>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-2">Nome do Novo PG</label>
              <input 
                type="text"
                value={newPGName}
                onChange={(e) => setNewPGName(e.target.value)}
                placeholder="Ex: PG ESPERANÇA..."
                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-slate-800 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="pb-1">
            <button 
              onClick={handleCreatePG}
              disabled={isSaving || !newPGName.trim()}
              className="w-full px-10 py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
            >
              <i className={`fas ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-check-circle'}`}></i>
              {isSaving ? 'Processando...' : 'Confirmar Criação'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Card Informativo de Lógica de Negócio */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-amber-50 p-6 rounded-[2.5rem] border border-amber-100 flex gap-4 items-start shadow-sm">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <i className="fas fa-info-circle"></i>
            </div>
            <div className="space-y-1">
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">Geração Inteligente de Código</h4>
            <p className="text-[10px] text-amber-800/70 font-bold leading-relaxed">
                O sistema analisa a unidade <span className="font-black">{unit}</span> e identifica o primeiro número vago na sequência (ex: se houver 1, 2, 4, o sistema sugerirá o 3). Isso mantém a lista organizada e sem "buracos".
            </p>
            </div>
        </div>

        <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100 flex gap-4 items-start shadow-sm">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <i className="fas fa-shield-alt"></i>
            </div>
            <div className="space-y-1">
            <h4 className="text-xs font-black text-emerald-900 uppercase tracking-tight">Validação de Unidade</h4>
            <p className="text-[10px] text-emerald-800/70 font-bold leading-relaxed">
                O novo PG será criado vinculado exclusivamente à unidade <span className="font-black">{unit}</span>. Certifique-se de que a unidade selecionada no topo da página está correta antes de confirmar.
            </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PGTools;
