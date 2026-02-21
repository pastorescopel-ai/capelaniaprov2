
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, UserRole } from '../../types';
import HistoryFilterBar from './HistoryFilterBar';
import SkeletonCard from './SkeletonCard';
import { normalizeString } from '../../utils/formatters';

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
  
  const getStartOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };

  const [filterStart, setFilterStart] = useState(getStartOfMonth());
  const [filterEnd, setFilterEnd] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  
  // Backup state para evitar tela branca durante sincronização
  const [stableData, setStableData] = useState<T[]>(data);

  useEffect(() => {
    if (data && data.length > 0) {
      setStableData(data);
    }
  }, [data]);

  const filteredHistory = useMemo(() => {
    const source = stableData.length > 0 ? stableData : data;
    const normQuery = normalizeString(searchQuery);
    const searchTerms = normQuery.split(' ').filter(t => t.trim() !== '');

    const filtered = source.filter(item => {
      if (!item.date) return false;
      const itemDate = item.date.split('T')[0];
      const dateMatch = itemDate >= filterStart && itemDate <= filterEnd;
      const matchChaplain = filterChaplain === 'all' || item.userId === filterChaplain;
      const isSearching = searchTerms.length > 0;
      
      if (!isSearching && !dateMatch) return false;
      if (!matchChaplain) return false;

      if (!isSearching) return true;

      // Smart Search: Verifica se algum campo configurado contém TODOS os termos da busca
      return searchFields.some(field => {
        const val = item[field];
        // Concatena se for array, ou usa string direta
        const textVal = Array.isArray(val) ? val.join(' ') : String(val || "");
        const normText = normalizeString(textVal);
        
        // Verifica se TODOS os termos digitados estão presentes neste campo
        // Ex: Campo "Maria Silva", Busca "Maria" -> OK. Busca "Maria Silva" -> OK.
        return searchTerms.every(term => normText.includes(term));
      });
    });

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, stableData, filterChaplain, filterStart, filterEnd, searchQuery, searchFields]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterChaplain, filterStart, filterEnd, searchQuery]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < filteredHistory.length && !isLoadingMore) {
        setIsLoadingMore(true);
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
        users={users} isAdmin={currentUser.role === UserRole.ADMIN} 
        selectedChaplain={filterChaplain} onChaplainChange={setFilterChaplain} 
        startDate={filterStart} onStartChange={setFilterStart} 
        endDate={filterEnd} onEndChange={setFilterEnd} 
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
      />
      <div className="grid gap-4">
        {isLoading && visibleHistory.length === 0 ? (
          <SkeletonCard />
        ) : visibleHistory.length > 0 ? (
          <>
            {visibleHistory.map(item => renderItem(item))}
            <div ref={loaderRef} className="h-10"></div>
          </>
        ) : (
          <div className="bg-white p-20 rounded-[4rem] text-center border-2 border-dashed border-slate-100">
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhum registro encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistorySection;
