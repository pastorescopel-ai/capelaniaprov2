
import React, { useMemo, useState } from 'react';
import { Unit } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { REPORT_LOGO_BASE64 } from '../../constants';
import { normalizeString } from '../../utils/formatters';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '../../contexts/ToastContext';

interface PGReportsProps {
  unit: Unit;
}

const PGReports: React.FC<PGReportsProps> = ({ unit }) => {
  const { config, proSectors, proStaff, proGroupMembers, proGroupLocations, proGroups } = useApp();
  const { showToast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'sector' | 'pg'>('sector');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const cleanId = (id: any) => String(id || '').trim();

  const reportHeaderInfo = useMemo(() => {
    const s = new Date(startDate + 'T12:00:00');
    const e = new Date(endDate + 'T12:00:00');
    const firstDay = new Date(s.getFullYear(), s.getMonth(), 1);
    const lastDay = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    const isFullMonth = s.getDate() === 1 && e.getTime() === lastDay.getTime();
    
    if (isFullMonth) {
      const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(s);
      const year = s.getFullYear();
      return {
        title: `Relatório de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year}`,
        periodLabel: `Mês de Referência: ${monthName}/${year}`
      };
    }

    return {
      title: 'Relatório de Cobertura Especial',
      periodLabel: `Período: ${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`
    };
  }, [startDate, endDate]);

  const reportData = useMemo(() => {
    const sectors = proSectors.filter(s => s.unit === unit).sort((a,b) => a.name.localeCompare(b.name));
    const endTimestamp = new Date(endDate + 'T23:59:59').getTime();

    const data = sectors.map(sector => {
        const sectorIdClean = cleanId(sector.id);
        const staff = proStaff.filter(s => cleanId(s.sectorId) === sectorIdClean);
        const enrolled = staff.filter(s => proGroupMembers.some(m => cleanId(m.staffId) === cleanId(s.id) && (m.joinedAt || 0) <= endTimestamp));
        const notEnrolled = staff.filter(s => !proGroupMembers.some(m => cleanId(m.staffId) === cleanId(s.id) && (m.joinedAt || 0) <= endTimestamp));
        
        const geoGroupIds = new Set(proGroupLocations.filter(loc => cleanId(loc.sectorId) === sectorIdClean).map(loc => cleanId(loc.groupId)));
        const memberGroupIds = new Set(proGroupMembers.filter(m => (m.joinedAt || 0) <= endTimestamp && staff.some(s => cleanId(s.id) === cleanId(m.staffId))).map(m => cleanId(m.groupId)));
        const allGroupIdsInSector = new Set([...Array.from(geoGroupIds), ...Array.from(memberGroupIds)]);
        const pgs = Array.from(allGroupIdsInSector).map(gid => proGroups.find(g => cleanId(g.id) === gid)).filter(g => !!g);
        const coverage = staff.length > 0 ? (enrolled.length / staff.length) * 100 : 0;

        return { sector, totalStaff: staff.length, enrolledCount: enrolled.length, coverage, pgs, notEnrolledList: notEnrolled, enrolledList: enrolled };
    });

    const normalizedTerm = normalizeString(searchTerm);
    return data.filter(d => {
        if (d.totalStaff === 0) return false;
        if (!searchTerm) return true;
        if (filterType === 'sector') return normalizeString(d.sector.name).includes(normalizedTerm);
        return d.pgs.some(pg => pg && normalizeString(pg.name).includes(normalizedTerm));
    });
  }, [proSectors, proStaff, proGroupMembers, proGroupLocations, proGroups, unit, searchTerm, filterType, endDate]);

  const generateSectorHtml = (data: any) => {
    return `
      <div id="report-page-${data.sector.id}" style="width: 210mm; min-height: 297mm; padding: 20mm 15mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; position: relative;">
          <div style="border-bottom: 4px solid ${config.primaryColor}; padding-bottom: 20px; margin-bottom: 30px; position: relative; height: 120px; display: flex; align-items: center;">
              <img src="${config.reportLogoUrl || REPORT_LOGO_BASE64}" style="width: ${config.reportLogoWidth}px; position: absolute; left: ${config.reportLogoX}px; top: ${config.reportLogoY}px;" />
              <div style="flex: 1; text-align: ${config.headerTextAlign}; padding-top: ${config.headerPaddingTop}px; margin-left: ${config.reportLogoWidth + 20}px;">
                  <h1 style="font-size: ${config.fontSize1}px; color: ${config.primaryColor}; margin: 0; text-transform: uppercase; font-weight: 900;">${config.headerLine1}</h1>
                  <h2 style="font-size: ${config.fontSize2}px; color: #475569; margin: 0; text-transform: uppercase; font-weight: 700;">${config.headerLine2}</h2>
                  <h3 style="font-size: ${config.fontSize3}px; color: #94a3b8; margin: 0; text-transform: uppercase; font-weight: 500;">${reportHeaderInfo.title}</h3>
                  <p style="font-size: 10px; color: #64748b; text-transform: uppercase; margin: 5px 0; font-weight: bold;">${reportHeaderInfo.periodLabel}</p>
              </div>
          </div>
          <div style="background: #f8fafc; padding: 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-radius: 0 15px 15px 0; border-left: 10px solid ${config.primaryColor};">
              <span style="font-size: 24px; font-weight: 900; text-transform: uppercase;">${data.sector.name}</span>
              <span style="font-size: 16px; font-weight: bold; padding: 8px 20px; border-radius: 12px; color: white; background: ${data.coverage >= 80 ? '#10b981' : data.coverage >= 50 ? '#f59e0b' : '#f43f5e'};">
                  ${Math.round(data.coverage)}% Cobertura
              </span>
          </div>
          <div style="display: flex; gap: 20px; margin-bottom: 30px;">
              <div style="flex: 1; background: #fff; border: 1px solid #e2e8f0; padding: 20px; border-radius: 20px; text-align: center;">
                  <span style="font-size: 32px; font-weight: 900; display: block; color: #334155;">${data.totalStaff}</span>
                  <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-top: 5px;">Total Colaboradores</span>
              </div>
              <div style="flex: 1; background: #fff; border: 1px solid #e2e8f0; padding: 20px; border-radius: 20px; text-align: center;">
                  <span style="font-size: 32px; font-weight: 900; display: block; color: #334155;">${data.enrolledCount}</span>
                  <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-top: 5px;">Matriculados</span>
              </div>
              <div style="flex: 1; background: #fff; border: 1px solid #e2e8f0; padding: 20px; border-radius: 20px; text-align: center;">
                  <span style="font-size: 32px; font-weight: 900; display: block; color: #334155;">${data.pgs.length}</span>
                  <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-top: 5px;">PGs Atuantes</span>
              </div>
          </div>
          <div style="margin-bottom: 30px;">
              <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; color: #475569;">Pequenos Grupos do Setor</div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                  ${data.pgs.length > 0 ? data.pgs.map((pg:any) => `<span style="background: #e0f2fe; color: #0369a1; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; text-transform: uppercase;">${pg?.name}</span>`).join('') : '<span style="font-size: 11px; color: #94a3b8; font-style: italic;">Nenhum PG vinculado.</span>'}
              </div>
          </div>
          <div style="display: flex; gap: 40px; margin-bottom: 40px;">
              <div style="flex: 1;">
                  <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #d1fae5; padding-bottom: 8px; margin-bottom: 12px; color: #10b981;">Matriculados (${data.enrolledList.length})</div>
                  ${data.enrolledList.map((s:any) => `<div style="font-size: 12px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 500;">${s.name}</div>`).join('')}
              </div>
              <div style="flex: 1;">
                  <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #ffe4e6; padding-bottom: 8px; margin-bottom: 12px; color: #f43f5e;">Não Alcançados (${data.notEnrolledList.length})</div>
                  ${data.notEnrolledList.map((s:any) => `<div style="font-size: 12px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 500;">${s.name}</div>`).join('')}
              </div>
          </div>
          <div style="text-align: center; border-top: 2px solid #f1f5f9; padding-top: 25px; margin-top: auto;">
              <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; color: #334155; margin-bottom: 2px;">Pr. Carlos Escopel</div>
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #94a3b8;">Diretor Espiritual - HAB/HABA</div>
          </div>
      </div>
    `;
  };

  const handlePrintAction = async () => {
    setIsGenerating(true);
    const totalSectors = reportData.length;

    try {
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-10000px';
      tempContainer.style.top = '0';
      document.body.appendChild(tempContainer);

      if (!searchTerm) {
        // MODO BACKUP ZIP: Gera múltiplos PDFs binários reais dentro de um ZIP
        const zip = new JSZip();
        
        for (let i = 0; i < totalSectors; i++) {
          setGenerationProgress(`Gerando ${i + 1}/${totalSectors}...`);
          const data = reportData[i];
          
          tempContainer.innerHTML = generateSectorHtml(data);
          const element = tempContainer.firstElementChild as HTMLElement;

          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const singlePdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
          singlePdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
          
          // Adiciona o binário PDF ao ZIP
          const safeName = data.sector.name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
          zip.file(`Relatorio_${safeName}.pdf`, singlePdf.output('blob'));
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Backup_Relatorios_PDF_${unit}_${startDate}.zip`;
        a.click();
        showToast("Backup ZIP gerado com PDFs binários!", "success");
        
      } else {
        // MODO IMPRESSÃO ÚNICA: Gera um único PDF com várias páginas
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        for (let i = 0; i < totalSectors; i++) {
          setGenerationProgress(`Processando ${i + 1}/${totalSectors}...`);
          const data = reportData[i];
          
          tempContainer.innerHTML = generateSectorHtml(data);
          const element = tempContainer.firstElementChild as HTMLElement;

          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }

        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const newWindow = window.open(blobUrl, '_blank');
        if (!newWindow) {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `Relatorio_${unit}.pdf`;
          link.click();
        }
      }

      document.body.removeChild(tempContainer);
      setIsGenerating(false);
      setGenerationProgress(null);
    } catch (error) {
      console.error("Erro na geração de documentos:", error);
      setIsGenerating(false);
      setGenerationProgress(null);
      showToast("Falha ao gerar os documentos binários.", "warning");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{reportHeaderInfo.title}</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{reportHeaderInfo.periodLabel}</p>
            </div>
            <button 
              onClick={handlePrintAction} 
              disabled={isGenerating}
              className={`px-8 py-4 ${!searchTerm ? 'bg-amber-600' : 'bg-[#005a9c]'} text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50 min-w-[220px]`}
            >
                {isGenerating ? (
                  <i className="fas fa-circle-notch fa-spin"></i>
                ) : (
                  <i className={`fas ${!searchTerm ? 'fa-file-archive' : 'fa-file-pdf'}`}></i> 
                )}
                {isGenerating ? (generationProgress || 'Processando...') : (!searchTerm ? 'Gerar Backup (ZIP)' : 'Imprimir PDF')}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[2rem]">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início do Período</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-xl bg-white border-none font-bold text-xs shadow-sm" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim do Período</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-xl bg-white border-none font-bold text-xs shadow-sm" />
            </div>
            
            <div className="lg:col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Filtrar por {filterType === 'sector' ? 'Setor' : 'PG'}</label>
                <div className="flex gap-2">
                  <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={() => setFilterType('sector')} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${filterType === 'sector' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Setor</button>
                    <button onClick={() => setFilterType('pg')} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${filterType === 'pg' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>PG</button>
                  </div>
                  <input 
                      type="text" 
                      placeholder={`Buscar...`} 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="flex-1 p-4 rounded-xl bg-white border-none font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
            </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {reportData.map(data => (
              <div key={data.sector.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-black text-slate-800 uppercase text-sm leading-tight">{data.sector.name}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Cobertura: {Math.round(data.coverage)}%</p>
                      </div>
                      <span className={`w-3 h-3 rounded-full ${data.coverage >= 80 ? 'bg-emerald-500' : data.coverage >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}></span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                      {data.pgs.map(pg => (
                          <span key={pg?.id} className="text-[8px] font-black uppercase px-2 py-1 bg-blue-50 text-blue-600 rounded-md">{pg?.name}</span>
                      ))}
                  </div>
              </div>
          ))}
      </div>
      
      <div className="text-center p-10 text-slate-400">
        <i className="fas fa-file-pdf text-4xl mb-4"></i>
        <p className="font-bold text-xs uppercase">
          {searchTerm ? 'O binário PDF real será gerado e aberto em nova aba para salvar ou imprimir.' : 'Sem filtros: O sistema gerará um pacote ZIP contendo PDFs individuais profissionais para cada setor.'}
        </p>
      </div>
    </div>
  );
};

export default PGReports;
