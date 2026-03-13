import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { Unit, DailyActivityReport, UserRole } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { CheckCircle, Circle, Plus, Minus, Save, MapPin, Users, HeartPulse, Calendar, Download } from 'lucide-react';
import { generateDailyChecklistHTML } from '../../utils/activityTemplates';
import { useDocumentGenerator } from '../../hooks/useDocumentGenerator';

const ActivityChecklist: React.FC = () => {
  const { users, proSectors, activitySchedules, dailyActivityReports, saveRecord, config } = useApp();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { generatePdf, isGenerating: isGeneratingPdf } = useDocumentGenerator();
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });
  const [selectedUser, setSelectedUser] = useState<string>(isAdmin ? (currentUser?.id || '') : (currentUser?.id || ''));
  const [isSaving, setIsSaving] = useState(false);

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

  const chaplains = useMemo(() => {
    const all = users.filter(u => u.role === UserRole.CHAPLAIN || u.role === UserRole.INTERN || u.role === UserRole.ADMIN);
    if (isAdmin) return all;
    return all.filter(u => u.id === currentUser?.id);
  }, [users, isAdmin, currentUser?.id]);

  useEffect(() => {
    if (!selectedUser) return;
    const existing = dailyActivityReports.find(r => r.userId === selectedUser && r.date === selectedDate);
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
  }, [selectedDate, selectedUser, dailyActivityReports]);

  const currentDayOfWeek = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00').getDay();
    // Convert 0 (Sunday) to 7, and 1-6 to 1-6. 
    // Wait, the scheduler uses 1-6. If Sunday is 0, what should it be?
    // Let's assume Sunday is not used or map it to 7.
    return d === 0 ? 7 : d;
  }, [selectedDate]);
  
  const currentMonth = useMemo(() => {
    return selectedDate.substring(0, 7) + '-01';
  }, [selectedDate]);

  const scheduledActivities = useMemo(() => 
    activitySchedules.filter(s => 
      s.userId === selectedUser && 
      s.month === currentMonth && 
      s.dayOfWeek === currentDayOfWeek
    ),
    [activitySchedules, selectedUser, currentMonth, currentDayOfWeek]
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

  const handleCountChange = (field: keyof DailyActivityReport, value: string) => {
    if (value === '') {
      setReport({ ...report, [field]: 0 });
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setReport({ ...report, [field]: num });
    }
  };

  const handleSave = async () => {
    if (!selectedUser) {
      showToast("Selecione um usuário.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      const userObj = users.find(u => u.id === selectedUser);
      const data: Partial<DailyActivityReport> = {
        ...report,
        userId: selectedUser,
        date: selectedDate,
        unit: userObj?.attendsHaba ? Unit.HABA : Unit.HAB,
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

  const handleExportPDF = async () => {
    if (!selectedUser) {
      showToast("Selecione um capelão para exportar o checklist.", "warning");
      return;
    }

    const chaplain = users.find(u => u.id === selectedUser);
    if (!chaplain) return;

    try {
      const html = generateDailyChecklistHTML(
        config,
        selectedDate,
        chaplain,
        scheduledActivities,
        proSectors
      );
      await generatePdf(html);
      showToast("Checklist exportado com sucesso!", "success");
    } catch (error) {
      showToast("Erro ao gerar PDF do checklist.", "warning");
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

  const blueprints = scheduledActivities.filter(s => s.activityType === 'blueprint');
  const cults = scheduledActivities.filter(s => s.activityType === 'cult');
  const encontros = scheduledActivities.filter(s => s.activityType === 'encontro');
  const visiteCantandos = scheduledActivities.filter(s => s.activityType === 'visiteCantando');

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Data da Atividade</label>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <div className="p-3 text-slate-400"><Calendar size={16} /></div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="flex-1 p-2 bg-transparent border-none text-xs font-bold focus:ring-0 outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Capelão</label>
          <div className="flex gap-2">
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              disabled={!isAdmin}
              className="flex-1 p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
            >
              {chaplains.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="px-4 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
              title="Exportar PDF do Checklist"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-200">
              <i className="fas fa-tasks"></i>
            </div>
            <div>
              <h4 className="font-black text-indigo-900 text-base uppercase tracking-tight">Lançar Atividades</h4>
              <p className="text-indigo-700 font-bold text-[10px] uppercase tracking-widest">
                Checklist Diário
              </p>
            </div>
          </div>
          
          <div className="flex-1 max-w-xs w-full space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[9px] font-black text-indigo-400 uppercase">Progresso</span>
              <span className="text-sm font-black text-indigo-600">{progress}%</span>
            </div>
            <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {scheduledActivities.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-3xl border border-slate-100">
            <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Nenhuma atividade agendada</h3>
            <p className="text-xs text-slate-500 mt-1">Não há atividades na escala para esta data.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Atividades Agendadas */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">Atividades Agendadas</h3>
              
              {blueprints.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="text-indigo-500" size={16} />
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Blueprint</h4>
                  </div>
                  {blueprints.map(s => {
                    const isCompleted = report.completedBlueprints?.includes(s.location);
                    return (
                      <button
                        key={s.location}
                        onClick={() => handleToggleBlueprint(s.location)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                          isCompleted 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900' 
                            : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] font-black uppercase">{s.location}</span>
                          {s.time && <span className={`text-[8px] font-bold mt-1 ${isCompleted ? 'text-indigo-600' : 'text-slate-400'}`}>{s.time}</span>}
                        </div>
                        {isCompleted ? <CheckCircle size={16} /> : <Circle size={16} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {cults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="text-emerald-500" size={16} />
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Setores</h4>
                  </div>
                  {cults.map(s => {
                    const isCompleted = report.completedCults?.includes(s.location);
                    const sectorName = proSectors.find(sec => sec.id === s.location)?.name || 'Setor Removido';
                    return (
                      <button
                        key={s.location}
                        onClick={() => handleToggleCult(s.location)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                          isCompleted 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900' 
                            : 'bg-white border-slate-100 text-slate-600 hover:border-emerald-200'
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] font-black uppercase">{sectorName}</span>
                          {s.time && <span className={`text-[8px] font-bold mt-1 ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>{s.time}</span>}
                        </div>
                        {isCompleted ? <CheckCircle size={16} /> : <Circle size={16} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {encontros.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <HeartPulse className="text-amber-500" size={16} />
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Encontro HAB</h4>
                  </div>
                  <button
                    onClick={handleToggleEncontro}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                      report.completedEncontro 
                        ? 'bg-amber-50 border-amber-500 text-amber-900' 
                        : 'bg-white border-slate-100 text-slate-600 hover:border-amber-200'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase">Encontro HAB</span>
                    {report.completedEncontro ? <CheckCircle size={16} /> : <Circle size={16} />}
                  </button>
                </div>
              )}

              {visiteCantandos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <HeartPulse className="text-rose-500" size={16} />
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Visite Cantando</h4>
                  </div>
                  <button
                    onClick={handleToggleVisiteCantando}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                      report.completedVisiteCantando 
                        ? 'bg-rose-50 border-rose-500 text-rose-900' 
                        : 'bg-white border-slate-100 text-slate-600 hover:border-rose-200'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase">Visite Cantando</span>
                    {report.completedVisiteCantando ? <CheckCircle size={16} /> : <Circle size={16} />}
                  </button>
                </div>
              )}
            </div>

            {/* Visitas e Observações */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">Visitas Realizadas</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Paliativos</span>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <input 
                      type="number" 
                      min="0"
                      value={report.palliativeCount || 0} 
                      onChange={(e) => handleCountChange('palliativeCount', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full py-2 text-center font-black text-slate-700 outline-none bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 no-spinners"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cirúrgicos</span>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <input 
                      type="number" 
                      min="0"
                      value={report.surgicalCount || 0} 
                      onChange={(e) => handleCountChange('surgicalCount', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full py-2 text-center font-black text-slate-700 outline-none bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 no-spinners"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pediátrico</span>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <input 
                      type="number" 
                      min="0"
                      value={report.pediatricCount || 0} 
                      onChange={(e) => handleCountChange('pediatricCount', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full py-2 text-center font-black text-slate-700 outline-none bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 no-spinners"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">UTI</span>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <input 
                      type="number" 
                      min="0"
                      value={report.utiCount || 0} 
                      onChange={(e) => handleCountChange('utiCount', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full py-2 text-center font-black text-slate-700 outline-none bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 no-spinners"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Observações</label>
                <textarea
                  value={report.observations || ''}
                  onChange={e => setReport({ ...report, observations: e.target.value })}
                  placeholder="Anotações sobre as atividades de hoje..."
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none h-24"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? 'Salvando...' : 'Salvar Relatório Diário'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityChecklist;
