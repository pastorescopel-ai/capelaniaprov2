
import React, { useState } from 'react';
import { Unit, ProSector, User, ActivitySchedule } from '../../../types';
import { BLUEPRINT_LOCATIONS } from '../../../constants';
import { Trash2, X } from 'lucide-react';

interface AddActivityModalProps {
  addingActivity: { dayOfWeek: number, type: 'blueprint' | 'cult' | 'encontro' | 'visiteCantando' };
  selectedUser: string;
  selectedUnit: Unit;
  selectedMonth: string;
  globalSchedulesForMonth: ActivitySchedule[];
  sectors: ProSector[];
  chaplains: User[];
  daysOfWeek: { id: number, label: string }[];
  onClose: () => void;
  onConfirm: (newSchedules: any[]) => Promise<void>;
  isSaving: boolean;
}

const AddActivityModal: React.FC<AddActivityModalProps> = ({
  addingActivity,
  selectedUser,
  selectedUnit,
  selectedMonth,
  globalSchedulesForMonth,
  sectors,
  chaplains,
  daysOfWeek,
  onClose,
  onConfirm,
  isSaving
}) => {
  const [selectedDays, setSelectedDays] = useState<number[]>([addingActivity.dayOfWeek]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    addingActivity.type === 'encontro' ? ['Encontro HAB'] : 
    addingActivity.type === 'visiteCantando' ? ['Visite Cantando'] : []
  );
  const [newActivityTime, setNewActivityTime] = useState('');
  const [sectorSelections, setSectorSelections] = useState<{location: string, time: string}[]>([]);
  const [currentSector, setCurrentSector] = useState('');
  const [currentSectorTime, setCurrentSectorTime] = useState('');

  const toggleLocation = (loc: string) => {
    setSelectedLocations(prev => 
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    );
  };

  const handleConfirm = () => {
    const newSchedules: any[] = [];

    selectedDays.forEach(day => {
      if (addingActivity.type === 'cult') {
        sectorSelections.forEach(sel => {
          newSchedules.push({
            userId: selectedUser,
            unit: selectedUnit,
            month: selectedMonth,
            dayOfWeek: day,
            activityType: addingActivity.type,
            location: sel.location,
            time: sel.time || undefined,
            createdAt: Date.now()
          });
        });
      } else {
        selectedLocations.forEach(loc => {
          newSchedules.push({
            userId: selectedUser,
            unit: selectedUnit,
            month: selectedMonth,
            dayOfWeek: day,
            activityType: addingActivity.type,
            location: loc,
            time: newActivityTime || undefined,
            createdAt: Date.now()
          });
        });
      }
    });

    onConfirm(newSchedules);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-2 relative">
          <button onClick={onClose} className="absolute -top-2 -right-2 p-2 text-slate-400 hover:text-slate-600 transition-all">
            <X size={20} />
          </button>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Agendar Atividade</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {daysOfWeek.find(d => d.id === addingActivity.dayOfWeek)?.label} - {
              addingActivity.type === 'blueprint' ? 'Blueprint' : 
              addingActivity.type === 'cult' ? 'Setores' : 
              addingActivity.type === 'encontro' ? 'Encontro HAB' : 'Visite Cantando'
            }
          </p>
        </div>

        <div className="space-y-4">
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

          {addingActivity.type === 'blueprint' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Locais (Selecione um ou mais)</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 no-scrollbar">
                {BLUEPRINT_LOCATIONS.map(loc => {
                  const conflictingSchedule = globalSchedulesForMonth.find(s => 
                    s.activityType === 'blueprint' && 
                    s.location === loc && 
                    selectedDays.includes(s.dayOfWeek)
                  );
                  const isBlocked = !!conflictingSchedule;
                  const blockedBy = conflictingSchedule ? chaplains.find(c => c.id === conflictingSchedule.userId)?.name : null;

                  return (
                    <button
                      key={loc}
                      onClick={() => !isBlocked && toggleLocation(loc)}
                      disabled={isBlocked}
                      className={`p-3 rounded-xl text-[10px] font-bold uppercase text-left transition-all border-2 flex flex-col gap-1 ${
                        isBlocked
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                          : selectedLocations.includes(loc)
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                            : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <span>{loc}</span>
                      {isBlocked && (
                        <span className="text-[8px] text-rose-500 font-black tracking-tighter">
                          Bloqueado: {blockedBy || 'Outro Capelão'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {addingActivity.type === 'cult' && (
            <div className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Setor</label>
                  <select
                    value={currentSector}
                    onChange={e => setCurrentSector(e.target.value)}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  >
                    <option value="">Selecione um setor...</option>
                    {sectors.map(sec => {
                      const conflictingSchedule = globalSchedulesForMonth.find(s => 
                        s.activityType === 'cult' && 
                        s.location === sec.id && 
                        selectedDays.includes(s.dayOfWeek)
                      );
                      const isBlocked = !!conflictingSchedule;
                      const blockedBy = conflictingSchedule ? chaplains.find(c => c.id === conflictingSchedule.userId)?.name : null;

                      return (
                        <option key={sec.id} value={sec.id} disabled={isBlocked}>
                          {sec.name} {isBlocked ? `(Bloqueado: ${blockedBy || 'Outro Capelão'})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="w-24 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Horário</label>
                  <input
                    type="time"
                    value={currentSectorTime}
                    onChange={e => setCurrentSectorTime(e.target.value)}
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
                          {sectors.find(s => s.id === sel.location)?.name}
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

          {addingActivity.type !== 'cult' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Horário (Opcional)</label>
              <input
                type="time"
                value={newActivityTime}
                onChange={e => setNewActivityTime(e.target.value)}
                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSaving || (addingActivity.type === 'cult' ? sectorSelections.length === 0 : selectedLocations.length === 0)}
              className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddActivityModal;
