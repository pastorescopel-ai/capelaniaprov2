
import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole, Unit } from '../../types/enums';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  Users, 
  UserCheck, 
  Calendar, 
  ChevronRight, 
  History,
  GraduationCap
} from 'lucide-react';

interface DashboardActivityHistoryProps {
  unit: Unit;
}

const DashboardActivityHistory: React.FC<DashboardActivityHistoryProps> = ({ unit }) => {
  const { 
    bibleStudies, 
    bibleClasses, 
    smallGroups, 
    staffVisits, 
    users 
  } = useApp();
  
  const { currentUser } = useAuth();

  const activities = useMemo(() => {
    const isChaplain = currentUser?.role === UserRole.CHAPLAIN;
    const isIntern = currentUser?.role === UserRole.INTERN;
    const currentUserId = currentUser?.id;

    const userMap = new Map(users.map(u => [u.id, u.name]));

    const allActivities: any[] = [
      ...bibleStudies.map(item => ({
        id: item.id,
        type: 'bible_study',
        title: `Estudo Bíblico: ${item.name}`,
        subtitle: `${item.sector} • ${item.lesson}`,
        date: item.date,
        userId: item.userId,
        unit: item.unit
      })),
      ...bibleClasses.map(item => ({
        id: item.id,
        type: 'bible_class',
        title: `Classe Bíblica: ${item.guide}`,
        subtitle: `${item.sector} • ${item.students?.length || 0} Alunos`,
        date: item.date,
        userId: item.userId,
        unit: item.unit
      })),
      ...smallGroups.map(item => ({
        id: item.id,
        type: 'small_group',
        title: `Reunião PG: ${item.groupName}`,
        subtitle: `Líder: ${item.leader} • ${item.participantsCount} Presenças`,
        date: item.date,
        userId: item.userId,
        unit: item.unit
      })),
      ...staffVisits.map(item => ({
        id: item.id,
        type: 'staff_visit',
        title: `Visita: ${item.staffName}`,
        subtitle: `${item.sector} • ${item.reason}`,
        date: item.date,
        userId: item.userId,
        unit: item.unit
      }))
    ];

    return allActivities
      .filter(act => {
        const unitMatch = act.unit === unit;
        const userMatch = (isChaplain || isIntern) ? act.userId === currentUserId : true;
        return unitMatch && userMatch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map(act => ({
        ...act,
        userName: userMap.get(act.userId) || 'Usuário Desconhecido'
      }));
  }, [bibleStudies, bibleClasses, smallGroups, staffVisits, users, currentUser, unit]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'bible_study': return <BookOpen className="w-5 h-5" />;
      case 'bible_class': return <GraduationCap className="w-5 h-5" />;
      case 'small_group': return <Users className="w-5 h-5" />;
      case 'staff_visit': return <UserCheck className="w-5 h-5" />;
      default: return <History className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bible_study': return 'Estudo Bíblico';
      case 'bible_class': return 'Classe Bíblica';
      case 'small_group': return 'Reunião de PG';
      case 'staff_visit': return 'Visita Pastoral';
      default: return 'Atividade';
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'bible_study': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'bible_class': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'small_group': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'staff_visit': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (activities.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#005a9c]/10 flex items-center justify-center text-[#005a9c]">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
              {currentUser?.role === UserRole.ADMIN ? 'Histórico Geral de Atividades' : 'Minhas Atividades Recentes'}
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Últimos registros realizados nesta unidade</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {activities.map((activity, idx) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group p-5 hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${getBadgeColor(activity.type)} transition-transform group-hover:rotate-6`}>
                  {getIcon(activity.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-slate-800 group-hover:text-[#005a9c] transition-colors">{activity.title}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getBadgeColor(activity.type)}`}>
                      {getTypeLabel(activity.type)}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">{activity.subtitle}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      <Calendar className="w-3 h-3" />
                      {new Date(activity.date).toLocaleDateString('pt-BR')}
                    </span>
                    {currentUser?.role === UserRole.ADMIN && (
                      <span className="flex items-center gap-1 text-[9px] font-black text-blue-400 uppercase tracking-wider">
                        <UserCheck className="w-3 h-3" />
                        {activity.userName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end text-slate-300 group-hover:text-[#005a9c] transition-colors">
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
        
        {activities.length >= 10 ? (
           <div className="bg-slate-50/50 p-4 border-t border-slate-100">
             <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
               Exibindo apenas os 10 registros mais recentes
             </p>
           </div>
        ) : (
           <div className="h-4 bg-white" />
        )}
      </div>
    </div>
  );
};

export default DashboardActivityHistory;
