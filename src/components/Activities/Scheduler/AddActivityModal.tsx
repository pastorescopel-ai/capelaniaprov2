
import React, { useState, useEffect } from 'react';
import { Unit, ProSector, User, ActivitySchedule } from '../../../types';
import { BLUEPRINT_LOCATIONS } from '../../../constants';
import { Trash2, X, Plus, MapPin, Building2, CalendarDays, Music, ChevronLeft } from 'lucide-react';
import Autocomplete from '../../Shared/Autocomplete';
import { supabase } from '../../../services/supabaseClient';
import { useToast } from '../../../contexts/ToastContext';

type ActivityType = 'blueprint' | 'cult' | 'encontro' | 'visiteCantando';

interface AddActivityModalProps {
  addingActivity: { dayOfWeek: number };
  selectedUser: string;
  selectedUnit: Unit;
  selectedMonth: string;
  globalSchedulesForMonth: ActivitySchedule[];
  sectors: ProSector[];
  chaplains: User[];
  daysOfWeek: { id: number, label: string }[];
  isAdmin: boolean;
  onClose: () => void;
  onConfirm: (newSchedules: any[]) => Promise<void>;
  isSaving: boolean;
}

const TYPE_OPTIONS: { id: ActivityType, label: string, sub: string, icon: React.ReactNode, accent: string }[] = [
  { id: 'blueprint', label: 'Blueprint', sub: 'Visita a local', icon: <MapPin size={20} />, accent: 'indigo' },
  { id: 'cult', label: 'Setor', sub: 'Culto no setor', icon: <Building2 size={20} />, accent: 'emerald' },
  { id: 'encontro', label: 'Encontro', sub: 'Data única', icon: <CalendarDays size={20} />, accent: 'amber' },
  { id: 'visiteCantando', label: 'Visite Cantando', sub: 'Data única', icon: <Music size={20} />, accent: 'rose' },
];

const ACCENT_RING: Record<string, string> = {
  indigo: 'border-indigo-500 bg-indigo-50 text-indigo-700',
  emerald: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-500 bg-amber-50 text-amber-700',
  rose: 'border-rose-500 bg-rose-50 text-rose-700',
};

const ACCENT_ICON_BG: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
};

const AddActivityModal: React.FC<AddActivityModalProps> = ({
  addingActivity,
  selectedUser,
  selectedUnit,
  selectedMonth,
  globalSchedulesForMonth,
  sectors,
  chaplains,
  daysOfWeek,
  isAdmin,
  onClose,
  onConfirm,
  isSaving
}) => {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activityType, setActivityType] = useState<ActivityType | null>(null);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<'manha' | 'tarde'>('tarde');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleWhatsApp, setResponsibleWhatsApp] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [newActivityTime, setNewActivityTime] = useState('');
  const [sectorSelections, setSectorSelections] = useState<{location: string, time: string}[]>([]);
  const [currentSector, setCurrentSector] = useState('');
  const [currentSectorTime, setCurrentSectorTime] = useState('');
  const [modalUserId, setModalUserId] = useState(selectedUser || '');
  const [selectedDays, setSelectedDays] = useState<number[]>(addingActivity?.dayOfWeek ? [addingActivity.dayOfWeek] : []);

  // Custom blueprint/activities locations state
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [deletingLocName, setDeletingLocName] = useState<string | null>(null);

  const handleSelectType = (type: ActivityType) => {
    setActivityType(type);
    setSelectedLocations(type === 'encontro' ? ['Encontro HAB'] : type === 'visiteCantando' ? ['Visite Cantando'] : []);
    setNewActivityTime(type === 'encontro' ? '09:00' : type === 'visiteCantando' ? '15:00' : '');
    setStep(2);
  };

  useEffect(() => {
    const loadCustomLocations = async () => {
      let merged: string[] = [];
      // 1. Try LocalStorage
      try {
        const local = localStorage.getItem(`custom_blueprint_locations_${selectedUnit}`);
        if (local) {
          merged = JSON.parse(local);
        }
      } catch (e) {
        console.warn('Erro ao ler custom locations do localStorage:', e);
      }

      // 2. Try Supabase
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('custom_blueprint_locations')
            .select('name')
            .eq('unit', selectedUnit);

          if (!error && data) {
            const dbList = data.map((d: any) => d.name);
            merged = Array.from(new Set([...merged, ...dbList]));
            localStorage.setItem(`custom_blueprint_locations_${selectedUnit}`, JSON.stringify(merged));
          }
        } catch (dbErr) {
          console.warn('Silent fallback for custom_blueprint_locations select:', dbErr);
        }
      }
      setCustomLocations(merged);
    };

    if (activityType === 'blueprint') {
      loadCustomLocations();
    }
  }, [selectedUnit, activityType]);

  const handleAddCustomLocation = async () => {
    const trimmed = newLocationInput.trim();
    if (!trimmed) return;

    const combined = Array.from(new Set([...BLUEPRINT_LOCATIONS, ...customLocations]));
    if (combined.some(l => l.toLowerCase() === trimmed.toLowerCase())) {
      showToast("Este local já existe!", "warning");
      return;
    }

    const updated = [...customLocations, trimmed];
    setCustomLocations(updated);
    setNewLocationInput('');
    setShowAddInput(false);

    try {
      localStorage.setItem(`custom_blueprint_locations_${selectedUnit}`, JSON.stringify(updated));
    } catch (err) {
      console.warn('Erro local submeter:', err);
    }

    if (supabase) {
      try {
        const { error } = await supabase
          .from('custom_blueprint_locations')
          .insert({ name: trimmed, unit: selectedUnit });

        if (error) {
          console.warn('Silent save to LocalStorage of custom location. DB Table raw insert skipped or needs migration schema to be active:', error.message);
        } else {
          showToast("Local criado e salvo com sucesso!");
        }
      } catch (e) {
        console.warn('Supabase custom location insert errored, fallback successful.');
      }
    }
  };

  const handleDeleteCustomLocation = async (locName: string) => {
    const updated = customLocations.filter(l => l !== locName);
    setCustomLocations(updated);

    if (selectedLocations.includes(locName)) {
      setSelectedLocations(prev => prev.filter(l => l !== locName));
    }

    try {
      localStorage.setItem(`custom_blueprint_locations_${selectedUnit}`, JSON.stringify(updated));
    } catch (err) {
      console.warn('Erro local excluir:', err);
    }

    if (supabase) {
      try {
        const { error } = await supabase
          .from('custom_blueprint_locations')
          .delete()
          .eq('name', locName)
          .eq('unit', selectedUnit);

        if (error) {
          console.warn('Could not delete from custom_blueprint_locations table:', error.message);
        } else {
          showToast("Local removido com sucesso!");
        }
      } catch (e) {
        console.warn('Supabase custom location delete errored.');
      }
    }
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
    const matchShort = cleaned.match(/^(\d{2})(\d{4})(\d{4})$/);
    if (matchShort) return `(${matchShort[1]}) ${matchShort[2]}-${matchShort[3]}`;
    return value;
  };

  const toggleLocation = (loc: string) => {
    setSelectedLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);
  };

  const handleTimeChange = (timeValue: string, isSector: boolean = false) => {
    if (isSector) {
      setCurrentSectorTime(timeValue);
    } else {
      setNewActivityTime(timeValue);
    }

    if (timeValue) {
      const [hourStr] = timeValue.split(':');
      const hour = parseInt(hourStr, 10);
      if (!isNaN(hour)) {
        if (hour >= 7 && hour <= 12) {
          setSelectedPeriod('manha');
        } else if (hour >= 14 && hour <= 18) {
          setSelectedPeriod('tarde');
        }
      }
    }
  };

  const canAdvanceToReview = activityType === 'cult' ? sectorSelections.length > 0 : selectedLocations.length > 0;

  const handleConfirm = () => {
    if (!activityType) return;
    const newSchedules: any[] = [];

    const daysToProcess = (activityType === 'encontro' || activityType === 'visiteCantando') && selectedDate
      ? [new Date(selectedDate + 'T12:00:00').getDay() === 0 ? 7 : new Date(selectedDate + 'T12:00:00').getDay()]
      : selectedDays;

    daysToProcess.forEach(day => {
      if (activityType === 'cult') {
        sectorSelections.forEach(sel => {
          newSchedules.push({
            userId: modalUserId,
            unit: selectedUnit,
            month: selectedMonth,
            dayOfWeek: day,
            date: undefined,
            activityType,
            location: sel.location,
            period: selectedPeriod,
            time: sel.time || undefined,
            createdAt: Date.now()
          });
        });
      } else {
        selectedLocations.forEach(loc => {
          newSchedules.push({
            userId: modalUserId,
            unit: selectedUnit,
            month: selectedMonth,
            dayOfWeek: day,
            date: (activityType === 'encontro' || activityType === 'visiteCantando') && selectedDate ? new Date(selectedDate).toISOString() : undefined,
            activityType,
            location: loc,
            period: selectedPeriod,
            time: newActivityTime || undefined,
            responsibleName: activityType === 'visiteCantando' ? responsibleName : undefined,
            responsibleWhatsApp: activityType === 'visiteCantando' ? responsibleWhatsApp : undefined,
            createdAt: Date.now()
          });
        });
      }
    });

    onConfirm(newSchedules);
  };

  const chaplainName = chaplains.find(c => c.id === modalUserId)?.name || 'Não selecionado';
  const dayLabels = selectedDays.map(id => daysOfWeek.find(d => d.id === id)?.label).filter(Boolean).join(', ');
  const typeInfo = TYPE_OPTIONS.find(t => t.id === activityType);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-6 sm:p-8 my-auto mb-20 sm:mb-auto space-y-6 animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-2 relative">
          {step > 1 && (
            <button onClick={() => setStep(prev => (prev - 1) as 1 | 2)} className="absolute -top-2 -left-2 p-2 text-slate-400 hover:text-slate-600 transition-all">
              <ChevronLeft size={20} />
            </button>
          )}
          <button onClick={onClose} className="absolute -top-2 -right-2 p-2 text-slate-400 hover:text-slate-600 transition-all">
            <X size={20} />
          </button>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Agendar Atividade</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Passo {step} de 3</p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Que tipo de atividade?</label>
            <div className="grid grid-cols-2 gap-3">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectType(opt.id)}
                  className="p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-300 bg-white flex flex-col items-center gap-2 text-center transition-all"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ACCENT_ICON_BG[opt.accent]}`}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase">{opt.label}</p>
                    <p className="text-[9px] font-bold text-slate-400">{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-2xl text-[10px] font-bold text-slate-500">
              <span>Todos os tipos ficam disponíveis em qualquer dia da semana.</span>
            </div>
          </div>
        )}

        {step === 2 && activityType && (
          <div className="space-y-4">
            <div className={`flex items-center gap-2 p-3 rounded-2xl border-2 ${ACCENT_RING[typeInfo!.accent]}`}>
              {typeInfo!.icon}
              <span className="text-[11px] font-black uppercase">{typeInfo!.label}</span>
            </div>

            {(isAdmin || !selectedUser) && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Capelão Responsável</label>
                <select
                  value={modalUserId}
                  onChange={e => setModalUserId(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                >
                  <option value="">Selecione um capelão...</option>
                  {chaplains.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activityType !== 'encontro' && activityType !== 'visiteCantando' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Repetir nos dias</label>
                <div className="flex gap-1">
                  {daysOfWeek.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDays(prev => prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id])}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${
                        selectedDays.includes(d.id) ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {d.label.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Período</label>
              <div className="flex gap-2">
                {(['manha', 'tarde'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
                      selectedPeriod === p
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {p === 'manha' ? 'Manhã' : 'Tarde'}
                  </button>
                ))}
              </div>
            </div>

            {activityType === 'blueprint' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between ml-2 mr-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Locais (Selecione um ou mais)</label>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowAddInput(!showAddInput)}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-1 px-2.5 rounded-lg transition-all"
                    >
                      <Plus size={10} className="stroke-[3px]" /> Criar Espaço
                    </button>
                  )}
                </div>

                {showAddInput && (
                  <div className="flex gap-2 p-2 bg-slate-50 rounded-2xl animate-in slide-in-from-top-2 duration-150">
                    <input
                      type="text"
                      placeholder="Nome do novo local..."
                      value={newLocationInput}
                      onChange={e => setNewLocationInput(e.target.value)}
                      className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomLocation();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomLocation}
                      className="px-3 bg-indigo-600 text-white font-black uppercase text-[9px] tracking-wider rounded-xl hover:bg-indigo-700 transition-all"
                    >
                      Salvar
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 no-scrollbar">
                  {Array.from(new Set([...BLUEPRINT_LOCATIONS, ...customLocations])).map(loc => {
                    const conflictingSchedule = globalSchedulesForMonth.find(s =>
                      s.activityType === 'blueprint' &&
                      String(s.location) === loc &&
                      selectedDays.map(Number).includes(Number(s.dayOfWeek)) &&
                      (s.period || 'tarde') === selectedPeriod
                    );
                    const isBlocked = !!conflictingSchedule;
                    const blockedBy = conflictingSchedule ? chaplains.find(c => c.id === conflictingSchedule.userId)?.name : null;

                    return (
                      <div key={loc} className="relative group/loc w-full">
                        <button
                          type="button"
                          onClick={() => !isBlocked && toggleLocation(loc)}
                          disabled={isBlocked}
                          className={`w-full p-3 pr-8 rounded-xl text-[10px] font-bold uppercase text-left transition-all border-2 flex flex-col gap-1 ${
                            isBlocked
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                              : selectedLocations.includes(loc)
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate block max-w-full">{loc}</span>
                          {isBlocked && (
                            <span className="text-[8px] text-rose-500 font-black tracking-tighter">
                              Bloqueado: {blockedBy || 'Outro Capelão'}
                            </span>
                          )}
                        </button>
                        {isAdmin && customLocations.includes(loc) && !isBlocked && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex gap-1">
                            {deletingLocName === loc ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCustomLocation(loc);
                                    setDeletingLocName(null);
                                  }}
                                  className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold px-1.5 py-0.5 rounded text-[8px] tracking-tight transition-all uppercase"
                                  title="Confirmar exclusão"
                                >
                                  Sim
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingLocName(null);
                                  }}
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold px-1 py-0.5 rounded text-[8px] tracking-tight transition-all uppercase"
                                  title="Cancelar"
                                >
                                  Não
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingLocName(loc);
                                }}
                                className="w-5 h-5 bg-white shadow-md border border-slate-100 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all opacity-0 group-hover/loc:opacity-100"
                                title="Remover local"
                              >
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(activityType === 'encontro' || activityType === 'visiteCantando') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Data Específica</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
                {activityType === 'visiteCantando' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Responsável</label>
                      <input
                        type="text"
                        value={responsibleName}
                        onChange={e => setResponsibleName(e.target.value)}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        placeholder="Nome do responsável"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">WhatsApp do Responsável</label>
                      <input
                        type="text"
                        value={responsibleWhatsApp}
                        onChange={e => setResponsibleWhatsApp(formatPhone(e.target.value))}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activityType === 'cult' && (
              <div className="space-y-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Setor</label>
                    <Autocomplete
                      options={sectors.map(sec => {
                        const conflictingSchedule = globalSchedulesForMonth.find(s =>
                          s.activityType === 'cult' &&
                          String(s.location) === String(sec.id) &&
                          selectedDays.map(Number).includes(Number(s.dayOfWeek)) &&
                          (s.period || 'tarde') === selectedPeriod
                        );
                        const isBlocked = !!conflictingSchedule;
                        const blockedBy = conflictingSchedule ? chaplains.find(c => c.id === conflictingSchedule.userId)?.name : null;

                        return {
                          value: sec.id,
                          label: `${sec.name} [${sec.unit}]${isBlocked ? ` (Bloqueado: ${blockedBy || 'Outro Capelão'})` : ''}`,
                          disabled: isBlocked
                        };
                      })}
                      value={currentSector}
                      onChange={setCurrentSector}
                      placeholder="Buscar ou selecionar setor..."
                      required={false}
                      className="w-full p-3 bg-slate-50 border border-slate-200/50 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div className="w-24 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Horário</label>
                    <input
                      type="time"
                      value={currentSectorTime}
                      onChange={e => handleTimeChange(e.target.value, true)}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (currentSector) {
                        setSectorSelections(prev => [...prev, { location: currentSector, time: currentSectorTime }]);
                        setCurrentSector('');
                        setCurrentSectorTime('');
                      }
                    }}
                    className="px-4 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all font-bold text-xs h-[40px] flex items-center justify-center"
                  >
                    Adicionar
                  </button>
                </div>

                {sectorSelections.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                    {sectorSelections.map((sel, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-900 uppercase">
                            {(() => {
                              const s = sectors.find(s => s.id === sel.location);
                              return s ? `${s.name} [${s.unit}]` : 'Setor Removido';
                            })()}
                          </span>
                          {sel.time && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-200/50 px-2 py-0.5 rounded-full">
                              {sel.time}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setSectorSelections(prev => prev.filter((_, i) => i !== idx))}
                          className="text-emerald-400 hover:text-rose-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activityType !== 'cult' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Horário (Opcional)</label>
                <input
                  type="time"
                  value={newActivityTime}
                  onChange={e => handleTimeChange(e.target.value, false)}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
            )}

            <button
              onClick={() => setStep(3)}
              disabled={!modalUserId || !canAdvanceToReview}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 3 && activityType && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase">Tipo</span>
                <span className="text-[11px] font-black text-slate-800 uppercase">{typeInfo!.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase">Capelão</span>
                <span className="text-[11px] font-black text-slate-800 uppercase">{chaplainName}</span>
              </div>
              {(activityType === 'blueprint' || activityType === 'cult') && (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Dias</span>
                  <span className="text-[11px] font-black text-slate-800 uppercase">{dayLabels || '—'}</span>
                </div>
              )}
              {(activityType === 'encontro' || activityType === 'visiteCantando') && selectedDate && (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Data</span>
                  <span className="text-[11px] font-black text-slate-800 uppercase">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase">Período</span>
                <span className="text-[11px] font-black text-slate-800 uppercase">{selectedPeriod === 'manha' ? 'Manhã' : 'Tarde'}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase block">
                  {activityType === 'cult' ? `Setores (${sectorSelections.length})` : `Locais (${selectedLocations.length})`}
                </span>
                {activityType === 'cult' ? (
                  sectorSelections.map((sel, idx) => {
                    const s = sectors.find(s => s.id === sel.location);
                    return <p key={idx} className="text-[10px] font-bold text-slate-600">{s ? `${s.name} [${s.unit}]` : 'Setor Removido'}{sel.time ? ` — ${sel.time}` : ''}</p>;
                  })
                ) : (
                  selectedLocations.map(loc => <p key={loc} className="text-[10px] font-bold text-slate-600">{loc}</p>)
                )}
              </div>
              {activityType === 'visiteCantando' && (responsibleName || responsibleWhatsApp) && (
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  {responsibleName && <p className="text-[10px] font-bold text-slate-600">Responsável: {responsibleName}</p>}
                  {responsibleWhatsApp && <p className="text-[10px] font-bold text-slate-600">WhatsApp: {responsibleWhatsApp}</p>}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSaving}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddActivityModal;
