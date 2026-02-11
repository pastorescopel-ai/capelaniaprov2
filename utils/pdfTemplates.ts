
import { Unit, RecordStatus, Config } from '../types';

interface PDFTemplateData {
  config: Config;
  filters: { startDate: string; endDate: string };
  totalStats: any;
  chaplainStats: any[];
  unitTotals: { hab: number; haba: number };
  pColor: string;
}

const formatDate = (d: string) => d.split('T')[0].split('-').reverse().join('/');

export const generateExecutiveHTML = (data: PDFTemplateData) => {
  const { config, filters, totalStats, chaplainStats, unitTotals, pColor } = data;
  const reportLogoSrc = config.reportLogoUrl || '';

  const renderHeader = () => `
    <header style="border-bottom: 4px solid ${pColor}; padding-bottom: 20px; margin-bottom: 30px; position: relative; height: 120px; display: flex; align-items: center;">
      <img src="${reportLogoSrc}" style="width: ${config.reportLogoWidth}px; position: absolute; left: ${config.reportLogoX}px; top: ${config.reportLogoY}px;" />
      <div style="flex: 1; text-align: ${config.headerTextAlign}; padding-top: ${config.headerPaddingTop}px; margin-left: ${config.reportLogoWidth + 20}px;">
        <h1 style="font-size: ${config.fontSize1}px; color: ${pColor}; margin: 0; text-transform: uppercase; font-weight: 900;">${config.headerLine1}</h1>
        <h2 style="font-size: ${config.fontSize2}px; color: #475569; margin: 0; text-transform: uppercase; font-weight: 700;">${config.headerLine2}</h2>
        <h3 style="font-size: ${config.fontSize3}px; color: #94a3b8; margin: 0; text-transform: uppercase; font-weight: 500;">Relatório Executivo de Capelania</h3>
        <p style="font-size: 10px; color: #64748b; text-transform: uppercase; margin: 5px 0; font-weight: bold;">Período: ${formatDate(filters.startDate)} a ${formatDate(filters.endDate)}</p>
      </div>
    </header>
  `;

  const renderTable = (unit: Unit) => {
    const tableData = chaplainStats.filter(s => (unit === Unit.HAB ? s.hab.total > 0 || s.hab.students > 0 : s.haba.total > 0 || s.haba.students > 0));
    
    return `
      <div style="margin-bottom: 40px;">
        <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 900; color: ${pColor}; text-transform: uppercase; border-left: 5px solid ${pColor}; padding-left: 10px;">Unidade ${unit}</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed;">
          <thead>
            <tr style="background: ${pColor}; color: white; text-transform: uppercase;">
              <th style="padding: 10px; text-align: left; width: 25%;">Capelão</th>
              <th style="padding: 10px; text-align: center; width: 20%; background: rgba(255,255,255,0.1);">Total Alunos</th>
              <th style="padding: 10px; text-align: center; width: 12%;">Estudos</th>
              <th style="padding: 10px; text-align: center; width: 12%;">Classes</th>
              <th style="padding: 10px; text-align: center; width: 10%;">PGs</th>
              <th style="padding: 10px; text-align: center; width: 11%; background: #991b1b;">Visitas</th>
            </tr>
          </thead>
          <tbody>
            ${tableData.map(s => {
              const u = unit === Unit.HAB ? s.hab : s.haba;
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: 700; color: #1e293b;">${s.name}</td>
                  <td style="padding: 10px; text-align: center; font-size: 14px; font-weight: 900; color: ${pColor}; background: #f8fafc;">${u.students}</td>
                  <td style="padding: 10px; text-align: center; font-weight: 600;">${u.studies}</td>
                  <td style="padding: 10px; text-align: center; font-weight: 600;">${u.classes}</td>
                  <td style="padding: 10px; text-align: center; font-weight: 600;">${u.groups}</td>
                  <td style="padding: 10px; text-align: center; font-weight: 800; background: #fff1f2; color: #be123c;">${u.visits}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  // PÁGINA 1
  let html = `
    <div class="pdf-page" style="width: 210mm; height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif; position: relative;">
      ${renderHeader()}
      ${renderTable(Unit.HAB)}
      ${renderTable(Unit.HABA)}
      
      <div style="margin-top: auto; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; padding-top: 20px; border-top: 2px solid #f1f5f9;">
        ${[
          {l: 'Total de Estudantes da Bíblia', v: totalStats.totalStudentsPeriod, c: '#dc2626'},
          {l: 'Estudos', v: totalStats.studies, c: '#3b82f6'},
          {l: 'Classes', v: totalStats.classes, c: '#6366f1'},
          {l: 'PGs', v: totalStats.groups, c: '#10b981'},
          {l: 'Visitas', v: totalStats.visits, c: '#e11d48'}
        ].map(i => `
          <div style="background: ${i.c}; color: white; padding: 12px; border-radius: 10px; text-align: center;">
            <div style="font-size: 18px; font-weight: 900;">${i.v}</div>
            <div style="font-size: 7px; font-weight: 900; text-transform: uppercase;">${i.l}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // PÁGINA 2
  html += `
    <div class="pdf-page" style="width: 210mm; height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif; position: relative;">
      ${renderHeader()}
      <h3 style="font-size: 16px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 25px; border-left: 5px solid ${pColor}; padding-left: 15px;">Desempenho Individual por Capelão</h3>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
        ${chaplainStats.map(s => {
          const metrics = [
            { label: 'Alunos', hab: s.hab.students, haba: s.haba.students },
            { label: 'Estudos', hab: s.hab.studies, haba: s.haba.studies },
            { label: 'Classes', hab: s.hab.classes, haba: s.haba.classes },
            { label: 'PGs', hab: s.hab.groups, haba: s.haba.groups },
            { label: 'Visitas', hab: s.hab.visits, haba: s.haba.visits }
          ];
          const max = Math.max(...metrics.map(m => m.hab + m.haba), 1);

          return `
            <div style="border: 1px solid #e2e8f0; border-radius: 15px; padding: 15px; background: #f8fafc;">
              <div style="font-size: 11px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 15px; text-align: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">${s.name}</div>
              <div style="display: flex; justify-content: space-around; align-items: flex-end; height: 120px; padding-top: 20px;">
                ${metrics.map(m => {
                  const hH = (m.hab / max) * 100;
                  const hHa = (m.haba / max) * 100;
                  const total = m.hab + m.haba;
                  return `
                    <div style="display: flex; flex-direction: column; align-items: center; width: 18%;">
                      <div style="font-size: 11px; font-weight: 900; margin-bottom: 4px; color: ${pColor};">${total}</div>
                      <div style="display: flex; align-items: flex-end; gap: 2px; height: 100px; width: 100%; background: #fff; border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0;">
                         <div style="width: 50%; height: ${hH}%; background: ${pColor};"></div>
                         <div style="width: 50%; height: ${hHa}%; background: #f97316;"></div>
                      </div>
                      <div style="font-size: 7px; font-weight: 800; text-transform: uppercase; margin-top: 5px; color: #64748b;">${m.label}</div>
                    </div>
                  `;
                }).join('')}
              </div>
              <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                 <div style="display: flex; align-items: center; gap: 4px;"><div style="width: 8px; height: 8px; background: ${pColor};"></div><span style="font-size: 7px; font-weight: bold;">HAB</span></div>
                 <div style="display: flex; align-items: center; gap: 4px;"><div style="width: 8px; height: 8px; background: #f97316;"></div><span style="font-size: 7px; font-weight: bold;">HABA</span></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  return html;
};
