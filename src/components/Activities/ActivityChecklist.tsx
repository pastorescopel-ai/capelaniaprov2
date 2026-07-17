
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { Unit, DailyActivityReport, UserRole } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { CheckCircle, Circle, MapPin, Users, HeartPulse, Calendar, Download, Search, NotebookPen } from 'lucide-react';
import { generateDailyChecklistHTML } from '../../utils/activityTemplates';
import { useDocumentGenerator } from '../../hooks/useDocumentGenerator';

interface ActivityChecklistProps {
  selectedUser: string;
  setSelectedUser: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const emptyReport: Partial<DailyActivityReport> = {
  completedBlueprints: [],
  completedCults: [],
  completedEncontro: false,
  completedVisiteCantando: false,
  observations: ''
};

const ACCENT_CLASSES: Record<string, string> = {
  indigo: 'border-indigo-500 bg-indigo-50 text-indigo-900',
  emerald: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  amber: 'border-amber-500 bg-amber-50 text-amber-900',
  rose: 'border-rose-500 bg-rose-50 text-rose-900'
};

const ChecklistItem: React.FC<{
  label: string;
  subLabel?: string;
  period?: 'manha' | 'tarde';
  isCompleted: boolean;
  onClick: () => void;
  accent: 'indigo' | 'emerald' | 'amber' | 'rose';
}> = ({ label, subLabel, period, isCompleted, onClick, accent }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
      isCompleted ? ACCENT_CLASSES[accent] : 'bg-white border-slate-100 text-slate-700 hover:border-slate-300'
    }`}
  >
    {isCompleted ? <CheckCircle size={20} className="flex-shrink-0" /> : <Circle size={20} className="flex-shrink-0 text-slate-300" />}
    <div className="flex-1 text-left">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-black uppercase ${isCompleted ? 'line-through opacity-70' : 'text-slate-700'}`}>{label}</span>
        {period && (
          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${period === 'manha' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
            {period === 'manha' ? 'Manhã' : 'Tarde'}
          </span>
        )}
      </div>
      {subLabel && <p className="text-[9px] font-bold text-slate-400 mt-0.5">{subLabel}</p>}
    </div>
  </button>
);

const ActivityChecklist: React.FC<ActivityChecklistProps> = ({
  selectedUser,
  setSelectedUser,
  selectedDate,
  setSelectedDate
}) => {
  const { users, proSectors, activitySchedules, dailyActivityReports, saveRecord, config } = useApp();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { generatePdf, isGenerating: isGeneratingPdf } = useDocumentGenerator();

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [report, setReport] = useState<Partial<DailyActivityReport>>(emptyReport);
  const [showObservations, setShowObservations] = useState(false);

  const chaplains = useMemo(() => {
    const all = users.filter(u => u.role === UserRole.CHAPLAIN || u.role === UserRole.INTERN || u.role === UserRole.ADMIN);
    if (isAdmin) return all;
    return all.filter(u => u.id === currentUser?.id);
  }, [users, isAdmin, currentUser?.id]);

  useEffect(() => {
    if (!selectedUser) return;
    const existing = dailyActivityReports.find(r => r.userId === selectedUser && r.date === selectedDate);
    const timer = setTimeout(() => {
      setReport(existing || emptyReport);
      setShowObservations(!!existing?.observations);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedDate, selectedUser, dailyActivityReports]);

  const currentDayOfWeek = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00').getDay();
    return d === 0 ? 7 : d;
  }, [selectedDate]);

  const currentMonth = useMemo(() => {
    return selectedDate.substring(0, 7) + '-01';
  }, [selectedDate]);

  const scheduledActivities = useMemo(() =>
    activitySchedules.filter(s =>
      s.userId === selectedUser &&
      s.month === currentMonth &&
      ((s.date && s.date.substring(0, 10) === selectedDate) || (!s.date && s.dayOfWeek === currentDayOfWeek))
    ),
    [activitySchedules, selectedUser, currentMonth, currentDayOfWeek, selectedDate]
  );

  // Persiste imediatamente a cada toque — não existe mais um botão "Salvar" separado,
  // já que o registro diário é só uma lista de itens marcados/desmarcados.
  const persist = async (updated: Partial<DailyActivityReport>) => {
    if (!selectedUser) return;
    const userObj = users.find(u => u.id === selectedUser);
    const nowISO = new Date().toISOString();
    const data: Partial<DailyActivityReport> = {
      ...updated,
      userId: selectedUser,
      date: selectedDate,
      unit: userObj?.attendsHaba ? Unit.HABA : Unit.HAB,
      updatedAt: nowISO
    };
    if (!data.id) data.createdAt = nowISO;
    await saveRecord('dailyActivityReports', data);
  };

  // Usa a forma funcional do setState + persiste a partir do MESMO valor computado,
  // para que dois toques em sequência rápida (antes do primeiro re-renderizar) nunca
  // percam a marcação um do outro por lerem um `report` desatualizado.
  const handleToggleBlueprint = (loc: string, period: 'manha' | 'tarde' = 'tarde') => {
    setReport(prev => {
      const current = prev.completedBlueprints || [];
      const locWithPeriod = `${loc}:${period}`;
      const hasNewFormat = current.includes(locWithPeriod);
      const hasOldFormat = period === 'tarde' && current.includes(loc);

      const updated = {
        ...prev,
        completedBlueprints: (hasNewFormat || hasOldFormat)
          ? current.filter(l => l !== locWithPeriod && l !== loc)
          : [...current, locWithPeriod]
      };
      persist(updated);
      return updated;
    });
  };

  const handleToggleCult = (sectorId: string, period: 'manha' | 'tarde' = 'tarde') => {
    setReport(prev => {
      const current = prev.completedCults || [];
      const locWithPeriod = `${sectorId}:${period}`;
      const hasNewFormat = current.includes(locWithPeriod);
      const hasOldFormat = period === 'tarde' && current.includes(sectorId);

      const updated = {
        ...prev,
        completedCults: (hasNewFormat || hasOldFormat)
          ? current.filter(id => id !== locWithPeriod && id !== sectorId)
          : [...current, locWithPeriod]
      };
      persist(updated);
      return updated;
    });
  };

  const handleToggleEncontro = () => {
    setReport(prev => {
      const updated = { ...prev, completedEncontro: !prev.completedEncontro };
      persist(updated);
      return updated;
    });
  };

  const handleToggleVisiteCantando = () => {
    setReport(prev => {
      const updated = { ...prev, completedVisiteCantando: !prev.completedVisiteCantando };
      persist(updated);
      return updated;
    });
  };

  const observationsTimeout = useRef<ReturnType<typeof setTimeout>>();
  const handleObservationsChange = (value: string) => {
    setReport(prev => {
      const updated = { ...prev, observations: value };
      if (observationsTimeout.current) clearTimeout(observationsTimeout.current);
      observationsTimeout.current = setTimeout(() => persist(updated), 800);
      return updated;
    });
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

  const isItemDone = (s: typeof scheduledActivities[number]) => {
    const period = s.period || 'tarde';
    const locationWithPeriod = `${s.location}:${period}`;
    if (s.activityType === 'blueprint') {
      return report.completedBlueprints?.includes(locationWithPeriod) ||
             (period === 'tarde' && report.completedBlueprints?.includes(s.location));
    }
    if (s.activityType === 'cult') {
      return report.completedCults?.includes(locationWithPeriod) ||
             (period === 'tarde' && report.completedCults?.includes(s.location));
    }
    if (s.activityType === 'encontro') return !!report.completedEncontro;
    if (s.activityType === 'visiteCantando') return !!report.completedVisiteCantando;
    return false;
  };

  const progress = useMemo(() => {
    const totalScheduled = scheduledActivities.length;
    if (totalScheduled === 0) return 0;
    const completedItems = scheduledActivities.filter(isItemDone).length;
    return Math.round((completedItems / totalScheduled) * 100);
  }, [scheduledActivities, report, isItemDone]);

  const completedCount = scheduledActivities.filter(isItemDone).length;

  const [searchTerm, setSearchTerm] = useState('');

  const blueprints = useMemo(() => {
    const raw = scheduledActivities.filter(s => s.activityType === 'blueprint');
    if (!searchTerm) return raw;
    return raw.filter(s => s.location.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [scheduledActivities, searchTerm]);

  const cults = useMemo(() => {
    const raw = scheduledActivities.filter(s => s.activityType === 'cult');
    if (!searchTerm) return raw;
    return raw.filter(s => {
      const sectorObj = proSectors.find(sec => sec.id === s.location);
      const sectorName = sectorObj?.name || '';
      return sectorName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [scheduledActivities, proSectors, searchTerm]);

  const encontros = scheduledActivities.filter(s => s.activityType === 'encontro');
  const visiteCantandos = scheduledActivities.filter(s => s.activityType === 'visiteCantando');

  const matchesFilter = blueprints.length > 0 || cults.length > 0 || encontros.length > 0 || visiteCantandos.length > 0;

  const formattedDate = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  }, [selectedDate]);

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
              className="flex-1 p-2 bg-transparent border-none font-bold focus:ring-0 outline-none"
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
              className="flex-1 p-3 bg-slate-100 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
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

      <div className="bg-indigo-600 p-6 rounded-[2.5rem] shadow-lg shadow-indigo-900/10 text-white space-y-4">
        <p className="text-[9px] font-black uppercase tracking-widest opacity-70 capitalize">{formattedDate}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black">{completedCount}<span className="text-lg opacity-70">/{scheduledActivities.length}</span></span>
          <span className="text-[11px] font-bold opacity-85">atividades feitas hoje</span>
        </div>
        <div className="h-1.5 bg-white/25 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {scheduledActivities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-[2.5rem] border border-slate-100">
          <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Nenhuma atividade agendada</h3>
          <p className="text-xs text-slate-500 mt-1">Não há atividades na escala para esta data.</p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Toque para marcar como feito</h3>
            <div className="relative w-full sm:max-w-[200px]">
              <input
                type="text"
                placeholder="Buscar setor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full py-1.5 pl-8 pr-3 text-[11px] font-bold bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl outline-none transition-all placeholder:text-slate-400"
              />
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="space-y-3">
            {blueprints.map(s => {
              const period = s.period || 'tarde';
              return (
                <ChecklistItem
                  key={`bp-${s.location}-${period}`}
                  label={`Blueprint — ${s.location}`}
                  subLabel={s.time}
                  period={period}
                  isCompleted={isItemDone(s)}
                  onClick={() => handleToggleBlueprint(s.location, period)}
                  accent="indigo"
                />
              );
            })}

            {cults.map(s => {
              const period = s.period || 'tarde';
              const sectorObj = proSectors.find(sec => sec.id === s.location);
              const sectorName = sectorObj ? `${sectorObj.name} [${sectorObj.unit}]` : 'Setor Removido';
              return (
                <ChecklistItem
                  key={`ct-${s.location}-${period}`}
                  label={`Setor — ${sectorName}`}
                  subLabel={s.time}
                  period={period}
                  isCompleted={isItemDone(s)}
                  onClick={() => handleToggleCult(s.location, period)}
                  accent="emerald"
                />
              );
            })}

            {encontros.length > 0 && (
              <ChecklistItem
                label="Encontro HAB"
                isCompleted={!!report.completedEncontro}
                onClick={handleToggleEncontro}
                accent="amber"
              />
            )}

            {visiteCantandos.map((s, idx) => {
              const period = s.period || 'tarde';
              const subParts = [s.time, s.responsibleName].filter(Boolean);
              return (
                <ChecklistItem
                  key={s.id || idx}
                  label="Visite Cantando"
                  subLabel={subParts.join(' · ')}
                  period={period}
                  isCompleted={!!report.completedVisiteCantando}
                  onClick={handleToggleVisiteCantando}
                  accent="rose"
                />
              );
            })}

            {!matchesFilter && (
              <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-bold">Nenhuma atividade correspondente.</p>
              </div>
            )}
          </div>

          {showObservations ? (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Observações do dia</label>
              <textarea
                value={report.observations || ''}
                onChange={e => handleObservationsChange(e.target.value)}
                placeholder="Anotações sobre as atividades de hoje..."
                autoFocus
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none h-24"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowObservations(true)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all"
            >
              <NotebookPen size={16} />
              <span className="text-[11px] font-bold">Adicionar observações do dia (opcional)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ActivityChecklist;
