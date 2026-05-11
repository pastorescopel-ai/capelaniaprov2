import { Ambassador, Unit, Sector, Config } from '../types';
import { getBrandedHeaderByProfile, getBrandedFooter, getStandardTable } from './reportTemplates';

interface PDFOptions {
  mode: 'sector' | 'full';
  unit: Unit;
  startDate?: string;
  endDate?: string;
  sectorId?: string;
  sortOrder: 'alpha' | 'percent';
  filterCritical?: boolean;
  sectors: Sector[];
  stats: any;
  config: Config;
}

export const generateAmbassadorReportHtml = (ambassadors: Ambassador[], options: PDFOptions) => {
  const { mode, unit, startDate, endDate, sectorId, sortOrder, filterCritical, sectors, stats, config } = options;
  const title = `Embaixadores da Esperança - ${unit}`;
  const periodLabel = `Período: ${startDate ? new Date(startDate).toLocaleDateString() : 'Início'} até ${endDate ? new Date(endDate).toLocaleDateString() : 'Hoje'}`;

  // Filtros de dados
  let filtered = ambassadors.filter(a => a.unit === unit);
  
  if (startDate) {
    filtered = filtered.filter(a => new Date(a.completionDate) >= new Date(startDate));
  }
  if (endDate) {
    filtered = filtered.filter(a => new Date(a.completionDate) <= new Date(endDate));
  }
  if (sectorId && sectorId !== 'all') {
    filtered = filtered.filter(a => String(a.sectorId) === String(sectorId));
  }

  // Agrupar por setor
  const sectorsMap: Record<string, Ambassador[]> = {};
  filtered.forEach(amb => {
    const sectorName = sectors.find(s => String(s.id) === String(amb.sectorId))?.name || 'SEM SETOR';
    if (!sectorsMap[sectorName]) sectorsMap[sectorName] = [];
    sectorsMap[sectorName].push(amb);
  });

  // Ordenar setores
  let sortedSectors = Object.keys(sectorsMap).sort((a, b) => {
    if (sortOrder === 'alpha') return a.localeCompare(b);
    const sA = sectors.find(s => s.name === a);
    const sB = sectors.find(s => s.name === b);
    const percentA = sA ? stats[unit].sectors[sA.id]?.percent || 0 : 0;
    const percentB = sB ? stats[unit].sectors[sB.id]?.percent || 0 : 0;
    return percentB - percentA;
  });

  // Aplicar filtro de gargalo (< 5%)
  if (filterCritical) {
    sortedSectors = sortedSectors.filter(sectorName => {
      const s = sectors.find(sec => sec.name === sectorName);
      const percent = s ? stats[unit].sectors[s.id]?.percent || 0 : 0;
      return percent < 5;
    });
  }

  if (sortedSectors.length === 0) return null;

  if (mode === 'sector') {
    // Retorna um array de páginas (uma por setor)
    return sortedSectors.map(sectorName => {
      const tableData = sectorsMap[sectorName]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(amb => [
          amb.registrationId || '-',
          amb.name.toUpperCase(),
          new Date(amb.completionDate).toLocaleDateString()
        ]);

      return `
        <div class="pdf-page" style="width: 210mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: visible; line-height: 1.6; page-break-after: always;">
          ${getBrandedHeaderByProfile(config, 'ambassadors', periodLabel)}
          
          <div style="padding: 0 20mm 20mm 20mm;">
            <div style="background: #f8fafc; padding: 25px 30px; border-radius: 0 20px 20px 0; border-left: 12px solid ${config.primaryColor}; margin-bottom: 35px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); page-break-inside: avoid;">
              <h2 style="font-size: 28px; font-weight: 900; text-transform: uppercase; margin: 0; color: #0f172a; letter-spacing: -0.025em;">${sectorName}</h2>
              <p style="font-size: 12px; font-weight: 800; color: #64748b; margin: 8px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em;">TOTAL: ${tableData.length} EMBAIXADORES CAPACITADOS</p>
            </div>

            <div style="margin-bottom: 40px;">
              ${getStandardTable(['Matrícula', 'Nome Completo', 'Data Capacitação'], tableData)}
            </div>

            ${getBrandedFooter()}
          </div>
        </div>
      `;
    }).join('');
  } else {
    // Retorna uma única string com todos os setores (contínuo, mas paginado)
    let html = '';
    const SECTORS_PER_PAGE = 3; // Ajuste conforme necessário
    
    const sectorChunks = [];
    for (let i = 0; i < sortedSectors.length; i += SECTORS_PER_PAGE) {
      sectorChunks.push(sortedSectors.slice(i, i + SECTORS_PER_PAGE));
    }

    sectorChunks.forEach((chunk, idx) => {
      html += `
        <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
          ${getBrandedHeaderByProfile(config, 'ambassadors', `${periodLabel} ${idx > 0 ? '(Cont.)' : ''}`)}
          <div style="padding: 0 20mm 20mm 20mm;">
            ${chunk.map(sectorName => {
              const tableData = sectorsMap[sectorName]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(amb => [
                  amb.registrationId || '-',
                  amb.name.toUpperCase(),
                  new Date(amb.completionDate).toLocaleDateString()
                ]);

              return `
                <div style="margin-top: 35px; page-break-inside: avoid;">
                  <h3 style="font-size: 18px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #f1f5f9; padding-bottom: 10px; color: #334155; margin-bottom: 15px; letter-spacing: 0.025em;">${sectorName} (${tableData.length})</h3>
                  ${getStandardTable(['Matrícula', 'Nome Completo', 'Data Capacitação'], tableData)}
                </div>
              `;
            }).join('')}
            
            ${idx === sectorChunks.length - 1 ? `
              <div style="margin-top: 40px; padding: 20px; background: #f8fafc; border-radius: 20px; text-align: right; border: 1px solid #e2e8f0;">
                <span style="font-size: 14px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 0.05em;">Total Geral: ${filtered.length} Embaixadores</span>
              </div>
            ` : ''}

            <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
              ${getBrandedFooter()}
            </div>
          </div>
        </div>
      `;
    });
    
    return html;
  }
};

