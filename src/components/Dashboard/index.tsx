
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Config, Unit } from '../../types';
import { useApp } from '../../hooks/useApp';
import { useDashboardStats, GlobalImpactComparisonMode } from '../../hooks/useDashboardStats';
import { ensureISODate } from '../../utils/formatters';
import Mural from './Mural';
import StatCards from './StatCards';
import ImpactCharts from './ImpactCharts';
import VisitGoalWidget from './VisitGoalWidget';
import VisitProgressStrip from './VisitProgressStrip';
import VisitRequestsWidget from './VisitRequestsWidget';
import DashboardActivityHistory from '../PGManagement/DashboardActivityHistory';

interface DashboardProps {
  unit: Unit;
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  currentUser: User;
  config: Config;
  onGoToTab: (tab: string, subTab?: any) => void;
  onRegisterMission: (visit: any) => void;
  onGoToReturnHistory: (visit?: any) => void;
  onUpdateConfig: (newConfig: Config) => any;
  onUpdateUser: (updatedUser: User) => any;
  // MainContent.tsx mantém as abas já visitadas montadas (só alterna display:none/block pra
  // trocar de aba, nunca desmonta) -- sem saber quando a aba realmente está visível, as
  // animações de entrada só tocavam na primeira vez que o Dashboard aparecia na sessão inteira.
  // Usado pra reanimar os trechos que não dependem de rolagem (useInView cuida sozinho dos que
  // dependem).
  isVisible?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  unit, studies, classes, groups, visits, currentUser, config, onGoToTab, onRegisterMission, onGoToReturnHistory, onUpdateConfig, isVisible = true
}) => {
  const { visitRequests, users, isInitialized, proMonthlyStats } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));
  const [comparisonMode, setComparisonMode] = useState<GlobalImpactComparisonMode>('previousMonth');
  const [selectedAverageMonths, setSelectedAverageMonths] = useState<string[]>([]);
  // Faixa fina de "Visitas a Colaboradores" (Opção A aprovada) -- fica fechada por padrão;
  // tocar nela expande os detalhes completos (meta HABA, histórico) que antes ficavam sempre
  // visíveis num card à parte.
  const [showVisitDetail, setShowVisitDetail] = useState(false);

  // Últimos 12 meses (fechados), do mais recente pro mais antigo, para o seletor de média.
  const availableMonths = React.useMemo(() => {
    const months: string[] = [];
    const cursor = new Date();
    for (let i = 1; i <= 12; i++) {
      cursor.setDate(1); // evita pular mês em meses com menos dias
      const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }, []);

  const toggleAverageMonth = (month: string) => {
    setSelectedAverageMonths(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    );
  };

  const {
    pendingReturns,
    todaysReturns,
    monthlyStudies,
    monthlyClasses,
    monthlyGroups,
    monthlyVisits,
    uniqueStudentsMonth,
    totalActionsMonth,
    globalImpact,
    monthName,
    goals,
    accumulated
  } = useDashboardStats(studies, classes, groups, visits, currentUser, proMonthlyStats, selectedMonth, comparisonMode, selectedAverageMonths);

  // Contagens PESSOAIS do mês anterior (Estudos/Classes) -- só pra alimentar a mensagem de
  // "alvo individual" do mural dinâmico, que compara este mês com o passado, não com uma meta
  // fixa. Sempre o mês civil anterior de verdade, não o filtro de mês do Dashboard.
  const prevMonthPersonal = React.useMemo(() => {
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevISO = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const studiesCount = (studies || []).filter(s => s.userId === currentUser?.id && ensureISODate(s.date)?.startsWith(prevISO)).length;
    const classesCount = (classes || []).filter(c => c.userId === currentUser?.id && ensureISODate(c.date)?.startsWith(prevISO)).length;
    return { studiesCount, classesCount };
  }, [studies, classes, currentUser?.id]);

  if (!isInitialized) {
    return <div className="p-8 text-center text-slate-500 font-bold">Carregando dashboard...</div>;
  }

  if (!currentUser) return null;

  const stats = [
    { label: `Alunos Ativos (${monthName})`, value: uniqueStudentsMonth.size, icon: <i className="fas fa-user-graduate"></i>, color: 'bg-blue-500' },
    { label: `Meus PGs (${monthName})`, value: monthlyGroups.length, icon: <i className="fas fa-house-user"></i>, color: 'bg-emerald-500' },
    { label: `Minhas Ações (${monthName})`, value: totalActionsMonth, icon: <i className="fas fa-bolt"></i>, color: 'bg-amber-500' },
    { label: `Minhas Visitas (${monthName})`, value: monthlyVisits.length, icon: <i className="fas fa-hands-helping"></i>, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Header Row: Mural */}
      <div className="w-full">
        <Mural
          config={config}
          userRole={currentUser.role}
          onUpdateConfig={onUpdateConfig}
          visits={visits}
          pendingReturnsCount={pendingReturns.length}
          currentUserFirstName={currentUser.name?.split(' ')[0] || ''}
          monthlyStudiesCount={monthlyStudies.length}
          monthlyClassesCount={monthlyClasses.length}
          monthlyGroupsCount={monthlyGroups.length}
          prevMonthStudiesCount={prevMonthPersonal.studiesCount}
          prevMonthClassesCount={prevMonthPersonal.classesCount}
          visitGoal={accumulated}
          isVisible={isVisible}
        />
      </div>

      {/* Visitas a Colaboradores -- faixa fina entre o mural e a escala de visitas (Opção A);
          toque/clique expande os detalhes completos (meta HABA, histórico total). */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }} transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}>
        <VisitProgressStrip accumulated={accumulated} isExpanded={showVisitDetail} onToggle={() => setShowVisitDetail(v => !v)} />
        <AnimatePresence initial={false}>
          {showVisitDetail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div
                className="pt-4 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onGoToTab('staffVisit')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToTab('staffVisit'); } }}
                title="Ir para Registrar Visita"
              >
                <VisitGoalWidget goals={goals} accumulated={accumulated} currentUser={currentUser} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Notificações de Retorno */}
      {todaysReturns.length > 0 ? (
        <motion.div
          onClick={() => onGoToReturnHistory(todaysReturns[0])}
          initial={{ opacity: 0, y: -10 }}
          animate={isVisible ? { opacity: 1, y: 0, scale: [0.96, 1.02, 1] } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.6, ease: 'easeOut', times: [0, 0.6, 1] }}
          whileHover={{ y: -2 }}
          className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-sm group cursor-pointer hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-amber-200"><i className="fas fa-calendar-check"></i></div>
            <div>
              <h4 className="font-black text-amber-900 text-sm uppercase tracking-tight">Retornos para Hoje!</h4>
              <p className="text-amber-700 font-bold text-[10px] uppercase">Você tem {todaysReturns.length} retorno(s) agendado(s) para hoje.</p>
            </div>
          </div>
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-amber-500 shadow-sm group-hover:translate-x-1 transition-transform border border-amber-100"><i className="fas fa-chevron-right"></i></div>
        </motion.div>
      ) : pendingReturns.length > 0 ? (
        <motion.div
          onClick={() => onGoToReturnHistory(pendingReturns[0])}
          initial={{ opacity: 0, y: -10 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          whileHover={{ y: -2 }}
          className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm group cursor-pointer hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-slate-200"><i className="fas fa-calendar-alt"></i></div>
            <div>
              <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">Retornos Agendados</h4>
              <p className="text-slate-600 font-bold text-[10px] uppercase">
                Você tem {pendingReturns.length} retorno(s) pendente(s). Próximo: {
                  (() => {
                    const timestamps = pendingReturns.map(v => {
                      if (typeof v.returnDate === 'number') return v.returnDate;
                      const d = new Date(String(v.returnDate).split('T')[0] + 'T12:00:00');
                      return isNaN(d.getTime()) ? Infinity : d.getTime();
                    }).filter(t => t !== Infinity);

                    if (timestamps.length === 0) return '---';
                    return new Date(Math.min(...timestamps)).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
                  })()
                }
              </p>
            </div>
          </div>
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-500 shadow-sm group-hover:translate-x-1 transition-transform border border-slate-100"><i className="fas fa-chevron-right"></i></div>
        </motion.div>
      ) : null}

      {/* Escala de Visitas PG (VisitRequestsWidget) -- mostra as duas unidades juntas: o
          capelão não deveria precisar trocar de unidade só pra ver a própria escala, e o card
          já exibe um selo (HAB/HABA) em cada item. Ao clicar em "Registrar Visita", a unidade
          correta é assumida automaticamente (ver handleRegisterMission em App.tsx). */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }} transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}>
        <VisitRequestsWidget
          requests={visitRequests || []}
          currentUser={currentUser}
          users={users}
          onRegisterMission={onRegisterMission}
        />
      </motion.div>

      {/* Cartões de Estatísticas */}
      <StatCards stats={stats} isVisible={isVisible} />

      {/* Gráficos de Impacto -- só animam ao entrar na tela (ver useInView dentro do próprio
          componente), pra quem já está com o Dashboard aberto não ver tudo disparando de uma
          vez fora da vista */}
      <ImpactCharts individualData={[
        { name: 'Estudos', val: monthlyStudies.length },
        { name: 'Classes', val: monthlyClasses.length },
        { name: 'PGs', val: monthlyGroups.length },
        { name: 'Visitas', val: monthlyVisits.length },
      ]}
        globalData={globalImpact}
        onGoToTab={onGoToTab}
        comparisonMode={comparisonMode}
        onComparisonModeChange={setComparisonMode}
        availableMonths={availableMonths}
        selectedAverageMonths={selectedAverageMonths}
        onToggleAverageMonth={toggleAverageMonth}
      />

      {/* Histórico de Atividades Recentes */}
      <DashboardActivityHistory unit={unit} />
    </div>
  );
};

export default Dashboard;
