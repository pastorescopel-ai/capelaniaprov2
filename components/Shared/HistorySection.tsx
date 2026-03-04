
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, UserRole } from '../../types';
import HistoryFilterBar from './HistoryFilterBar';
import SkeletonCard from './SkeletonCard';
import EmptyState from './EmptyState';
import { normalizeString } from '../../utils/formatters';

interface HistorySectionProps<T> {
  title?: string;
  data: T[];
  users: User[];
  currentUser: User;
  isLoading?: boolean;
  searchFields: (keyof T)[];
  renderItem: (item: T, index: number, allItems: T[]) => React.ReactNode;
  disableSort?: boolean;
  bypassFilter?: (item: T) => boolean;
}

const PAGE_SIZE = 10;

const HistorySection = <T extends { id: string; userId: string; date: string }>({
  title = "Histórico de Atividades",
  data,
  users,
  currentUser,
  isLoading,
  searchFields,
  renderItem,
  disableSort = false,
  bypassFilter
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStableData(data);
    }
  }, [data]);

  const filteredHistory = useMemo(() => {
    const source = stableData.length > 0 ? stableData : data;
    const normQuery = normalizeString(searchQuery);
    const searchTerms = normQuery.split(' ').filter(t => t.trim() !== '');

    const filtered = source.filter(item => {
      if (!item.date) return false;
      
      const isBypassed = bypassFilter?.(item);
      if (isBypassed) return true;

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

    if (disableSort) return filtered;
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, stableData, filterChaplain, filterStart, filterEnd, searchQuery, searchFields, disableSort, bypassFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCount(PAGE_SIZE);
  }, [filterChaplain, filterStart, filterEnd, searchQuery]);

  const visibleHistory = filteredHistory.slice(0, visibleCount);
  const hasMore = visibleCount < filteredHistory.length;

  const handleClearFilters = () => {
    setFilterChaplain('all');
    setFilterStart(getStartOfMonth());
    setFilterEnd(new Date().toISOString().split('T')[0]);
    setSearchQuery('');
  };

  const hasActiveFilters = filterChaplain !== 'all' || 
    filterStart !== getStartOfMonth() || 
    filterEnd !== new Date().toISOString().split('T')[0] || 
    searchQuery !== '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2">
        <h3 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-tight">{title}</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
          {filteredHistory.length} registros encontrados
        </span>
      </div>

      <HistoryFilterBar 
        users={users} isAdmin={currentUser.role === UserRole.ADMIN} 
        selectedChaplain={filterChaplain} onChaplainChange={setFilterChaplain} 
        startDate={filterStart} onStartChange={setFilterStart} 
        endDate={filterEnd} onEndChange={setFilterEnd} 
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="grid gap-3 md:gap-4">
        {isLoading && visibleHistory.length === 0 ? (
          <SkeletonCard />
        ) : visibleHistory.length > 0 ? (
          <>
            {visibleHistory.map((item, index) => renderItem(item, index, visibleHistory))}
            
            {hasMore && (
              <div className="pt-4 pb-8 flex flex-col items-center gap-4">
                <button 
                  onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                  disabled={isLoadingMore}
                  className="px-8 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:border-slate-200 active:scale-95 transition-all shadow-sm flex items-center gap-3 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <i className="fas fa-circle-notch fa-spin"></i>
                      Carregando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus-circle"></i>
                      Carregar mais 10 registros
                    </>
                  )}
                </button>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Exibindo {visibleHistory.length} de {filteredHistory.length}
                </p>
              </div>
            )}
            
            {/* Elemento para trigger de scroll infinito opcional ou apenas margem */}
            <div ref={loaderRef} className="h-4"></div>
          </>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <EmptyState 
              icon="fa-folder-open" 
              title="Nenhum registro encontrado" 
              description="Não encontramos nenhum dado para os filtros selecionados neste período."
              colorClass="text-slate-400 bg-slate-50 border-slate-100"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HistorySection;
