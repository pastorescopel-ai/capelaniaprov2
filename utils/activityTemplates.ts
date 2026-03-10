
import { Config, Unit, ActivitySchedule, User, ProSector } from '../types';
import { getBrandedHeaderByProfile } from './reportTemplates';

const DAYS_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const generateMonthlyScheduleHTML = (
  config: Config,
  month: string,
  unit: Unit,
  chaplain: User,
  schedules: ActivitySchedule[],
  sectors: ProSector[]
) => {
  const pColor = config.primaryColor || '#005a9c';
  const monthDate = new Date(month + 'T12:00:00');
  const monthLabel = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const periodLabel = `Escala Mensal: ${monthLabel} | Unidade ${unit}`;

  const days = [1, 2, 3, 4, 5, 6]; // Segunda a Sábado

  const getActivitiesForDay = (dayOfWeek: number) => {
    return schedules.filter(s => s.dayOfWeek === dayOfWeek);
  };

  return `
    <div class="pdf-page" style="width: 210mm; min-height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif;">
      ${getBrandedHeaderByProfile(config, 'chaplaincy', periodLabel)}
      
      <div style="background: #f8fafc; padding: 20px; border-left: 8px solid ${pColor}; border-radius: 0 12px 12px 0; margin-bottom: 25px;">
        <h2 style="font-size: 20px; font-weight: 900; color: #1e293b; margin: 0 0 5px 0; text-transform: uppercase;">Escala de Atividades</h2>
        <p style="font-size: 14px; color: #475569; margin: 0; font-weight: bold;">Capelão: <span style="color: ${pColor};">${chaplain.name}</span></p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
        ${days.map(day => {
          const dayActivities = getActivitiesForDay(day);
          return `
            <div style="border: 1px solid #e2e8f0; border-radius: 15px; overflow: hidden; background: white;">
              <div style="background: #f1f5f9; padding: 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                <span style="font-size: 10px; font-weight: 900; color: #475569; text-transform: uppercase;">${DAYS_LABELS[day]}</span>
              </div>
              <div style="padding: 10px; min-height: 100px;">
                ${dayActivities.length === 0 ? `
                  <p style="font-size: 9px; color: #94a3b8; text-align: center; font-style: italic; margin-top: 20px;">Nenhuma atividade</p>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${dayActivities.map(s => {
                      let typeColor = '#6366f1'; // Blueprint
                      let typeLabel = 'Blueprint';
                      let locationName = s.location;

                      if (s.activityType === 'cult') {
                        typeColor = '#10b981';
                        typeLabel = 'Setor';
                        locationName = sectors.find(sec => sec.id === s.location)?.name || s.location;
                      } else if (s.activityType === 'encontro') {
                        typeColor = '#f59e0b';
                        typeLabel = 'Encontro';
                      } else if (s.activityType === 'visiteCantando') {
                        typeColor = '#f43f5e';
                        typeLabel = 'Visite Cantando';
                      }

                      return `
                        <div style="padding: 6px; border-radius: 6px; background: #f8fafc; border-left: 3px solid ${typeColor};">
                          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                            <span style="font-size: 7px; font-weight: 900; color: ${typeColor}; text-transform: uppercase;">${typeLabel}</span>
                            ${s.time ? `<span style="font-size: 7px; font-weight: bold; color: #64748b;">${s.time}</span>` : ''}
                          </div>
                          <p style="font-size: 9px; font-weight: 700; color: #1e293b; margin: 0; text-transform: uppercase;">${locationName}</p>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="margin-top: 40px; padding: 20px; border: 1px dashed #cbd5e1; border-radius: 15px;">
        <h3 style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; margin: 0 0 10px 0;">Observações da Escala</h3>
        <div style="height: 100px;"></div>
      </div>
    </div>
  `;
};

export const generateDailyChecklistHTML = (
  config: Config,
  date: string,
  chaplain: User,
  schedules: ActivitySchedule[],
  sectors: ProSector[]
) => {
  const pColor = config.primaryColor || '#005a9c';
  const dateObj = new Date(date + 'T12:00:00');
  const dateLabel = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' });
  const periodLabel = `Checklist Diário: ${dateLabel}`;

  return `
    <div class="pdf-page" style="width: 210mm; min-height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif;">
      ${getBrandedHeaderByProfile(config, 'chaplaincy', periodLabel)}

      <div style="background: #f8fafc; padding: 20px; border-left: 8px solid ${pColor}; border-radius: 0 12px 12px 0; margin-bottom: 25px;">
        <h2 style="font-size: 20px; font-weight: 900; color: #1e293b; margin: 0 0 5px 0; text-transform: uppercase;">Checklist de Atividades</h2>
        <p style="font-size: 14px; color: #475569; margin: 0; font-weight: bold;">Capelão: <span style="color: ${pColor};">${chaplain.name}</span></p>
      </div>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px;">
        <div style="space-y-20px;">
          <h3 style="font-size: 12px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 5px;">Atividades Agendadas</h3>
          
          ${schedules.length === 0 ? `
            <p style="font-size: 11px; color: #94a3b8; font-style: italic;">Nenhuma atividade agendada para hoje.</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${schedules.map(s => {
                let locationName = s.location;
                if (s.activityType === 'cult') {
                  locationName = sectors.find(sec => sec.id === s.location)?.name || s.location;
                }
                return `
                  <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <div style="width: 20px; height: 20px; border: 2px solid #cbd5e1; border-radius: 4px;"></div>
                    <div style="flex: 1;">
                      <p style="font-size: 11px; font-weight: 900; color: #1e293b; margin: 0; text-transform: uppercase;">${locationName}</p>
                      <span style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase;">${s.activityType} ${s.time ? `| ${s.time}` : ''}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}

          <div style="margin-top: 30px;">
            <h3 style="font-size: 12px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 5px;">Outras Atividades</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${[1, 2, 3].map(() => `
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px dashed #cbd5e1; border-radius: 12px;">
                  <div style="width: 20px; height: 20px; border: 2px solid #cbd5e1; border-radius: 4px;"></div>
                  <div style="flex: 1; height: 12px; background: #f8fafc; border-radius: 4px;"></div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div>
          <h3 style="font-size: 12px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 5px;">Visitas Realizadas</h3>
          <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">
            ${['Paliativos', 'Cirúrgicos', 'Pediátricos', 'UTI'].map(label => `
              <div style="background: #f8fafc; padding: 15px; border-radius: 15px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; font-weight: 900; color: #475569; text-transform: uppercase;">${label}</span>
                <div style="width: 40px; height: 30px; background: white; border: 1px solid #cbd5e1; border-radius: 8px;"></div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: 30px;">
            <h3 style="font-size: 12px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 5px;">Observações</h3>
            <div style="height: 150px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc;"></div>
          </div>
        </div>
      </div>

      <div style="margin-top: 50px; text-align: center; border-top: 2px solid #f1f5f9; padding-top: 20px;">
        <div style="display: inline-block; width: 250px; border-top: 1px solid #1e293b; margin-top: 30px; padding-top: 5px;">
          <p style="font-size: 10px; font-weight: 900; color: #1e293b; margin: 0; text-transform: uppercase;">${chaplain.name}</p>
          <p style="font-size: 8px; font-weight: bold; color: #64748b; margin: 0; text-transform: uppercase;">Capelão Responsável</p>
        </div>
      </div>
    </div>
  `;
};

export const generateActivityReportHTML = (
  config: Config,
  date: string,
  chaplain: User,
  stats: any,
  visits: any[]
) => {
  const pColor = config.primaryColor || '#005a9c';
  const dateObj = new Date(date + 'T12:00:00');
  const dateLabel = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' });
  const periodLabel = `Relatório de Atividades: ${dateLabel}`;

  return `
    <div class="pdf-page" style="width: 210mm; min-height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif;">
      ${getBrandedHeaderByProfile(config, 'chaplaincy', periodLabel)}

      <div style="background: #f8fafc; padding: 20px; border-left: 8px solid ${pColor}; border-radius: 0 12px 12px 0; margin-bottom: 25px;">
        <h2 style="font-size: 20px; font-weight: 900; color: #1e293b; margin: 0 0 5px 0; text-transform: uppercase;">Relatório Diário</h2>
        <p style="font-size: 14px; color: #475569; margin: 0; font-weight: bold;">Capelão: <span style="color: ${pColor};">${chaplain.name}</span></p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
        <div style="background: #eff6ff; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="font-size: 8px; font-weight: 900; color: #3b82f6; text-transform: uppercase; margin: 0 0 5px 0;">Total Atividades</p>
          <p style="font-size: 24px; font-weight: 900; color: #1e3a8a; margin: 0;">${stats.totalActivities}</p>
        </div>
        <div style="background: #ecfdf5; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="font-size: 8px; font-weight: 900; color: #10b981; text-transform: uppercase; margin: 0 0 5px 0;">Total Visitas</p>
          <p style="font-size: 24px; font-weight: 900; color: #064e3b; margin: 0;">${stats.totalVisits}</p>
        </div>
        <div style="background: #fff7ed; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="font-size: 8px; font-weight: 900; color: #f97316; text-transform: uppercase; margin: 0 0 5px 0;">Blueprint</p>
          <p style="font-size: 24px; font-weight: 900; color: #7c2d12; margin: 0;">${stats.blueprintCount}</p>
        </div>
        <div style="background: #fdf2f8; padding: 15px; border-radius: 12px; text-align: center;">
          <p style="font-size: 8px; font-weight: 900; color: #ec4899; text-transform: uppercase; margin: 0 0 5px 0;">Setores</p>
          <p style="font-size: 24px; font-weight: 900; color: #831843; margin: 0;">${stats.cultCount}</p>
        </div>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="font-size: 12px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 5px;">Detalhamento de Visitas</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0; text-transform: uppercase;">Tipo</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e2e8f0; text-transform: uppercase;">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            ${visits.map(v => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #475569;">${v.label}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 900; color: #1e293b;">${v.value}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${stats.observations ? `
        <div style="margin-top: 30px; padding: 20px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 15px;">
          <h3 style="font-size: 10px; font-weight: 900; color: #92400e; text-transform: uppercase; margin: 0 0 10px 0;">Observações</h3>
          <p style="font-size: 11px; color: #b45309; margin: 0; line-height: 1.6;">${stats.observations}</p>
        </div>
      ` : ''}

      <div style="margin-top: 50px; text-align: center; border-top: 2px solid #f1f5f9; padding-top: 20px;">
        <div style="display: inline-block; width: 250px; border-top: 1px solid #1e293b; margin-top: 30px; padding-top: 5px;">
          <p style="font-size: 10px; font-weight: 900; color: #1e293b; margin: 0; text-transform: uppercase;">${chaplain.name}</p>
          <p style="font-size: 8px; font-weight: bold; color: #64748b; margin: 0; text-transform: uppercase;">Capelão Responsável</p>
        </div>
      </div>
    </div>
  `;
};
