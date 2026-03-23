
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthProvider';
import { Unit, UserRole, ActivitySchedule } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
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

  const chaplains = useMemo(() => {
    const all = users.filter(u => u.role === UserRole.CHAPLAIN || u.role === UserRole.INTERN || u.role === UserRole.ADMIN);
    if (isAdmin) return all;
    return all.filter(u => u.id === currentUser?.id);
  }, [users, isAdmin, currentUser?.id]);

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

  const filteredSchedules = useMemo(() => 
    activitySchedules.filter(s => 
      s.unit === selectedUnit && 
      s.month === selectedMonth && 
      (!selectedUser || s.userId === selectedUser)
    ),
    [activitySchedules, selectedUnit, selectedMonth, selectedUser]
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
                      {filteredSchedules.filter(s => Number(s.dayOfWeek) === day.id && s.activityType === 'blueprint').map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-indigo-50/50 rounded-lg group">
                          <div className="min-w-0">
                            <p className="text-[8px] font-black text-indigo-900 uppercase truncate">{s.location}</p>
                            <div className="flex items-center gap-1">
                              <span className={`text-[7px] font-black px-1 rounded uppercase ${s.period === 'manha' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                {s.period === 'manha' ? 'Manhã' : 'Tarde'}
                              </span>
                              {s.time && <span className="text-[7px] font-bold text-indigo-500 bg-indigo-100 px-1 rounded">{s.time}</span>}
                              {!selectedUser && (
                                <p className="text-[7px] font-bold text-indigo-400 uppercase truncate">
                                  {chaplains.find(c => c.id === s.userId)?.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => setDeletingSchedule(s)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
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
                      {filteredSchedules.filter(s => Number(s.dayOfWeek) === day.id && s.activityType === 'cult').map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg group">
                          <div className="min-w-0">
                            <p className="text-[8px] font-black text-emerald-900 uppercase truncate">
                              {sectors.find(sec => sec.id === s.location)?.name || 'Setor Removido'}
                            </p>
                            <div className="flex items-center gap-1">
                              <span className={`text-[7px] font-black px-1 rounded uppercase ${s.period === 'manha' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {s.period === 'manha' ? 'Manhã' : 'Tarde'}
                              </span>
                              {s.time && <span className="text-[7px] font-bold text-emerald-500 bg-emerald-100 px-1 rounded">{s.time}</span>}
                              {!selectedUser && (
                                <p className="text-[7px] font-bold text-emerald-400 uppercase truncate">
                                  {chaplains.find(c => c.id === s.userId)?.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => setDeletingSchedule(s)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
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
                      {filteredSchedules.filter(s => Number(s.dayOfWeek) === day.id && s.activityType === 'encontro').map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-amber-50/50 rounded-lg group">
                          <div className="min-w-0">
                            <p className="text-[8px] font-black text-amber-900 uppercase truncate">
                              Encontro HAB {s.date ? `(${s.date.split('-')[2]})` : ''}
                            </p>
                            <div className="flex items-center gap-1">
                              <span className={`text-[7px] font-black px-1 rounded uppercase ${s.period === 'manha' ? 'bg-amber-100 text-amber-600' : 'bg-amber-100 text-amber-600'}`}>
                                {s.period === 'manha' ? 'Manhã' : 'Tarde'}
                              </span>
                              {s.time && <span className="text-[7px] font-bold text-amber-500 bg-amber-100 px-1 rounded">{s.time}</span>}
                              {!selectedUser && (
                                <p className="text-[7px] font-bold text-amber-400 uppercase truncate">
                                  {chaplains.find(c => c.id === s.userId)?.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => setDeletingSchedule(s)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
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
                      {filteredSchedules.filter(s => Number(s.dayOfWeek) === day.id && s.activityType === 'visiteCantando').map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-rose-50/50 rounded-lg group">
                          <div className="min-w-0">
                            <p className="text-[8px] font-black text-rose-900 uppercase truncate">
                              Visite Cantando {s.date ? `(${s.date.split('-')[2]})` : ''}
                            </p>
                            {s.responsibleName && <p className="text-[7px] font-bold text-rose-700 truncate">{s.responsibleName}</p>}
                            {s.responsibleWhatsApp && <p className="text-[7px] font-bold text-rose-600 truncate">{s.responsibleWhatsApp}</p>}
                            <div className="flex items-center gap-1">
                              <span className={`text-[7px] font-black px-1 rounded uppercase ${s.period === 'manha' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                                {s.period === 'manha' ? 'Manhã' : 'Tarde'}
                              </span>
                              {s.time && <span className="text-[7px] font-bold text-rose-500 bg-rose-100 px-1 rounded">{s.time}</span>}
                              {!selectedUser && (
                                <p className="text-[7px] font-bold text-rose-400 uppercase truncate">
                                  {chaplains.find(c => c.id === s.userId)?.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <button onClick={() => setDeletingSchedule(s)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
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
