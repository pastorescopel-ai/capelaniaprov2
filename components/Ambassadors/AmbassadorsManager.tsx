import React, { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import { Unit } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Upload, Users, FileText, Printer } from 'lucide-react';
import { generateAmbassadorReportHtml } from '../../utils/ambassadorPdf';
import { useDocumentGenerator } from '../../hooks/useDocumentGenerator';
import { useAmbassadors } from '../../hooks/useAmbassadors';
import { useAmbassadorStats } from '../../hooks/useAmbassadorStats';
import AmbassadorDashboard from './AmbassadorDashboard';
import AmbassadorTable from './AmbassadorTable';
import ImportTab from './ImportTab';
import ReportsTab from './ReportsTab';
import ConfirmationModal from '../Shared/ConfirmationModal';

const AmbassadorsManager: React.FC = () => {
  const { proSectors, proStaff, config } = useApp();
  const { showToast } = useToast();
  const { generatePdf, isGenerating } = useDocumentGenerator();
  
  // Estados de Navegação e Filtro Global
  const [activeTab, setActiveTab] = useState<'dashboard' | 'import' | 'list' | 'reports'>('dashboard');
  const [currentUnit, setCurrentUnit] = useState<Unit>(Unit.HAB);
  
  // Hook de Dados
  const { 
    ambassadors, 
    isLoading, 
    importPreview, 
    setImportPreview, 
    selectedMonth,
    setSelectedMonth,
    deleteAmbassador, 
    processImport 
  } = useAmbassadors(proSectors);

  const [ambassadorToDelete, setAmbassadorToDelete] = useState<string | null>(null);

  // Hook de Estatísticas
  const { stats, getChartData } = useAmbassadorStats(ambassadors, proSectors, proStaff, selectedMonth);

  // Funções de Navegação de Mês
  const handlePrevMonth = () => {
    const d = new Date(selectedMonth + 'T12:00:00');
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(d.toISOString().split('T')[0]);
  };

  const handleNextMonth = () => {
    const d = new Date(selectedMonth + 'T12:00:00');
    d.setMonth(d.getMonth() + 1);
    setSelectedMonth(d.toISOString().split('T')[0]);
  };

  const formatMonthLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // Filtros de Relatório
  const [reportStartDate, setReportStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [reportSectorId, setReportSectorId] = useState<string>('all');
  const [reportSortOrder, setReportSortOrder] = useState<'alpha' | 'percent'>('alpha');
  const [reportFilterCritical, setReportFilterCritical] = useState(false);

  // Sincronizar datas do relatório com o mês selecionado no cabeçalho
  useEffect(() => {
    const d = new Date(selectedMonth + 'T12:00:00');
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setReportStartDate(prev => prev === start ? prev : start);
    setReportEndDate(prev => prev === end ? prev : end);
  }, [selectedMonth]);

  // --- GERAÇÃO DE PDF ---
  const handleGeneratePDF = async (mode: 'sector' | 'full') => {
    const html = generateAmbassadorReportHtml(ambassadors, {
      mode,
      unit: currentUnit,
      startDate: reportStartDate,
      endDate: reportEndDate,
      sectorId: reportSectorId,
      sortOrder: reportSortOrder,
      filterCritical: reportFilterCritical,
      sectors: proSectors,
      stats,
      config
    });

    if (html) {
      await generatePdf(html, `Relatorio_Embaixadores_${currentUnit}_${mode}_${selectedMonth}`);
    } else {
      showToast('Nenhum dado encontrado para os filtros selecionados.', 'warning');
    }
  };

  return (
    <div className="embaixadores-manager space-y-8 animate-in fade-in duration-500 pb-20 relative">
      
      {/* Cabeçalho Estilo Gestão de PGs */}
      <div className="sticky top-[-1rem] md:top-[-2rem] z-[100] -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-[#f1f5f9]/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto space-y-6">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-lg md:text-xl shadow-lg shadow-blue-900/20">
                <Users />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">
                  Embaixadores da Esperança
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest hidden sm:block">
                    Gestão do projeto de capacitação
                  </p>
                  
                  <span className="w-1 h-1 bg-slate-300 rounded-full hidden sm:block"></span>
                  {/* Seletor de Mês - Design Azul Elétrico */}
                  <div className="flex items-center gap-3 bg-blue-600 px-4 py-2 rounded-2xl shadow-lg shadow-blue-500/40 border border-blue-400/30 transition-all hover:shadow-blue-500/60">
                    <button 
                      onClick={handlePrevMonth} 
                      className="text-lg hover:scale-125 active:scale-90 transition-transform filter drop-shadow-sm"
                      title="Mês Anterior"
                    >
                      ⬅️
                    </button>
                    <span className="text-[11px] font-black text-white uppercase tracking-tighter min-w-[120px] text-center drop-shadow-md">
                      {formatMonthLabel(selectedMonth)}
                    </span>
                    <button 
                      onClick={handleNextMonth} 
                      className="text-lg hover:scale-125 active:scale-90 transition-transform filter drop-shadow-sm"
                      title="Próximo Mês"
                    >
                      ➡️
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl md:rounded-2xl border border-slate-200 self-end md:self-auto">
              {[Unit.HAB, Unit.HABA].map(u => (
                <button 
                  key={u} 
                  onClick={() => setCurrentUnit(u)} 
                  className={`px-6 md:px-8 py-2 md:py-3 rounded-lg md:rounded-xl font-black text-[9px] md:text-[10px] uppercase transition-all ${
                    currentUnit === u 
                      ? 'bg-blue-600 text-white shadow-lg scale-105' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Unidade {u}
                </button>
              ))}
            </div>
          </header>

          {/* Navegação de Abas (Scrollable) */}
          <nav className="flex overflow-x-auto no-scrollbar gap-2">
            {[
              { id: 'dashboard', label: 'Visão Geral', icon: <Users size={16} /> },
              { id: 'import', label: 'Importação', icon: <Upload size={16} /> },
              { id: 'list', label: 'Lista Completa', icon: <FileText size={16} /> },
              { id: 'reports', label: 'Relatórios', icon: <Printer size={16} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-white border-blue-600 text-blue-600 shadow-md scale-105' 
                    : 'bg-white/50 border-transparent text-slate-400 hover:bg-white hover:text-slate-600'
                }`}
              >
                {tab.icon}
                <span className="text-[9px] md:text-xs font-black uppercase tracking-wider">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto min-h-[500px]">
        <main className="animate-in fade-in slide-in-from-top-2 duration-500">
          {activeTab === 'dashboard' && (
            <AmbassadorDashboard 
              currentUnit={currentUnit} 
              stats={stats} 
              getChartData={getChartData} 
            />
          )}

          {activeTab === 'import' && (
            <ImportTab 
              currentUnit={currentUnit}
              importPreview={importPreview}
              setImportPreview={setImportPreview}
              processImport={processImport}
              isLoading={isLoading}
              onSuccess={() => setActiveTab('dashboard')}
              selectedMonth={selectedMonth}
            />
          )}

          {activeTab === 'list' && (
            <AmbassadorTable 
              ambassadors={ambassadors}
              currentUnit={currentUnit}
              proSectors={proSectors}
              deleteAmbassador={(id) => setAmbassadorToDelete(id)}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab 
              currentUnit={currentUnit}
              ambassadors={ambassadors}
              proSectors={proSectors}
              stats={stats}
              reportStartDate={reportStartDate}
              setReportStartDate={setReportStartDate}
              reportEndDate={reportEndDate}
              setReportEndDate={setReportEndDate}
              reportSectorId={reportSectorId}
              setReportSectorId={setReportSectorId}
              reportSortOrder={reportSortOrder}
              setReportSortOrder={setReportSortOrder}
              reportFilterCritical={reportFilterCritical}
              setReportFilterCritical={setReportFilterCritical}
              handleGeneratePDF={handleGeneratePDF}
              isGenerating={isGenerating}
            />
          )}
        </main>
      </div>

      <ConfirmationModal
        isOpen={!!ambassadorToDelete}
        title="Excluir Embaixador"
        message="Tem certeza que deseja excluir este embaixador? Esta ação não pode ser desfeita."
        onConfirm={() => {
          if (ambassadorToDelete) {
            deleteAmbassador(ambassadorToDelete);
            setAmbassadorToDelete(null);
          }
        }}
        onCancel={() => setAmbassadorToDelete(null)}
        variant="danger"
      />
    </div>
  );
};

export default AmbassadorsManager;
