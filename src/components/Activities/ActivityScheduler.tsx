
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { Unit, UserRole, ActivitySchedule } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { getMonthStartISO } from '../../utils/formatters';
import { Calendar as CalendarIcon, Plus, Trash2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { generateMonthlyScheduleHTML } from '../../utils/activityTemplates';
import { useDocumentGenerator } from '../../hooks/useDocumentGenerator';

// Sub-components
import AddActivityModal from './Scheduler/AddActivityModal';
import ReplicateScaleModal from './Scheduler/ReplicateScaleModal';
import DeleteScheduleModal from './Scheduler/DeleteScheduleModal';

const ActivityScheduler: React.FC = () => {
  const { users, proSectors, activitySchedules, saveRecord, deleteRecord, config, isInitialized } = useApp();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { generatePdf, isGenerating: isGeneratingPdf } = useDocumentGenerator();
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.HAB);
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthStartISO());
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [hasInitializedUser, setHasInitializedUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [activeDay, setActiveDay] = useState<number>(() => {
    const day = new Date().getDay();
    return day === 0 ? 1 : Math.min(day, 6);
  });

  const daysOfWeek = [
    { id: 1, label: 'Segunda', short: 'Seg' },
    { id: 2, label: 'Terça', short: 'Ter' },
    { id: 3, label: 'Quarta', short: 'Qua' },
    { id: 4, label: 'Quinta', short: 'Qui' },
    { id: 5, label: 'Sexta', short: 'Sex' },
    { id: 6, label: 'Sábado', short: 'Sáb' },
  ];

  const chaplains = useMemo(() => {
    const all = users.filter(u => u.role === UserRole.CHAPLAIN || u.role === UserRole.INTERN || u.role === UserRole.ADMIN);
    if (isAdmin) return all;
    return all.filter(u => u.id === currentUser?.id);
  }, [users, isAdmin, currentUser?.id]);

  const filteredSchedules = useMemo(() => 
    activitySchedules.filter(s => 
      s.unit === selectedUnit && 
      s.month === selectedMonth
    ),
    [activitySchedules, selectedUnit, selectedMonth]
  );

  const displaySchedules = useMemo(() => {
    if (!selectedUser) return filteredSchedules;
    return filteredSchedules.filter(s => s.userId === selectedUser);
  }, [filteredSchedules, selectedUser]);

  const groupedSchedules = useMemo(() => {
    const daySchedules = displaySchedules.filter(s => Number(s.dayOfWeek) === activeDay);
    const groups: Record<string, ActivitySchedule[]> = {};
    
    daySchedules.forEach(s => {
      if (!groups[s.userId]) groups[s.userId] = [];
      groups[s.userId].push(s);
    });
    
    return groups;
  }, [displaySchedules, activeDay]);

  const visibleChaplains = useMemo(() => {
    if (selectedUser) return chaplains.filter(c => c.id === selectedUser);
    // Only return chaplains that have some schedule in this month/unit context to avoid empty lists
    // or return all if admin wants to see everything
    return chaplains;
  }, [chaplains, selectedUser]);
  
  // Auto-select user only once on mount or when chaplains load
  useEffect(() => {
    if (!hasInitializedUser && chaplains.length > 0) {
      if (isAdmin) {
        // For admin, default to "Todos os Capelães" (empty string)
        setSelectedUser('');
      } else {
        setSelectedUser(currentUser?.id || '');
      }
      setHasInitializedUser(true);
    }
  }, [chaplains, isAdmin, currentUser?.id, hasInitializedUser]);
  
  const [addingActivity, setAddingActivity] = useState<{ dayOfWeek: number, type: 'blueprint' | 'cult' | 'encontro' | 'visiteCantando' } | null>(null);
  const [showReplicateModal, setShowReplicateModal] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<ActivitySchedule | null>(null);

  useEffect(() => {
    if (!isAdmin && currentUser?.id && selectedUser !== currentUser.id) {
      setSelectedUser(currentUser.id);
    }
  }, [isAdmin, currentUser?.id, selectedUser]);

  const sectors = useMemo(() => 
    proSectors.filter(s => s.unit === selectedUnit && s.active !== false),
    [proSectors, selectedUnit]
  );

  const globalSchedulesForMonth = useMemo(() => 
    activitySchedules.filter(s => s.unit === selectedUnit && s.month === selectedMonth),
    [activitySchedules, selectedUnit, selectedMonth]
  );

  if (!isInitialized) {
    return <div className="p-8 text-center text-slate-500 font-bold">Carregando agenda...</div>;
  }

  const handleOpenAddModal = (dayOfWeek: number, type: 'blueprint' | 'cult' | 'encontro' | 'visiteCantando') => {
    if (!selectedUser && !isAdmin) {
      showToast("Usuário não identificado.", "warning");
      return;
    }
    
    setAddingActivity({ dayOfWeek, type });
  };

  const handleConfirmAddSchedule = async (newSchedules: any[]) => {
    setIsSaving(true);
    try {
      const toSave = newSchedules.filter(ns => {
        const nsLocation = String(ns.location);
        if (ns.activityType === 'blueprint' || ns.activityType === 'cult') {
          const conflict = globalSchedulesForMonth.find(s => 
            Number(s.dayOfWeek) === Number(ns.dayOfWeek) && 
            s.activityType === ns.activityType && 
            String(s.location) === nsLocation &&
            (s.period || 'tarde') === ns.period
          );
          return !conflict;
        } else {
          const conflict = filteredSchedules.find(s => 
            s.userId === ns.userId && 
            Number(s.dayOfWeek) === Number(ns.dayOfWeek) && 
            s.activityType === ns.activityType && 
            String(s.location) === nsLocation &&
            (s.period || 'tarde') === ns.period
          );
          return !conflict;
        }
      });

      if (toSave.length === 0) {
        showToast("Todas as atividades selecionadas já estão agendadas por você ou outro capelão.", "warning");
        setIsSaving(false);
        return;
      }

      if (toSave.length < newSchedules.length) {
        showToast("Algumas atividades foram ignoradas pois já estavam agendadas por outro capelão.", "warning");
      }

      const success = await saveRecord('activitySchedules', toSave.length === 1 ? toSave[0] : toSave);
      if (success) {
        showToast("Atividade(s) agendada(s) com sucesso!", "success");
        setAddingActivity(null);
      } else {
        showToast("Erro ao agendar atividade no servidor.", "warning");
      }
    } catch (error) {
      showToast("Erro ao agendar atividade.", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplicateScale = async (targetMonth: string) => {
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
        period: s.period,
        time: s.time,
        createdAt: Date.now()
      }));

      await saveRecord('activitySchedules', newSchedules);
      showToast(`Escala replicada com sucesso para ${formatMonthLabel(targetMonth)}!`, "success");
      setShowReplicateModal(false);
    } catch (error) {
      showToast("Erro ao replicar escala.", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteSchedule = async (deleteType: 'single' | 'all') => {
    if (!deletingSchedule) return;

    const schedule = deletingSchedule;
    let toDeleteIds = [schedule.id];

    if (deleteType === 'all') {
      toDeleteIds = filteredSchedules
        .filter(s => 
          s.userId === schedule.userId && 
          s.activityType === schedule.activityType && 
          s.location === schedule.location
        )
        .map(s => s.id);
    }
    
    setIsSaving(true);
    try {
      await Promise.all(toDeleteIds.map(id => deleteRecord('activitySchedules', id)));
      showToast(toDeleteIds.length > 1 ? "Agendamentos removidos." : "Agendamento removido.", "success");
    } catch (error) {
      showToast("Erro ao remover agendamento.", "warning");
    } finally {
      setIsSaving(false);
      setDeletingSchedule(null);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedUser) {
      showToast("Selecione um capelão para exportar a escala.", "warning");
      return;
    }

    const chaplain = users.find(u => u.id === selectedUser);
    if (!chaplain) return;

    try {
      const html = generateMonthlyScheduleHTML(
        config,
        selectedMonth,
        selectedUnit,
        chaplain,
        filteredSchedules,
        proSectors
      );
      await generatePdf(html);
      showToast("Escala exportada com sucesso!", "success");
    } catch (error) {
      showToast("Erro ao gerar PDF da escala.", "warning");
    }
  };

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
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">3. Capelão (Filtro)</label>
          <div className="flex gap-2">
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              disabled={!isAdmin}
              className="flex-1 p-3 bg-slate-100 border-none rounded-xl font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
            >
              {isAdmin && <option value="">Todos os Capelães</option>}
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
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="px-4 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
              title="Exportar PDF da Escala"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>

      {showReplicateModal && (
        <ReplicateScaleModal
          selectedMonth={selectedMonth}
          onClose={() => setShowReplicateModal(false)}
          onConfirm={handleReplicateScale}
          isSaving={isSaving}
          formatMonthLabel={formatMonthLabel}
        />
      )}

      {/* Day Selector Navigation */}
      <div className="flex flex-wrap md:flex-nowrap bg-white p-1.5 rounded-[2rem] shadow-sm border border-slate-100 gap-1">
        {daysOfWeek.map(day => (
          <button
            key={day.id}
            onClick={() => setActiveDay(day.id)}
            className={`flex-1 py-3 px-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
              activeDay === day.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <span className="hidden md:inline">{day.label}</span>
            <span className="md:hidden">{day.short}</span>
          </button>
        ))}
      </div>

      {/* Daily View Grouped by Chaplain */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {visibleChaplains.map(chaplain => {
          const chaplainActivities = groupedSchedules[chaplain.id] || [];
          
          return (
            <div key={chaplain.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300">
              <div className="bg-slate-50 p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-tight text-slate-800">{chaplain.name}</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Escala Diária</p>
                </div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm ${chaplainActivities.length > 0 ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <span className="text-xs font-black">{chaplainActivities.length}</span>
                </div>
              </div>
              
              <div className="p-6 flex-1 space-y-6">
                {(isAdmin || chaplain.id === currentUser?.id) && (
                   <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleOpenAddModal(activeDay, 'blueprint')}
                        className="flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        <Plus size={12} /> Blueprint
                      </button>
                      <button 
                        onClick={() => handleOpenAddModal(activeDay, 'cult')}
                        className="flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[9px] uppercase hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        <Plus size={12} /> Setores
                      </button>
                      {activeDay === 6 && (
                        <>
                          <button 
                            onClick={() => handleOpenAddModal(activeDay, 'encontro')}
                            className="flex items-center justify-center gap-2 py-2 bg-amber-50 text-amber-600 rounded-xl font-black text-[9px] uppercase hover:bg-amber-600 hover:text-white transition-all"
                          >
                            <Plus size={12} /> Encontro
                          </button>
                          <button 
                            onClick={() => handleOpenAddModal(activeDay, 'visiteCantando')}
                            className="flex items-center justify-center gap-2 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase hover:bg-rose-600 hover:text-white transition-all"
                          >
                            <Plus size={12} /> Visite Cantando
                          </button>
                        </>
                      )}
                   </div>
                )}

                {chaplainActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 opacity-40">
                    <CalendarIcon size={32} className="text-slate-300 mb-2" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Nenhuma atividade agendada para hoje</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Groups by activity type for clarity */}
                    {['blueprint', 'cult', 'encontro', 'visiteCantando'].map(type => {
                      const typeActivities = chaplainActivities.filter(a => a.activityType === type);
                      if (typeActivities.length === 0) return null;

                      const typeColorClass = type === 'blueprint' ? 'text-indigo-600' : 
                                           type === 'cult' ? 'text-emerald-600' :
                                           type === 'encontro' ? 'text-amber-600' : 'text-rose-600';
                      
                      const typeBgClass = type === 'blueprint' ? 'bg-indigo-50/50' : 
                                          type === 'cult' ? 'bg-emerald-50/50' :
                                          type === 'encontro' ? 'bg-amber-50/50' : 'bg-rose-50/50';

                      return (
                        <div key={type} className="space-y-2">
                          <h4 className={`text-[9px] font-black uppercase flex items-center gap-2 ${typeColorClass}`}>
                            <div className="w-1 h-3 rounded-full bg-current" />
                            {type === 'blueprint' ? 'Blueprints' : type === 'cult' ? 'Setores' : type === 'encontro' ? 'Encontros' : 'Visite Cantando'}
                          </h4>
                          <div className="space-y-1.5">
                            {typeActivities.map(s => (
                              <div key={s.id} className={`flex items-center justify-between p-3 ${typeBgClass} rounded-2xl group/item relative overflow-hidden`}>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-black text-slate-800 uppercase truncate">
                                    {type === 'cult' 
                                      ? (sectors.find(sec => sec.id === s.location)?.name || 'Setor Removido')
                                      : (type === 'encontro' ? `Encontro HAB ${s.date ? `(${s.date.split('-')[2]})` : ''}` 
                                          : (type === 'visiteCantando' ? `Visite Cantando ${s.date ? `(${s.date.split('-')[2]})` : ''}` : s.location))
                                    }
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-tighter ${s.period === 'manha' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                      {s.period === 'manha' ? 'Manhã' : 'Tarde'}
                                    </span>
                                    {s.time && <span className="text-[8px] font-bold text-slate-500 bg-white/50 px-1.5 py-0.5 rounded-lg shadow-sm">{s.time}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {(isAdmin || chaplain.id === currentUser?.id) && (
                                    <button 
                                      onClick={() => setDeletingSchedule(s)} 
                                      className="w-7 h-7 bg-white/80 text-rose-500 rounded-lg flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {addingActivity && (

        <AddActivityModal
          addingActivity={addingActivity}
          selectedUser={selectedUser}
          selectedUnit={selectedUnit}
          selectedMonth={selectedMonth}
          globalSchedulesForMonth={globalSchedulesForMonth}
          sectors={sectors}
          chaplains={chaplains}
          daysOfWeek={daysOfWeek}
          isAdmin={isAdmin}
          onClose={() => setAddingActivity(null)}
          onConfirm={handleConfirmAddSchedule}
          isSaving={isSaving}
        />
      )}

      {deletingSchedule && (
        <DeleteScheduleModal
          deletingSchedule={deletingSchedule}
          hasMultiple={filteredSchedules.filter(s => 
            s.userId === deletingSchedule.userId && 
            s.activityType === deletingSchedule.activityType && 
            s.location === deletingSchedule.location
          ).length > 1}
          onClose={() => setDeletingSchedule(null)}
          onConfirm={confirmDeleteSchedule}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

export default ActivityScheduler;
