
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, UserRole } from '../../types';
import HistoryFilterBar from './HistoryFilterBar';
import SkeletonCard from './SkeletonCard';
import EmptyState from './EmptyState';
import { normalizeString, ensureISODate } from '../../utils/formatters';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  onContinue?: (item: T) => void;
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
  bypassFilter,
  onContinue
}: HistorySectionProps<T>) => {
  const [filterChaplain, setFilterChaplain] = useState('all');
  const [isAdminSectionOpen, setIsAdminSectionOpen] = useState(false);
  
  const getInitialStartDate = () => {
    const now = new Date();
    // Retorna o primeiro dia do mês anterior para garantir que o histórico recente seja visível
    return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  };

  const [filterStart, setFilterStart] = useState(getInitialStartDate());
  const [filterEnd, setFilterEnd] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const filteredHistory = useMemo(() => {
    const normQuery = normalizeString(debouncedSearchQuery);
    const searchTerms = normQuery.split(' ').filter(t => t.trim() !== '');
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();

    const filtered = data.filter(item => {
      if (!item.date) return false;
      
      const matchChaplain = filterChaplain === 'all' || item.userId === filterChaplain;
      
      // Se o filtro de capelão estiver ativo e o item não for do capelão,
      // ele DEVE ser ignorado, mesmo que seja um retorno pendente (bypassFilter).
      if (!matchChaplain) return false;

      const isBypassed = bypassFilter?.(item);
      if (isBypassed) return true;

      // Bypass para itens recém-criados (últimos 5 minutos) do próprio usuário
      // Isso garante feedback imediato após o salvamento, ignorando filtros de data.
      const isRecent = item.createdAt && (now - Number(item.createdAt)) < 300000;
      if (isRecent && item.userId === currentUser.id) return true;

      const itemDate = ensureISODate(item.date);
      if (!itemDate) return false;
      const dateMatch = itemDate >= filterStart && itemDate <= filterEnd;
      const isSearching = searchTerms.length > 0;
      
      if (!isSearching && !dateMatch) return false;

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
    
    return filtered.sort((a, b) => {
      // 1. Se for Admin e filtro for 'all', prioriza os próprios registros
      if (currentUser.role === UserRole.ADMIN && filterChaplain === 'all') {
        const aIsMine = a.userId === currentUser.id;
        const bIsMine = b.userId === currentUser.id;
        if (aIsMine && !bIsMine) return -1;
        if (!aIsMine && bIsMine) return 1;
      }
      
      // 2. Ordenação por data (mais recente primeiro)
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      
      // 3. Tie-breaker: createdAt (mais recente primeiro)
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [data, filterChaplain, filterStart, filterEnd, debouncedSearchQuery, searchFields, disableSort, bypassFilter, currentUser]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filterChaplain, filterStart, filterEnd, debouncedSearchQuery]);

  const isDividedView = currentUser.role === UserRole.ADMIN && filterChaplain === 'all';

  const { adminHistory, othersHistory } = useMemo(() => {
    if (!isDividedView) {
      return { adminHistory: [], othersHistory: filteredHistory };
    }
    const admin = filteredHistory.filter(item => item.userId === currentUser.id);
    const others = filteredHistory.filter(item => item.userId !== currentUser.id);
    return { adminHistory: admin, othersHistory: others };
  }, [filteredHistory, isDividedView, currentUser.id]);

  const visibleHistory = filteredHistory.slice(0, visibleCount);
  const hasMore = visibleCount < filteredHistory.length;

  const visibleOthers = othersHistory.slice(0, visibleCount);
  const visibleAdmin = adminHistory.slice(0, visibleCount);

  const hasMoreOthers = visibleCount < othersHistory.length;
  const hasMoreAdmin = visibleCount < adminHistory.length;

  const handleClearFilters = () => {
    setFilterChaplain('all');
    setFilterStart(getInitialStartDate());
    setFilterEnd(new Date().toISOString().split('T')[0]);
    setSearchQuery('');
  };

  const hasActiveFilters = filterChaplain !== 'all' || 
    filterStart !== getInitialStartDate() || 
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
        {isLoading && filteredHistory.length === 0 ? (
          <SkeletonCard />
        ) : isDividedView ? (
          // DIVIDED VIEW FOR ADMINS
          (adminHistory.length > 0 || othersHistory.length > 0) ? (
            <div className="space-y-4">
              {/* COLLAPSIBLE ADMIN ACTIVITIES SECTION */}
              {adminHistory.length > 0 && (
                <div className="bg-slate-50/70 border border-slate-100 rounded-[2rem] p-5 md:p-6 transition-all space-y-4">
                  <button
                    type="button"
                    onClick={() => setIsAdminSectionOpen(!isAdminSectionOpen)}
                    className="w-full flex items-center justify-between text-left focus:outline-none group pb-1"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#005a9c]/10 group-hover:text-[#005a9c] transition-all shadow-sm">
                        {isAdminSectionOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-[#005a9c] group-hover:text-amber-500 transition-colors">
                          Mapeamento Pessoal (Minhas Atividades de Capelão Admin)
                        </h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          Oculto por padrão. Clique para visualizar.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-200/60 px-3 py-1.5 rounded-full shadow-sm">
                      {adminHistory.length} {adminHistory.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </button>

                  {isAdminSectionOpen && (
                    <div className="space-y-3 pt-2 animate-in fade-in duration-300">
                      {visibleAdmin.map((item, index) => renderItem(item, index, adminHistory))}
                      
                      {hasMoreAdmin && (
                        <div className="pt-2 pb-4 flex flex-col items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[9px] uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                          >
                            <i className="fas fa-plus-circle"></i>
                            Ver mais 10 pessoais
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* OTHERS ACTIVITIES SECTION */}
              {othersHistory.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-2 pb-1 border-b border-dashed border-slate-200 mt-2">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Atividades de Outros Capelães ({othersHistory.length})
                    </span>
                  </div>
                  
                  {visibleOthers.map((item, index) => renderItem(item, index, othersHistory))}
                  
                  {hasMoreOthers && (
                    <div className="pt-4 pb-8 flex flex-col items-center gap-4">
                      <button 
                        type="button"
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
                        Exibindo {visibleOthers.length} de {othersHistory.length}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                adminHistory.length > 0 && !isAdminSectionOpen && (
                  <div className="p-8 bg-slate-50/50 border border-slate-100 rounded-[2rem] text-center">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      As únicas atividades encontradas neste período pertencem a você. Abra a gaveta acima para visualizá-las.
                    </p>
                  </div>
                )
              )}

              <div ref={loaderRef} className="h-4"></div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <EmptyState 
                icon="fa-folder-open" 
                title="Nenhum registro encontrado" 
                description="Não encontramos nenhum dado para os filtros selecionados neste período."
                colorClass="text-slate-400 bg-slate-50 border-slate-100"
              />
            </div>
          )
        ) : (
          // STANDARD SINGLE LIST VIEW
          visibleHistory.length > 0 ? (
            <>
              {visibleHistory.map((item, index) => renderItem(item, index, visibleHistory))}
              
              {hasMore && (
                <div className="pt-4 pb-8 flex flex-col items-center gap-4">
                  <button 
                    type="button"
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
          )
        )}
      </div>
    </div>
  );
};

export default HistorySection;
