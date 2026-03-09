
import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Unit, UserRole, ActivitySchedule } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { BLUEPRINT_LOCATIONS } from '../../constants';
import { Calendar as CalendarIcon, Plus, Trash2, ChevronLeft, ChevronRight, User } from 'lucide-react';

const ActivityScheduler: React.FC = () => {
  const { users, proSectors, activitySchedules, saveRecord, deleteRecord } = useApp();
  const { showToast } = useToast();
  
  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.HAB);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showReplicateModal, setShowReplicateModal] = useState(false);
  const [targetMonth, setTargetMonth] = useState('');

  const [addingActivity, setAddingActivity] = useState<{ dayOfWeek: number, type: 'blueprint' | 'cult' | 'encontro' | 'visiteCantando' } | null>(null);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [newActivityTime, setNewActivityTime] = useState('');
  
  const [sectorSelections, setSectorSelections] = useState<{location: string, time: string}[]>([]);
  const [currentSector, setCurrentSector] = useState('');
  const [currentSectorTime, setCurrentSectorTime] = useState('');

  const chaplains = useMemo(() => 
    users.filter(u => u.role === UserRole.CHAPLAIN || u.role === UserRole.INTERN),
    [users]
  );

  const sectors = useMemo(() => 
    proSectors.filter(s => s.unit === selectedUnit && s.active !== false),
    [proSectors, selectedUnit]
  );

  const filteredSchedules = useMemo(() => 
    activitySchedules.filter(s => s.unit === selectedUnit && s.month === selectedMonth && (selectedUser ? s.userId === selectedUser : true)),
    [activitySchedules, selectedUnit, selectedMonth, selectedUser]
  );

  const handleOpenAddModal = (dayOfWeek: number, type: 'blueprint' | 'cult' | 'encontro' | 'visiteCantando') => {
    if (!selectedUser) {
      showToast("Selecione um capelão primeiro.", "warning");
      return;
    }
    setAddingActivity({ dayOfWeek, type });
    setNewActivityTime('');
    
    if (type === 'encontro') setSelectedLocations(['Encontro HAB']);
    else if (type === 'visiteCantando') setSelectedLocations(['Visite Cantando']);
    else setSelectedLocations([]);

    if (type === 'cult') {
      setSectorSelections([]);
      setCurrentSector(sectors.length > 0 ? sectors[0].id : '');
      setCurrentSectorTime('');
    }
  };

  const toggleLocation = (loc: string) => {
    setSelectedLocations(prev => 
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    );
  };

  const handleConfirmAddSchedule = async () => {
    if (!addingActivity || !selectedUser) return;

    if (addingActivity.type !== 'cult' && selectedLocations.length === 0) return;
    if (addingActivity.type === 'cult' && sectorSelections.length === 0) return;

    setIsSaving(true);
    try {
      let newSchedules: any[] = [];

      if (addingActivity.type === 'cult') {
        newSchedules = sectorSelections.map(sel => ({
          userId: selectedUser,
          unit: selectedUnit,
          month: selectedMonth,
          dayOfWeek: addingActivity.dayOfWeek,
          activityType: addingActivity.type,
          location: sel.location,
          time: sel.time || undefined,
          createdAt: Date.now()
        }));
      } else {
        newSchedules = selectedLocations.map(loc => ({
          userId: selectedUser,
          unit: selectedUnit,
          month: selectedMonth,
          dayOfWeek: addingActivity.dayOfWeek,
          activityType: addingActivity.type,
          location: loc,
          time: newActivityTime || undefined,
          createdAt: Date.now()
        }));
      }

      const toSave = newSchedules.filter(ns => !filteredSchedules.some(s => 
        s.userId === ns.userId && 
        s.dayOfWeek === ns.dayOfWeek && 
        s.activityType === ns.activityType && 
        s.location === ns.location
      ));

      if (toSave.length === 0) {
        showToast("Todas as atividades selecionadas já estão agendadas.", "warning");
        setIsSaving(false);
        return;
      }

      await saveRecord('activitySchedules', toSave.length === 1 ? toSave[0] : toSave);
      showToast("Atividade(s) agendada(s) com sucesso!", "success");
      setAddingActivity(null);
    } catch (error) {
      showToast("Erro ao agendar atividade.", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplicateScale = async () => {
    if (!targetMonth) {
      showToast("Selecione o mês de destino.", "warning");
      return;
    }

    if (targetMonth === selectedMonth) {
      showToast("O mês de destino deve ser diferente do atual.", "warning");
      return;
    }

    const schedulesToCopy = activitySchedules.filter(s => s.unit === selectedUnit && s.month === selectedMonth);
    
    if (schedulesToCopy.length === 0) {
      showToast("Não há agendamentos para copiar neste mês.", "warning");
      return;
    }

    if (!window.confirm(`Deseja copiar ${schedulesToCopy.length} agendamentos para ${formatMonthLabel(targetMonth)}?`)) return;

    setIsSaving(true);
    try {
      const newSchedules = schedulesToCopy.map(s => ({
        userId: s.userId,
        unit: s.unit,
        month: targetMonth,
        dayOfWeek: s.dayOfWeek,
        activityType: s.activityType,
        location: s.location,
        createdAt: Date.now()
      }));

      // Salvar em lote
      await saveRecord('activitySchedules', newSchedules);
      showToast(`Escala replicada com sucesso para ${formatMonthLabel(targetMonth)}!`, "success");
      setShowReplicateModal(false);
    } catch (error) {
      showToast("Erro ao replicar escala.", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm("Deseja remover este agendamento?")) return;
    
    setIsSaving(true);
    try {
      await deleteRecord('activitySchedules', id);
      showToast("Agendamento removido.", "success");
    } catch (error) {
      showToast("Erro ao remover agendamento.", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  const daysOfWeek = [
    { id: 1, label: 'Segunda' },
    { id: 2, label: 'Terça' },
    { id: 3, label: 'Quarta' },
    { id: 4, label: 'Quinta' },
    { id: 5, label: 'Sexta' },
    { id: 6, label: 'Sábado' },
  ];

  const formatMonthLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const changeMonth = (offset: number) => {
    const d = new Date(selectedMonth + 'T12:00:00');
    d.setMonth(d.getMonth() + offset);
    setSelectedMonth(d.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">1. Unidade</label>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[Unit.HAB, Unit.HABA].map(u => (
              <button
                key={u}
                onClick={() => setSelectedUnit(u)}
                className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${
                  selectedUnit === u ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Unidade {u}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">2. Mês de Referência</label>
          <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft size={16} /></button>
            <span className="text-[10px] font-black uppercase tracking-tighter">{formatMonthLabel(selectedMonth)}</span>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">3. Capelão</label>
          <div className="flex gap-2">
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="flex-1 p-3 bg-slate-100 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="">Todos os Capelães</option>
              {chaplains.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowReplicateModal(true)}
              className="px-4 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center"
              title="Replicar Escala"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {showReplicateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Replicar Escala</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Copiar agenda de {formatMonthLabel(selectedMonth)}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Mês de Destino</label>
                <input
                  type="month"
                  value={targetMonth.substring(0, 7)}
                  onChange={e => setTargetMonth(e.target.value + '-01')}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReplicateModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReplicateScale}
                  disabled={isSaving}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Copiando...' : 'Confirmar Cópia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {daysOfWeek.map(day => (
          <div key={day.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50 p-4 border-b border-slate-100 text-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{day.label}</h3>
            </div>
            
            <div className="p-4 flex-1 space-y-4">
              {day.id !== 6 ? (
                <>
                  {/* Blueprint Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-indigo-600">Blueprint</span>
                      <button 
                        onClick={() => handleOpenAddModal(day.id, 'blueprint')}
                        className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {filteredSchedules.filter(s => s.dayOfWeek === day.id && s.activityType === 'blueprint').map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-indigo-50/50 rounded-lg group">
                          <div className="min-w-0">
                            <p className="text-[8px] font-black text-indigo-900 uppercase truncate">{s.location}</p>
                            <div className="flex items-center gap-1">
                              {s.time && <span className="text-[7px] font-bold text-indigo-500 bg-indigo-100 px-1 rounded">{s.time}</span>}
                              {!selectedUser && (
                                <p className="text-[7px] font-bold text-indigo-400 uppercase truncate">
                                  {chaplains.find(c => c.id === s.userId)?.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteSchedule(s.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cult Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-emerald-600">Setores</span>
                      <button 
                        onClick={() => handleOpenAddModal(day.id, 'cult')}
                        className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {filteredSchedules.filter(s => s.dayOfWeek === day.id && s.activityType === 'cult').map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg group">
                          <div className="min-w-0">
                            <p className="text-[8px] font-black text-emerald-900 uppercase truncate">
                              {sectors.find(sec => sec.id === s.location)?.name || 'Setor Removido'}
                            </p>
                            <div className="flex items-center gap-1">
                              {s.time && <span className="text-[7px] font-bold text-emerald-500 bg-emerald-100 px-1 rounded">{s.time}</span>}
                              {!selectedUser && (
                                <p className="text-[7px] font-bold text-emerald-400 uppercase truncate">
                                  {chaplains.find(c => c.id === s.userId)?.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteSchedule(s.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Saturday Section */
                <div className="space-y-4">
                  {/* Encontro HAB */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-amber-600">Encontro HAB</span>
                      <button 
                        onClick={() => handleOpenAddModal(day.id, 'encontro')}
                        className="w-5 h-5 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {filteredSchedules.filter(s => s.dayOfWeek === day.id && s.activityType === 'encontro').map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-amber-50/50 rounded-lg group">
                          <div className="min-w-0">
                            <p className="text-[8px] font-black text-amber-900 uppercase truncate">Encontro HAB</p>
                            <div className="flex items-center gap-1">
                              {s.time && <span className="text-[7px] font-bold text-amber-500 bg-amber-100 px-1 rounded">{s.time}</span>}
                              {!selectedUser && (
                                <p className="text-[7px] font-bold text-amber-400 uppercase truncate">
                                  {chaplains.find(c => c.id === s.userId)?.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteSchedule(s.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visite Cantando */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-rose-600">Visite Cantando</span>
                      <button 
                        onClick={() => handleOpenAddModal(day.id, 'visiteCantando')}
                        className="w-5 h-5 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {filteredSchedules.filter(s => s.dayOfWeek === day.id && s.activityType === 'visiteCantando').map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-rose-50/50 rounded-lg group">
                          <div className="min-w-0">
                            <p className="text-[8px] font-black text-rose-900 uppercase truncate">Visite Cantando</p>
                            <div className="flex items-center gap-1">
                              {s.time && <span className="text-[7px] font-bold text-rose-500 bg-rose-100 px-1 rounded">{s.time}</span>}
                              {!selectedUser && (
                                <p className="text-[7px] font-bold text-rose-400 uppercase truncate">
                                  {chaplains.find(c => c.id === s.userId)?.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteSchedule(s.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Activity Modal */}
      {addingActivity && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
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
              {addingActivity.type === 'blueprint' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Locais (Selecione um ou mais)</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 no-scrollbar">
                    {BLUEPRINT_LOCATIONS.map(loc => (
                      <button
                        key={loc}
                        onClick={() => toggleLocation(loc)}
                        className={`p-3 rounded-xl text-[10px] font-bold uppercase text-left transition-all border-2 ${
                          selectedLocations.includes(loc)
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                            : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
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
                        {sectors.map(sec => (
                          <option key={sec.id} value={sec.id}>{sec.name}</option>
                        ))}
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
                  onClick={() => setAddingActivity(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmAddSchedule}
                  disabled={isSaving || (addingActivity.type === 'cult' ? sectorSelections.length === 0 : selectedLocations.length === 0)}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityScheduler;
