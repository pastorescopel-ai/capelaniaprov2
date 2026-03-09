
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Unit, DailyActivityReport, ActivitySchedule } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { BLUEPRINT_LOCATIONS } from '../../constants';
import { CheckCircle, Circle, Plus, Minus, Save, Calendar, MapPin, Users, HeartPulse } from 'lucide-react';

const ActivityChecklist: React.FC = () => {
  const { proSectors, activitySchedules, dailyActivityReports, saveRecord } = useApp();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Estado do Relatório
  const [report, setReport] = useState<Partial<DailyActivityReport>>({
    completedBlueprints: [],
    completedCults: [],
    completedEncontro: false,
    completedVisiteCantando: false,
    palliativeCount: 0,
    surgicalCount: 0,
    pediatricCount: 0,
    utiCount: 0,
    observations: ''
  });

  // Carregar relatório existente se houver
  useEffect(() => {
    const existing = dailyActivityReports.find(r => r.userId === currentUser?.id && r.date === selectedDate);
    if (existing) {
      setReport(existing);
    } else {
      setReport({
        completedBlueprints: [],
        completedCults: [],
        completedEncontro: false,
        completedVisiteCantando: false,
        palliativeCount: 0,
        surgicalCount: 0,
        pediatricCount: 0,
        utiCount: 0,
        observations: ''
      });
    }
  }, [selectedDate, dailyActivityReports, currentUser?.id]);

  const currentDayOfWeek = useMemo(() => new Date(selectedDate + 'T12:00:00').getDay(), [selectedDate]);
  const isSaturday = currentDayOfWeek === 6;
  const isSunday = currentDayOfWeek === 0;

  const currentMonth = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }, [selectedDate]);

  // Atividades agendadas para hoje
  const scheduledActivities = useMemo(() => 
    activitySchedules.filter(s => 
      s.userId === currentUser?.id && 
      s.month === currentMonth && 
      s.dayOfWeek === currentDayOfWeek
    ),
    [activitySchedules, currentUser?.id, currentMonth, currentDayOfWeek]
  );

  const handleToggleBlueprint = (loc: string) => {
    const current = report.completedBlueprints || [];
    if (current.includes(loc)) {
      setReport({ ...report, completedBlueprints: current.filter(l => l !== loc) });
    } else {
      setReport({ ...report, completedBlueprints: [...current, loc] });
    }
  };

  const handleToggleCult = (sectorId: string) => {
    const current = report.completedCults || [];
    if (current.includes(sectorId)) {
      setReport({ ...report, completedCults: current.filter(id => id !== sectorId) });
    } else {
      setReport({ ...report, completedCults: [...current, sectorId] });
    }
  };

  const handleToggleEncontro = () => {
    setReport({ ...report, completedEncontro: !report.completedEncontro });
  };

  const handleToggleVisiteCantando = () => {
    setReport({ ...report, completedVisiteCantando: !report.completedVisiteCantando });
  };

  const updateCount = (field: keyof DailyActivityReport, delta: number) => {
    const current = (report[field] as number) || 0;
    const newVal = Math.max(0, current + delta);
    setReport({ ...report, [field]: newVal });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data: Partial<DailyActivityReport> = {
        ...report,
        userId: currentUser?.id,
        date: selectedDate,
        unit: currentUser?.attendsHaba ? Unit.HABA : Unit.HAB,
        updatedAt: Date.now()
      };
      
      if (!data.id) data.createdAt = Date.now();

      await saveRecord('dailyActivityReports', data);
      showToast("Relatório salvo com sucesso!", "success");
    } catch (error) {
      showToast("Erro ao salvar relatório.", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  const progress = useMemo(() => {
    const totalScheduled = scheduledActivities.length;
    if (totalScheduled === 0) return 0;
    
    const completedScheduled = scheduledActivities.filter(s => {
      if (s.activityType === 'blueprint') return report.completedBlueprints?.includes(s.location);
      if (s.activityType === 'cult') return report.completedCults?.includes(s.location);
      if (s.activityType === 'encontro') return report.completedEncontro;
      if (s.activityType === 'visiteCantando') return report.completedVisiteCantando;
      return false;
    }).length;
    
    return Math.round((completedScheduled / totalScheduled) * 100);
  }, [scheduledActivities, report]);

  const userAttendsHaba = currentUser?.attendsHaba;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Cabeçalho de Data e Progresso */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Calendar size={24} />
          </div>
          <div>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="text-lg font-black text-slate-800 border-none bg-transparent focus:ring-0 p-0 uppercase"
            />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selecione o dia da missão</p>
          </div>
        </div>

        {!isSunday && (
          <div className="flex-1 max-w-xs w-full space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase">Progresso da Escala</span>
              <span className="text-xl font-black text-indigo-600">{progress}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-1000 shadow-sm"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {isSunday ? (
        <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center space-y-4">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
            <Calendar size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Dia de Descanso</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Não há atividades agendadas para domingos.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Blueprint & Cultos ou Encontro HAB */}
          <div className="space-y-8">
            {isSaturday ? (
              /* Saturday Section - Encontro HAB & Visite Cantando */
              <div className="space-y-8">
                <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-6">
                    <HeartPulse className="text-amber-500" size={18} />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Encontro HAB</h3>
                  </div>
                  
                  <button
                    onClick={handleToggleEncontro}
                    className={`w-full flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all ${
                      report.completedEncontro 
                        ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-lg shadow-amber-900/10 scale-[1.02]' 
                        : 'bg-white border-slate-100 text-slate-300 hover:border-amber-200'
                    }`}
                  >
                    <div className="text-left">
                      <span className="text-sm font-black uppercase block">Encontro HAB</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold uppercase opacity-60">Atividade Especial de Sábado</span>
                        {scheduledActivities.find(s => s.activityType === 'encontro')?.time && (
                          <span className="text-[10px] font-bold bg-amber-200/50 text-amber-800 px-2 py-0.5 rounded-full">
                            {scheduledActivities.find(s => s.activityType === 'encontro')?.time}
                          </span>
                        )}
                      </div>
                    </div>
                    {report.completedEncontro ? <CheckCircle size={24} /> : <Circle size={24} />}
                  </button>
                </section>

                <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-6">
                    <HeartPulse className="text-rose-500" size={18} />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Visite Cantando</h3>
                  </div>
                  
                  <button
                    onClick={handleToggleVisiteCantando}
                    className={`w-full flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all ${
                      report.completedVisiteCantando 
                        ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-lg shadow-rose-900/10 scale-[1.02]' 
                        : 'bg-white border-slate-100 text-slate-300 hover:border-rose-200'
                    }`}
                  >
                    <div className="text-left">
                      <span className="text-sm font-black uppercase block">Visite Cantando</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold uppercase opacity-60">Atividade Especial de Sábado</span>
                        {scheduledActivities.find(s => s.activityType === 'visiteCantando')?.time && (
                          <span className="text-[10px] font-bold bg-rose-200/50 text-rose-800 px-2 py-0.5 rounded-full">
                            {scheduledActivities.find(s => s.activityType === 'visiteCantando')?.time}
                          </span>
                        )}
                      </div>
                    </div>
                    {report.completedVisiteCantando ? <CheckCircle size={24} /> : <Circle size={24} />}
                  </button>
                </section>
              </div>
            ) : (
              <>
                {/* Blueprint */}
                <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-6">
                    <MapPin className="text-indigo-500" size={18} />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Blueprint</h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {BLUEPRINT_LOCATIONS.map(loc => {
                      const schedule = scheduledActivities.find(s => s.activityType === 'blueprint' && s.location === loc);
                      const isScheduled = !!schedule;
                      const isCompleted = report.completedBlueprints?.includes(loc);
                      
                      return (
                        <button
                          key={loc}
                          onClick={() => handleToggleBlueprint(loc)}
                          className={`flex flex-col items-start px-4 py-2 rounded-xl border-2 transition-all ${
                            isCompleted 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105' 
                              : isScheduled
                                ? 'bg-white border-indigo-200 text-indigo-400 hover:border-indigo-400'
                                : 'bg-white border-slate-100 text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase">{loc}</span>
                            {isCompleted && <span>✅</span>}
                          </div>
                          {schedule?.time && (
                            <span className={`text-[8px] font-bold mt-1 ${isCompleted ? 'text-indigo-200' : 'text-indigo-400'}`}>
                              {schedule.time}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Cultos */}
                <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-6">
                    <Users className="text-emerald-500" size={18} />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Setores</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {proSectors.filter(s => s.unit === (userAttendsHaba ? Unit.HABA : Unit.HAB) && s.active !== false).map(sec => {
                      const schedule = scheduledActivities.find(s => s.activityType === 'cult' && s.location === sec.id);
                      const isScheduled = !!schedule;
                      const isCompleted = report.completedCults?.includes(sec.id);
                      
                      return (
                        <button
                          key={sec.id}
                          onClick={() => handleToggleCult(sec.id)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            isCompleted 
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-900' 
                              : isScheduled
                                ? 'bg-white border-emerald-100 text-emerald-400 hover:border-emerald-300'
                                : 'bg-white border-slate-50 text-slate-300 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] font-black uppercase">{sec.name}</span>
                            {schedule?.time && (
                              <span className={`text-[8px] font-bold mt-1 ${isCompleted ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                {schedule.time}
                              </span>
                            )}
                          </div>
                          {isCompleted ? <CheckCircle size={16} /> : <Circle size={16} />}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </div>

          {/* Visitas & Observações */}
          <div className="space-y-8">
            {/* Visitas */}
            <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-6">
                <HeartPulse className="text-rose-500" size={18} />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Visitas aos Pacientes</h3>
              </div>
              
              <div className="space-y-4">
                {[
                  { label: 'Paliativos', field: 'palliativeCount' },
                  { label: 'Cirúrgicos', field: 'surgicalCount' },
                  { label: 'Pediátrico', field: 'pediatricCount' },
                  { label: 'UTI', field: 'utiCount' },
                ].map(item => (
                  <div key={item.field} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-600">{item.label}</span>
                    <div className="flex items-center gap-4">
                      <button onClick={() => updateCount(item.field as any, -1)} className="w-8 h-8 bg-white text-slate-400 rounded-lg flex items-center justify-center shadow-sm hover:text-rose-500 transition-all"><Minus size={16} /></button>
                      <span className="text-lg font-black text-slate-800 min-w-[30px] text-center">{report[item.field as keyof DailyActivityReport] || 0}</span>
                      <button onClick={() => updateCount(item.field as any, 1)} className="w-8 h-8 bg-white text-slate-400 rounded-lg flex items-center justify-center shadow-sm hover:text-emerald-500 transition-all"><Plus size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Observações */}
            <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Observações do Dia</h3>
              <textarea
                value={report.observations}
                onChange={e => setReport({ ...report, observations: e.target.value })}
                placeholder="Algo relevante aconteceu hoje?"
                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[120px] resize-none"
              />
            </section>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-900/20 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <Save size={20} />}
              <span>Salvar Relatório do Dia</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityChecklist;
