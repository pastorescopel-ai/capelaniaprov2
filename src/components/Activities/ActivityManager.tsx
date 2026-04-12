
import React, { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import ActivityScheduler from './ActivityScheduler';
import ActivityMonthlyAnalysis from './ActivityMonthlyAnalysis';
import ActivityChecklist from './ActivityChecklist';
import ActivityReports from './ActivityReports';
import { Calendar, BarChart3, TrendingUp, CheckSquare } from 'lucide-react';

interface ActivityManagerProps {
  isActive?: boolean;
  initialSubTab?: 'analysis' | 'checklist' | 'scheduler' | 'reports';
}

const ActivityManager: React.FC<ActivityManagerProps> = ({ isActive, initialSubTab }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'analysis' | 'checklist' | 'scheduler' | 'reports'>('analysis');
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // Centralized state for filters shared between Checklist and Analysis
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });
  const [selectedUser, setSelectedUser] = useState<string>(isAdmin ? '' : (currentUser?.id || ''));

  // Scroll to top when tab or sub-tab changes
  useEffect(() => {
    if (isActive) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isActive, activeTab]);

  useEffect(() => {
    if (isActive) {
      if (initialSubTab) {
        setActiveTab(initialSubTab); // eslint-disable-line react-hooks/set-state-in-effect
      } else {
        setActiveTab('analysis');
      }
    }
  }, [isActive, initialSubTab]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
            <Calendar />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">
              Atividades Diárias
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              Blueprint, Setores e Visitas
            </p>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 -mb-2 custom-scrollbar">
          <nav className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 min-w-max">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${
              activeTab === 'analysis'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <TrendingUp size={14} />
            <span>Análise Mensal</span>
          </button>
          
          <button
            onClick={() => setActiveTab('checklist')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${
              activeTab === 'checklist'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CheckSquare size={14} />
            <span>Lançar Atividades</span>
          </button>

          <button
            onClick={() => setActiveTab('scheduler')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${
              activeTab === 'scheduler'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar size={14} />
            <span>Atividades Agendadas</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${
                activeTab === 'reports'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <BarChart3 size={14} />
              <span>Relatórios</span>
            </button>
          )}
        </nav>
        </div>
      </header>

      <main className="min-h-[500px]">
        {activeTab === 'analysis' && (
          <ActivityMonthlyAnalysis 
            selectedUser={selectedUser} 
            setSelectedUser={setSelectedUser}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}
        {activeTab === 'checklist' && (
          <ActivityChecklist 
            selectedUser={selectedUser} 
            setSelectedUser={setSelectedUser}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}
        {activeTab === 'scheduler' && <ActivityScheduler />}
        {activeTab === 'reports' && <ActivityReports />}
      </main>
    </div>
  );
};

export default ActivityManager;
