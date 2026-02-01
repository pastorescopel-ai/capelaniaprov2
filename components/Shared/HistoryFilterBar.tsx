
import React from 'react';
import { User } from '../../types';

interface HistoryFilterBarProps {
  users: User[];
  selectedChaplain: string;
  onChaplainChange: (v: string) => void;
  startDate: string;
  onStartChange: (v: string) => void;
  endDate: string;
  onEndChange: (v: string) => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  isAdmin: boolean;
}

const HistoryFilterBar: React.FC<HistoryFilterBarProps> = ({ users, selectedChaplain, onChaplainChange, startDate, onStartChange, endDate, onEndChange, searchQuery, onSearchChange, isAdmin }) => {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm mb-6 space-y-4 animate-in fade-in duration-300">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
          <i className="fas fa-search"></i>
        </div>
        <input 
          type="text" 
          placeholder="Busca rápida por nome de aluno ou colaborador..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
        />
      </div>

      <div className="flex flex-col md:flex-row items-end gap-4">
        {isAdmin && (
          <div className="flex-1 w-full space-y-1">
            <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-widest">Filtrar por Capelão</label>
            <select 
              value={selectedChaplain} 
              onChange={e => onChaplainChange(e.target.value)}
              className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Capelães</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        <div className="w-full md:w-44 space-y-1">
          <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-widest">Início</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => onStartChange(e.target.value)} 
            className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-full md:w-44 space-y-1">
          <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-widest">Fim</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => onEndChange(e.target.value)} 
            className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

export default HistoryFilterBar;
