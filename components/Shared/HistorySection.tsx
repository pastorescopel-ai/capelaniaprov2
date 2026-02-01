
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, UserRole } from '../../types';
import HistoryFilterBar from './HistoryFilterBar';
import SkeletonCard from './SkeletonCard';

interface HistorySectionProps<T> {
  title?: string;
  data: T[];
  users: User[];
  currentUser: User;
  isLoading?: boolean;
  searchFields: (keyof T)[];
  renderItem: (item: T) => React.ReactNode;
}

const PAGE_SIZE = 10;

const HistorySection = <T extends { id: string; userId: string; date: string }>({
  title = "Histórico de Atividades",
  data,
  users,
  currentUser,
  isLoading,
  searchFields,
  renderItem
}: HistorySectionProps<T>) => {
  const [filterChaplain, setFilterChaplain] = useState('all');
  const [filterStart, setFilterStart] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [filterEnd, setFilterEnd] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const filteredHistory = useMemo(() => {
    const filtered = data.filter(item => {
      if (!item.date) return false;
      const itemDate = item.date.split('T')[0];
      const dateMatch = itemDate >= filterStart && itemDate <= filterEnd;
      if (!dateMatch) return false;

      const matchChaplain = filterChaplain === 'all' || item.userId === filterChaplain;
      if (!matchChaplain) return false;

      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return searchFields.some(field => {
        const val = item[field];
        if (Array.isArray(val)) return val.some(v => String(v).toLowerCase().includes(query));
        return String(val || "").toLowerCase().includes(query);
      });
    });

    return filtered.sort((a, b) => {
      const aAny = a as any;
      const bAny = b as any;
      
      const isVisit = 'requiresReturn' in aAny;
      if (isVisit) {
        const aPending = aAny.requiresReturn && !aAny.returnCompleted;
        const bPending = bAny.requiresReturn && !bAny.returnCompleted;
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
      }

      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB === dateA) {
        return ((b as any).createdAt || 0) - ((a as any).createdAt || 0);
      }
      return dateB - dateA;
    });
  }, [data, filterChaplain, filterStart, filterEnd, searchQuery, searchFields]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterChaplain, filterStart, filterEnd, searchQuery]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < filteredHistory.length && !isLoadingMore) {
        setIsLoadingMore(true);
        // Delay artificial de 400ms para feedback visual de carregamento
        setTimeout(() => {
          setVisibleCount(prev => prev + PAGE_SIZE);
          setIsLoadingMore(false);
        }, 400);
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [filteredHistory.length, visibleCount, isLoadingMore]);

  const visibleHistory = filteredHistory.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-black text-slate-800 px-2 uppercase tracking-tight">{title}</h3>
      
      <HistoryFilterBar 
        users={users} 
        isAdmin={currentUser.role === UserRole.ADMIN} 
        selectedChaplain={filterChaplain} 
        onChaplainChange={setFilterChaplain} 
        startDate={filterStart} 
        onStartChange={setFilterStart} 
        endDate={filterEnd} 
        onEndChange={setFilterEnd} 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="grid gap-4">
        {isLoading && visibleHistory.length === 0 ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : visibleHistory.length > 0 ? (
          <>
            {visibleHistory.map(item => renderItem(item))}
            
            {(visibleCount < filteredHistory.length || isLoadingMore) && (
              <div ref={loaderRef} className="py-12 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">
                  Desenhando mais {PAGE_SIZE} registros...
                </span>
              </div>
            )}
            
            {visibleCount >= filteredHistory.length && filteredHistory.length > PAGE_SIZE && !isLoadingMore && (
              <div className="py-8 text-center">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                   Fim da lista para o período selecionado
                 </p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white p-24 rounded-[4rem] text-center border-2 border-dashed border-slate-100 animate-in fade-in duration-500">
             <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-search text-slate-200 text-4xl"></i>
             </div>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest leading-relaxed">
               Nenhum registro encontrado.<br/>Tente ajustar as datas ou o filtro do capelão.
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistorySection;
