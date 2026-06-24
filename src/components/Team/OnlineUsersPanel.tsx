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

  const formatTimeAgo = (isoDate: string) => {
    const date = new Date(isoDate);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `Inativo há ${hours}h ${minutes % 60}min`;
    if (minutes > 0) return `Inativo há ${minutes}min`;
    return 'Online agora';
  };

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'ATIVOS AGORA', value: String(activeNow), sub: 'Interagindo em tempo real', icon: '⚡' },
          { title: 'ATIVOS HOJE', value: String(allUsers.length), sub: 'Acessaram recentemente', icon: '🕒' },
          { title: 'TOTAL DA EQUIPE', value: String(allUsers.length), sub: 'Colaboradores vinculados', icon: '👥' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.title}</div>
              <div className="text-4xl font-black text-slate-800">{card.value}</div>
              <div className="text-[10px] text-slate-500 font-bold mt-1">{card.sub}</div>
            </div>
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-xl">{card.icon}</div>
          </div>
        ))}
      </div>

      {/* Filter / Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-full border border-slate-100 shadow-sm">
        <input 
          type="text" 
          placeholder="Buscar colaborador ou cargo..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-64 p-3 px-6 rounded-full bg-slate-50 border-none text-xs font-bold" 
        />
        <div className="flex gap-2">
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
          <div key={user.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-6">
              <img src={user.profilePic || '/default-avatar.png'} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-slate-800 uppercase tracking-tighter text-lg">{user.name}</h4>
                  {user.id === currentUser.id && <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase">VOCÊ</span>}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{user.role} • {user.email}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 text-sm font-black text-slate-800">
                <span className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                {user.isOnline ? 'Online agora' : 'Offline'}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                {user.lastLoginAt ? `Logou: ${new Date(user.lastLoginAt).toLocaleDateString('pt-BR')}` : 'Nunca acessou'}<br/>
                ÚLTIMA AÇÃO: {user.presence ? new Date(user.presence.lastAction).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : 'Sem atividade recente'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

