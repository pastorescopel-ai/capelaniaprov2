import { Ambassador, Unit, Sector, Config } from '../types';
import { getBrandedHeader, getBrandedFooter, getStandardTable } from './reportTemplates';

interface PDFOptions {
  mode: 'sector' | 'full';
  unit: Unit;
  startDate?: string;
  endDate?: string;
  sectorId?: string;
  sortOrder: 'alpha' | 'percent';
  sectors: Sector[];
  stats: any;
  config: Config;
}

export const generateAmbassadorReportHtml = (ambassadors: Ambassador[], options: PDFOptions) => {
  const { mode, unit, startDate, endDate, sectorId, sortOrder, sectors, stats, config } = options;
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
  const sortedSectors = Object.keys(sectorsMap).sort((a, b) => {
    if (sortOrder === 'alpha') return a.localeCompare(b);
    const sA = sectors.find(s => s.name === a);
    const sB = sectors.find(s => s.name === b);
    const percentA = sA ? stats[unit].sectors[sA.id]?.percent || 0 : 0;
    const percentB = sB ? stats[unit].sectors[sB.id]?.percent || 0 : 0;
    return percentB - percentA;
  });

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
        <div class="pdf-page" style="width: 210mm; min-height: 297mm; padding: 20mm 15mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: flex; flex-direction: column;">
          ${getBrandedHeader(config, title, periodLabel)}
          
          <div style="background: #f8fafc; padding: 15px 20px; border-radius: 0 15px 15px 0; border-left: 10px solid ${config.primaryColor}; margin-bottom: 20px;">
            <h2 style="font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 0;">${sectorName}</h2>
            <p style="font-size: 10px; font-weight: bold; color: #64748b; margin: 5px 0 0 0;">TOTAL: ${tableData.length} EMBAIXADORES CAPACITADOS</p>
          </div>

          <div style="flex: 1;">
            ${getStandardTable(['Matrícula', 'Nome Completo', 'Data Capacitação'], tableData)}
          </div>

          ${getBrandedFooter()}
        </div>
      `;
    }).join('');
  } else {
    // Retorna uma única string com todos os setores (contínuo)
    let combinedHtml = `
      <div class="pdf-page" style="width: 210mm; min-height: 297mm; padding: 20mm 15mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: flex; flex-direction: column;">
        ${getBrandedHeader(config, title, periodLabel)}
    `;

    sortedSectors.forEach(sectorName => {
      const tableData = sectorsMap[sectorName]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(amb => [
          amb.registrationId || '-',
          amb.name.toUpperCase(),
          new Date(amb.completionDate).toLocaleDateString()
        ]);

      combinedHtml += `
        <div style="margin-top: 30px;">
          <h3 style="font-size: 14px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; color: #475569;">${sectorName} (${tableData.length})</h3>
          ${getStandardTable(['Matrícula', 'Nome Completo', 'Data Capacitação'], tableData)}
        </div>
      `;
    });

    combinedHtml += `
        <div style="margin-top: 30px; padding: 15px; background: #f8fafc; border-radius: 10px; text-align: right;">
          <span style="font-size: 12px; font-weight: 900; text-transform: uppercase;">Total Geral: ${filtered.length} Embaixadores</span>
        </div>
        ${getBrandedFooter()}
      </div>
    `;
    return combinedHtml;
  }
};

