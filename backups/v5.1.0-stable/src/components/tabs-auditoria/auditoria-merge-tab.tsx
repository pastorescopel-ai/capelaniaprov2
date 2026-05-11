import React, { useState, useMemo, useCallback } from 'react';
import Autocomplete from '../Shared/Autocomplete';
import { PersonType } from '../../hooks/useDataHealer';

interface AuditoriaMergeTabProps {
  mergeSourceType: PersonType;
  setMergeSourceType: (type: PersonType) => void;
  mergeSourceId: string;
  setMergeSourceId: (id: string) => void;
  mergeTargetType: PersonType;
  setMergeTargetType: (type: PersonType) => void;
  mergeTargetId: string;
  setMergeTargetId: (id: string) => void;
  officialStaffOptions: any[];
  officialPatientOptions: any[];
  officialProviderOptions: any[];
  handleUniversalMerge: (sourceType: PersonType, sourceId: string, targetType: PersonType, targetId: string) => void;
  isProcessing: boolean;
}

const AuditoriaMergeTab: React.FC<AuditoriaMergeTabProps> = ({
  mergeSourceType,
  setMergeSourceType,
  mergeSourceId,
  setMergeSourceId,
  mergeTargetType,
  setMergeTargetType,
  mergeTargetId,
  setMergeTargetId,
  officialStaffOptions,
  officialPatientOptions,
  officialProviderOptions,
  handleUniversalMerge,
  isProcessing
}) => {
  const getOptions = useCallback((type: string) => {
    if (type === 'Colaborador' || type === 'Ex-Colaborador') return officialStaffOptions;
    if (type === 'Paciente') return officialPatientOptions;
    return officialProviderOptions;
  }, [officialStaffOptions, officialPatientOptions, officialProviderOptions]);

  const getLabel = useCallback((type: string, id: string) => {
    const options = getOptions(type);
    const opt = options.find((o) => String(o.value) === String(id));
    return opt ? opt.label : '';
  }, [getOptions]);

  const [sourceInput, setSourceInput] = useState("");
  const [hasUserTypedSource, setHasUserTypedSource] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [hasUserTypedTarget, setHasUserTypedTarget] = useState(false);

  const sourceLabel = useMemo(() => mergeSourceId ? getLabel(mergeSourceType, mergeSourceId) : "", [mergeSourceId, mergeSourceType, getLabel]);
  const targetLabel = useMemo(() => mergeTargetId ? getLabel(mergeTargetType, mergeTargetId) : "", [mergeTargetId, mergeTargetType, getLabel]);

  const displaySourceInput = hasUserTypedSource ? sourceInput : sourceLabel;
  const displayTargetInput = hasUserTypedTarget ? targetInput : targetLabel;

  const handleMerge = () => {
    if (!mergeSourceId || !mergeTargetId) return;
    if (mergeSourceId === mergeTargetId && mergeSourceType === mergeTargetType) {
      alert("Não é possível mesclar um cadastro com ele mesmo.");
      return;
    }

    const sLabel = getLabel(mergeSourceType, mergeSourceId);
    const tLabel = getLabel(mergeTargetType, mergeTargetId);

    if (confirm(`ATENÇÃO: Você está prestes a transferir todo o histórico de "${sLabel}" (${mergeSourceType}) para "${tLabel}" (${mergeTargetType}).\n\nO cadastro de origem ("${sLabel}") SERÁ APAGADO DEFINITIVAMENTE.\n\nTem certeza que deseja continuar?`)) {
      handleUniversalMerge(mergeSourceType, mergeSourceId, mergeTargetType, mergeTargetId);
      setMergeSourceId("");
      setMergeTargetId("");
      setSourceInput("");
      setTargetInput("");
      setHasUserTypedSource(false);
      setHasUserTypedTarget(false);
    }
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100">
      <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center rounded-t-[3rem]">
        <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Mesclagem Universal</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase">
          <i className="fas fa-compress-arrows-alt mr-1"></i> Unificar Cadastros
        </span>
      </div>
      <div className="p-8 space-y-8">
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-4">
          <i className="fas fa-exclamation-triangle text-amber-500 mt-1"></i>
          <div className="text-xs text-amber-800 font-medium leading-relaxed">
            <strong>Atenção:</strong> Esta ferramenta transfere todo o histórico (visitas, estudos, aulas) do cadastro de origem para o cadastro de destino e, em seguida, <strong>apaga o cadastro de origem</strong>. Use com cautela para resolver duplicidades ou categorizações incorretas.
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="flex-1 w-full bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <h4 className="font-black text-slate-600 uppercase text-xs mb-4 flex items-center gap-2">
              <i className="fas fa-sign-out-alt text-rose-500"></i> Cadastro Incorreto (Origem)
            </h4>
            <div className="space-y-4">
              <div className="flex flex-wrap bg-slate-200 rounded-lg p-1">
                {['Colaborador', 'Paciente', 'Prestador'].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setMergeSourceType(t as PersonType);
                      setMergeSourceId("");
                      setSourceInput("");
                    }}
                    className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${mergeSourceType === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
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
                onSelectOption={(label, val) => {
                  setMergeSourceId(String(val));
                  setSourceInput(label);
                  setHasUserTypedSource(false);
                }}
                placeholder="Selecionar cadastro de origem..."
                className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="bg-slate-100 p-4 rounded-full">
            <i className="fas fa-arrow-right text-slate-400 text-xl hidden lg:block"></i>
            <i className="fas fa-arrow-down text-slate-400 text-xl block lg:hidden"></i>
          </div>

          <div className="flex-1 w-full bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <h4 className="font-black text-slate-600 uppercase text-xs mb-4 flex items-center gap-2">
              <i className="fas fa-sign-in-alt text-emerald-500"></i> Cadastro Correto (Destino)
            </h4>
            <div className="space-y-4">
              <div className="flex flex-wrap bg-slate-200 rounded-lg p-1">
                {['Colaborador', 'Paciente', 'Prestador'].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setMergeTargetType(t as PersonType);
                      setMergeTargetId("");
                      setTargetInput("");
                    }}
                    className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${mergeTargetType === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
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
                onSelectOption={(label, val) => {
                  setMergeTargetId(String(val));
                  setTargetInput(label);
                  setHasUserTypedTarget(false);
                }}
                placeholder="Selecionar cadastro de destino..."
                className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-center">
          <button
            onClick={handleMerge}
            disabled={!mergeSourceId || !mergeTargetId || isProcessing}
            className="px-12 py-5 bg-slate-800 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-900 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none flex items-center gap-3"
          >
            {isProcessing ? (
              <i className="fas fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fas fa-compress-arrows-alt"></i>
            )}
            Executar Mesclagem
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditoriaMergeTab;
