import React, { useState, useEffect, useMemo } from 'react';
import Autocomplete from '../Shared/Autocomplete';
import { PersonType } from '../../hooks/useDataHealer';
import { useToast } from '../../contexts/ToastContext';

interface HealerMergeTabProps {
  mergeSourceType: PersonType;
  setMergeSourceType: React.Dispatch<React.SetStateAction<PersonType>>;
  mergeSourceId: string;
  setMergeSourceId: React.Dispatch<React.SetStateAction<string>>;
  mergeTargetType: PersonType;
  setMergeTargetType: React.Dispatch<React.SetStateAction<PersonType>>;
  mergeTargetId: string;
  setMergeTargetId: React.Dispatch<React.SetStateAction<string>>;
  officialStaffOptions: any[];
  officialPatientOptions: any[];
  officialProviderOptions: any[];
  handleUniversalMerge: (sourceType: string, sourceId: string, targetType: string, targetId: string) => void;
  isProcessing: boolean;
}

const HealerMergeTab: React.FC<HealerMergeTabProps> = ({
  mergeSourceType, setMergeSourceType,
  mergeSourceId, setMergeSourceId,
  mergeTargetType, setMergeTargetType,
  mergeTargetId, setMergeTargetId,
  officialStaffOptions, officialPatientOptions, officialProviderOptions,
  handleUniversalMerge, isProcessing
}) => {
  const { showToast } = useToast();
  
  const getOptions = React.useCallback((type: PersonType) => {
    if (type === 'Colaborador' || type === 'Ex-Colaborador') return officialStaffOptions;
    if (type === 'Paciente') return officialPatientOptions;
    return officialProviderOptions;
  }, [officialStaffOptions, officialPatientOptions, officialProviderOptions]);

  const getLabel = React.useCallback((type: PersonType, id: string) => {
    const options = getOptions(type);
    const opt = options.find(o => String(o.value) === String(id));
    return opt ? opt.label : '';
  }, [getOptions]);

  const [sourceInput, setSourceInput] = useState('');
  const [hasUserTypedSource, setHasUserTypedSource] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [hasUserTypedTarget, setHasUserTypedTarget] = useState(false);

  const sourceLabel = useMemo(() => mergeSourceId ? getLabel(mergeSourceType, mergeSourceId) : '', [mergeSourceId, mergeSourceType, getLabel]);
  const targetLabel = useMemo(() => mergeTargetId ? getLabel(mergeTargetType, mergeTargetId) : '', [mergeTargetId, mergeTargetType, getLabel]);

  const displaySourceInput = hasUserTypedSource ? sourceInput : sourceLabel;
  const displayTargetInput = hasUserTypedTarget ? targetInput : targetLabel;

  // Sincronizar labels quando IDs mudam (ex: após mesclagem ou seleção externa)
  // Removido useEffect para evitar cascading renders

  const handleMerge = () => {
    if (!mergeSourceId || !mergeTargetId) return;
    if (mergeSourceId === mergeTargetId && mergeSourceType === mergeTargetType) {
        showToast("Não é possível mesclar um cadastro com ele mesmo.", "error");
        return;
    }
    const sourceLabel = getLabel(mergeSourceType, mergeSourceId);
    const targetLabel = getLabel(mergeTargetType, mergeTargetId);
    
    if (confirm(`ATENÇÃO: Você está prestes a transferir todo o histórico de "${sourceLabel}" (${mergeSourceType}) para "${targetLabel}" (${mergeTargetType}).\n\nO cadastro de origem ("${sourceLabel}") SERÁ APAGADO DEFINITIVAMENTE.\n\nTem certeza que deseja continuar?`)) {
        handleUniversalMerge(mergeSourceType, mergeSourceId, mergeTargetType, mergeTargetId);
        setMergeSourceId('');
        setMergeTargetId('');
        setSourceInput('');
        setTargetInput('');
        setHasUserTypedSource(false);
        setHasUserTypedTarget(false);
    }
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100">
        <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center rounded-t-[3rem]">
            <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Mesclagem Universal</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase"><i className="fas fa-compress-arrows-alt mr-1"></i> Unificar Cadastros</span>
        </div>

        <div className="p-8 space-y-8">
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-4">
                <i className="fas fa-exclamation-triangle text-amber-500 mt-1"></i>
                <div className="text-xs text-amber-800 font-medium leading-relaxed">
                    <strong>Atenção:</strong> Esta ferramenta transfere todo o histórico (visitas, estudos, aulas) do cadastro de origem para o cadastro de destino e, em seguida, <strong>apaga o cadastro de origem</strong>. Use com cautela para resolver duplicidades ou categorizações incorretas (ex: alguém cadastrado como Prestador que na verdade é Colaborador).
                </div>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-8">
                {/* ORIGEM */}
                <div className="flex-1 w-full bg-slate-50 p-6 rounded-3xl border border-slate-200">
                    <h4 className="font-black text-slate-600 uppercase text-xs mb-4 flex items-center gap-2">
                        <i className="fas fa-sign-out-alt text-rose-500"></i> Cadastro Incorreto (Origem)
                    </h4>
                    <div className="space-y-4">
                        <div className="flex flex-wrap bg-slate-200 rounded-lg p-1">
                            {(['Colaborador', 'Paciente', 'Prestador'] as PersonType[]).map(t => (
                                <button 
                                    key={t} 
                                    onClick={() => { setMergeSourceType(t); setMergeSourceId(''); setSourceInput(''); setHasUserTypedSource(false); }} 
                                    className={`flex-1 px-3 py-2 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap ${mergeSourceType === t ? 'bg-white shadow text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <Autocomplete 
                            options={getOptions(mergeSourceType)}
                            value={displaySourceInput}
                            onChange={(val) => {
                                setSourceInput(val);
                                setHasUserTypedSource(true);
                            }}
                            onSelectOption={(label) => {
                                const opt = getOptions(mergeSourceType).find(o => o.label === label);
                                if (opt) {
                                    setMergeSourceId(String(opt.value));
                                    setSourceInput(label);
                                    setHasUserTypedSource(false);
                                }
                            }}
                            placeholder={`Buscar ${mergeSourceType}...`}
                            className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all focus:border-rose-500"
                        />
                    </div>
                </div>

                {/* SETA */}
                <div className="flex flex-col items-center justify-center text-slate-300">
                    <i className="fas fa-arrow-right text-3xl hidden lg:block"></i>
                    <i className="fas fa-arrow-down text-3xl block lg:hidden"></i>
                </div>

                {/* DESTINO */}
                <div className="flex-1 w-full bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                    <h4 className="font-black text-emerald-700 uppercase text-xs mb-4 flex items-center gap-2">
                        <i className="fas fa-sign-in-alt text-emerald-500"></i> Cadastro Correto (Destino)
                    </h4>
                    <div className="space-y-4">
                        <div className="flex flex-wrap bg-emerald-200/50 rounded-lg p-1">
                            {(['Colaborador', 'Paciente', 'Prestador'] as PersonType[]).map(t => (
                                <button 
                                    key={t} 
                                    onClick={() => { setMergeTargetType(t); setMergeTargetId(''); setTargetInput(''); setHasUserTypedTarget(false); }} 
                                    className={`flex-1 px-3 py-2 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap ${mergeTargetType === t ? 'bg-white shadow text-emerald-700' : 'text-emerald-600/70 hover:text-emerald-700'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <Autocomplete 
                            options={getOptions(mergeTargetType)}
                            value={displayTargetInput}
                            onChange={(val) => {
                                setTargetInput(val);
                                setHasUserTypedTarget(true);
                            }}
                            onSelectOption={(label) => {
                                const opt = getOptions(mergeTargetType).find(o => o.label === label);
                                if (opt) {
                                    setMergeTargetId(String(opt.value));
                                    setTargetInput(label);
                                    setHasUserTypedTarget(false);
                                }
                            }}
                            placeholder={`Buscar ${mergeTargetType}...`}
                            className="w-full p-4 bg-white border-2 border-emerald-200 rounded-2xl font-bold text-sm outline-none shadow-sm transition-all focus:border-emerald-500"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-center pt-4">
                <button 
                    onClick={handleMerge}
                    disabled={!mergeSourceId || !mergeTargetId || isProcessing}
                    className="px-10 py-5 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3"
                >
                    {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-magic"></i>}
                    <span>Executar Mesclagem</span>
                </button>
            </div>
        </div>
    </div>
  );
};

export default HealerMergeTab;
