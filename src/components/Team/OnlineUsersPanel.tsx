import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { User } from '../../types';

interface OnlineUserPresence {
  id: string;
  name: string;
  profilePic?: string;
  lastAction: string;
  role: string;
  email: string;
}

interface OnlineUsersPanelProps {
  currentUser: User;
  allUsers: User[];
}

export const OnlineUsersPanel: React.FC<OnlineUsersPanelProps> = ({ currentUser, allUsers }) => {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, OnlineUserPresence>>({});
  const [filter, setFilter] = useState<'Todos' | 'Ativos' | 'Offline'>('Todos');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat() as OnlineUserPresence[];
        const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {});
        setOnlineUsers(userMap);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: currentUser.id,
            name: currentUser.name,
            profilePic: currentUser.profilePic,
            lastAction: new Date().toISOString(),
            role: currentUser.role,
            email: currentUser.email
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Data de "hoje" no formato usado por lastLoginAt (YYYY-MM-DD, ver AuthProvider.tsx) --
  // comparação simples de string, sem precisar de fuso horário.
  const todayISO = new Date().toISOString().split('T')[0];

  const usersDisplay = allUsers.map(user => ({
    ...user,
    presence: onlineUsers[user.id],
    isOnline: !!onlineUsers[user.id]
  })).filter(u => {
    if (filter === 'Ativos' && !u.isOnline) return false;
    if (filter === 'Offline' && u.isOnline) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeNow = Object.keys(onlineUsers).length;
  // "Ativos hoje" de verdade: quem está online agora (presença em tempo real) OU cujo último
  // login (lastLoginAt, gravado no momento da autenticação) foi hoje -- antes esse card
  // mostrava o mesmo número de "Total da Equipe" por engano (os dois usavam allUsers.length
  // sem nenhuma conta real em cima dos dados de acesso).
  const activeToday = allUsers.filter(u => !!onlineUsers[u.id] || u.lastLoginAt === todayISO).length;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {[
          { title: 'ATIVOS AGORA', value: String(activeNow), sub: 'Interagindo em tempo real', icon: '⚡' },
          { title: 'ATIVOS HOJE', value: String(activeToday), sub: 'Online agora ou logaram hoje', icon: '🕒' },
          { title: 'TOTAL DA EQUIPE', value: String(allUsers.length), sub: 'Colaboradores vinculados', icon: '👥' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.title}</div>
              <div className="text-4xl font-black text-slate-800">{card.value}</div>
              <div className="text-[10px] text-slate-500 font-bold mt-1">{card.sub}</div>
            </div>
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-xl flex-shrink-0">{card.icon}</div>
          </div>
        ))}
      </div>

      {/* Filter / Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white p-4 rounded-[2rem] md:rounded-full border border-slate-100 shadow-sm">
        <input
          type="text"
          placeholder="Buscar colaborador ou cargo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-64 p-3 px-6 rounded-full bg-slate-50 border-none text-xs font-bold"
        />
        <div className="flex flex-wrap gap-2 justify-center">
          {['Todos', 'Ativos', 'Offline'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-6 py-2 rounded-full text-xs font-black uppercase ${filter === f ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
              {f}
            </button>
          ))}
          <button className="p-3 bg-slate-100 rounded-full text-slate-500" onClick={() => window.location.reload()}><i className="fas fa-sync-alt"></i></button>
        </div>
      </div>

      {/* User List */}
      <div className="space-y-4">
        {usersDisplay.map(user => (
          <div key={user.id} className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
            <div className="flex items-center gap-4 md:gap-6 min-w-0">
              <img src={user.profilePic || '/default-avatar.png'} alt={user.name} className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover flex-shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-slate-800 uppercase tracking-tighter text-base md:text-lg">{user.name}</h4>
                  {user.id === currentUser.id && <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase">VOCÊ</span>}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest break-all">{user.role} • {user.email}</div>
              </div>
            </div>
            <div className="text-left md:text-right flex-shrink-0">
              <div className="flex items-center md:justify-end gap-2 text-sm font-black text-slate-800">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${user.isOnline ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                {user.isOnline ? 'Online agora' : 'Offline'}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                {user.isOnline
                  ? 'Conectado neste momento'
                  : user.lastLoginAt
                    ? `Último acesso: ${new Date(user.lastLoginAt + 'T00:00:00').toLocaleDateString('pt-BR')}`
                    : 'Nunca acessou'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

