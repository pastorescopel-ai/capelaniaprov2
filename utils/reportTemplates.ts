import { Config } from '../types';
import { DEFAULT_APP_LOGO } from '../assets';

export const getBrandedHeader = (config: Config, title: string, periodLabel: string) => {
  // O título passado agora será o destaque principal se for um dos relatórios fixos
  return `
    <div style="border-bottom: 4px solid ${config.primaryColor}; padding-bottom: 20px; margin-bottom: 30px; position: relative; min-height: 120px; display: flex; align-items: center;">
        <img src="${config.reportLogoUrl || DEFAULT_APP_LOGO}" style="width: ${config.reportLogoWidth}px; position: absolute; left: ${config.reportLogoX}px; top: ${config.reportLogoY}px;" />
        <div style="flex: 1; text-align: ${config.headerTextAlign}; padding-top: ${config.headerPaddingTop}px; margin-left: ${config.reportLogoWidth + 40}px;">
            <h1 style="font-size: ${config.fontSize1}px; color: ${config.primaryColor}; margin: 0; text-transform: uppercase; font-weight: 900; line-height: 1.1;">${title}</h1>
            <h2 style="font-size: ${config.fontSize2}px; color: #475569; margin: 5px 0 0 0; text-transform: uppercase; font-weight: 700;">${config.headerLine1}</h2>
            <h3 style="font-size: ${config.fontSize3}px; color: #94a3b8; margin: 2px 0 0 0; text-transform: uppercase; font-weight: 500;">${config.headerLine2}</h3>
            <p style="font-size: 10px; color: #64748b; text-transform: uppercase; margin: 8px 0 0 0; font-weight: bold; letter-spacing: 1px;">${periodLabel}</p>
        </div>
    </div>
  `;
};

export const getBrandedFooter = () => {
  return `
    <div style="text-align: center; border-top: 2px solid #f1f5f9; padding-top: 25px; margin-top: auto;">
        <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; color: #334155; margin-bottom: 2px;">Pr. Carlos Escopel</div>
        <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #94a3b8;">Diretor Espiritual - HAB/HABA</div>
    </div>
  `;
};

export const getStandardTable = (headers: string[], rows: string[][]) => {
  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <thead>
        <tr style="background-color: #f8fafc;">
          ${headers.map(h => `<th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #475569;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${row.map(cell => `<td style="border: 1px solid #e2e8f0; padding: 8px; font-size: 10px; color: #334155;">${cell}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};
