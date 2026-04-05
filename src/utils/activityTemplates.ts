
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
    <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
      ${getBrandedHeaderByProfile(config, 'chaplaincy', periodLabel)}
      
      <div style="padding: 0 20mm 20mm 20mm;">
        <div style="background: #f8fafc; padding: 25px 30px; border-left: 12px solid ${pColor}; border-radius: 0 20px 20px 0; margin-bottom: 35px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
          <h2 style="font-size: 28px; font-weight: 900; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: -0.025em;">Escala de Atividades</h2>
          <p style="font-size: 16px; color: #475569; margin: 0; font-weight: 800;">Capelão: <span style="color: ${pColor};">${chaplain.name}</span></p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 25px; margin-bottom: 40px;">
          ${days.slice(0, 3).map(day => {
            const dayActivities = getActivitiesForDay(day);
            return `
              <div style="border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <div style="background: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 16px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">${DAYS_LABELS[day]}</span>
                  <span style="font-size: 10px; color: #94a3b8; font-weight: bold;">${dayActivities.length} atividades</span>
                </div>
                <div style="padding: 20px;">
                  ${dayActivities.length === 0 ? `
                    <p style="font-size: 12px; color: #94a3b8; text-align: center; font-style: italic;">Nenhuma atividade agendada</p>
                  ` : `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
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
                          <div style="padding: 12px; border-radius: 12px; background: #f8fafc; border-left: 5px solid ${typeColor};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                              <span style="font-size: 9px; font-weight: 900; color: ${typeColor}; text-transform: uppercase; letter-spacing: 0.025em;">${typeLabel} | ${(s.period || 'tarde') === 'manha' ? 'Manhã' : 'Tarde'}</span>
                              ${s.time ? `<span style="font-size: 9px; font-weight: 800; color: #64748b;">${s.time}</span>` : ''}
                            </div>
                            <p style="font-size: 12px; font-weight: 800; color: #1e293b; margin: 0; text-transform: uppercase;">${locationName}</p>
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
        <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
          ${getBrandedFooter()}
        </div>
      </div>
    </div>

    <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6;">
      ${getBrandedHeaderByProfile(config, 'chaplaincy', `${periodLabel} (Cont.)`)}
      
      <div style="padding: 0 20mm 20mm 20mm;">
        <div style="display: grid; grid-template-columns: 1fr; gap: 25px; margin-bottom: 40px;">
          ${days.slice(3).map(day => {
            const dayActivities = getActivitiesForDay(day);
            return `
              <div style="border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <div style="background: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 16px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">${DAYS_LABELS[day]}</span>
                  <span style="font-size: 10px; color: #94a3b8; font-weight: bold;">${dayActivities.length} atividades</span>
                </div>
                <div style="padding: 20px;">
                  ${dayActivities.length === 0 ? `
                    <p style="font-size: 12px; color: #94a3b8; text-align: center; font-style: italic;">Nenhuma atividade agendada</p>
                  ` : `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                      ${dayActivities.map(s => {
                        let typeColor = '#6366f1';
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
                          <div style="padding: 12px; border-radius: 12px; background: #f8fafc; border-left: 5px solid ${typeColor};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                              <span style="font-size: 9px; font-weight: 900; color: ${typeColor}; text-transform: uppercase; letter-spacing: 0.025em;">${typeLabel} | ${(s.period || 'tarde') === 'manha' ? 'Manhã' : 'Tarde'}</span>
                              ${s.time ? `<span style="font-size: 9px; font-weight: 800; color: #64748b;">${s.time}</span>` : ''}
                            </div>
                            <p style="font-size: 12px; font-weight: 800; color: #1e293b; margin: 0; text-transform: uppercase;">${locationName}</p>
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

        <div style="margin-top: 30px; padding: 25px; border: 2px dashed #cbd5e1; border-radius: 24px; background: #f8fafc;">
          <h3 style="font-size: 14px; font-weight: 900; color: #64748b; text-transform: uppercase; margin: 0 0 15px 0; letter-spacing: 0.05em;">Observações da Escala</h3>
          <div style="height: 80px;"></div>
        </div>

        <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
          ${getBrandedFooter()}
        </div>
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
    <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6;">
      ${getBrandedHeaderByProfile(config, 'chaplaincy', periodLabel)}

      <div style="padding: 0 20mm 20mm 20mm;">
        <div style="background: #f8fafc; padding: 25px 30px; border-left: 12px solid ${pColor}; border-radius: 0 20px 20px 0; margin-bottom: 35px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
          <h2 style="font-size: 28px; font-weight: 900; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: -0.025em;">Checklist de Atividades</h2>
          <p style="font-size: 16px; color: #475569; margin: 0; font-weight: 800;">Capelão: <span style="color: ${pColor};">${chaplain.name}</span></p>
        </div>

        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 40px; margin-bottom: 40px;">
          <div style="display: flex; flex-direction: column; gap: 30px;">
            <div>
              <h3 style="font-size: 16px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 20px; border-bottom: 4px solid #f1f5f9; padding-bottom: 10px; letter-spacing: 0.05em;">Atividades Agendadas</h3>
              
              ${schedules.length === 0 ? `
                <p style="font-size: 13px; color: #94a3b8; font-style: italic; padding: 10px 0;">Nenhuma atividade agendada para hoje.</p>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  ${schedules.map(s => {
                    let locationName = s.location;
                    if (s.activityType === 'cult') {
                      locationName = sectors.find(sec => sec.id === s.location)?.name || s.location;
                    }
                    return `
                      <div style="display: flex; align-items: center; gap: 15px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 16px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <div style="width: 24px; height: 24px; border: 2.5px solid #cbd5e1; border-radius: 6px;"></div>
                        <div style="flex: 1;">
                          <p style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 0; text-transform: uppercase;">${locationName}</p>
                          <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.025em;">
                            ${s.activityType} | ${(s.period || 'tarde') === 'manha' ? 'Manhã' : 'Tarde'} ${s.time ? `| ${s.time}` : ''}
                          </span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>

            <div>
              <h3 style="font-size: 16px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 20px; border-bottom: 4px solid #f1f5f9; padding-bottom: 10px; letter-spacing: 0.05em;">Outras Atividades</h3>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${[1, 2, 3].map(() => `
                  <div style="display: flex; align-items: center; gap: 15px; padding: 15px; border: 1px dashed #cbd5e1; border-radius: 16px; background: #f8fafc;">
                    <div style="width: 24px; height: 24px; border: 2.5px solid #cbd5e1; border-radius: 6px;"></div>
                    <div style="flex: 1; height: 16px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0;"></div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 30px;">
            <div>
              <h3 style="font-size: 16px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 20px; border-bottom: 4px solid #f1f5f9; padding-bottom: 10px; letter-spacing: 0.05em;">Visitas Realizadas</h3>
              <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                ${['Paliativos', 'Cirúrgicos', 'Pediátricos', 'UTI'].map(label => `
                  <div style="background: #f8fafc; padding: 18px; border-radius: 20px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <span style="font-size: 12px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">${label}</span>
                    <div style="width: 50px; height: 35px; background: white; border: 1px solid #cbd5e1; border-radius: 10px;"></div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div>
              <h3 style="font-size: 16px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 20px; border-bottom: 4px solid #f1f5f9; padding-bottom: 10px; letter-spacing: 0.05em;">Observações</h3>
              <div style="height: 180px; border: 1px solid #e2e8f0; border-radius: 20px; background: #f8fafc; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);"></div>
            </div>
          </div>
        </div>

        <div style="margin-top: 60px; text-align: center; border-top: 4px solid #f1f5f9; padding-top: 30px;">
          <div style="display: inline-block; width: 300px; border-top: 2px solid #1e293b; margin-top: 40px; padding-top: 10px;">
            <p style="font-size: 14px; font-weight: 900; color: #1e293b; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${chaplain.name}</p>
            <p style="font-size: 10px; font-weight: 800; color: #64748b; margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">Capelão Responsável</p>
          </div>
        </div>

        <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
          ${getBrandedFooter()}
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
    <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6;">
      ${getBrandedHeaderByProfile(config, 'chaplaincy', periodLabel)}

      <div style="padding: 0 20mm 20mm 20mm;">
        <div style="background: #f8fafc; padding: 25px 30px; border-left: 12px solid ${pColor}; border-radius: 0 20px 20px 0; margin-bottom: 35px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <h2 style="font-size: 28px; font-weight: 900; color: #0f172a; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: -0.025em;">Relatório Diário</h2>
          <p style="font-size: 16px; color: #475569; margin: 0; font-weight: 800;">Capelão: <span style="color: ${pColor};">${chaplain.name}</span></p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px;">
          <div style="background: #eff6ff; padding: 20px; border-radius: 20px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <p style="font-size: 10px; font-weight: 900; color: #3b82f6; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.05em;">Total Atividades</p>
            <p style="font-size: 32px; font-weight: 900; color: #1e3a8a; margin: 0; line-height: 1;">${stats.totalActivities}</p>
          </div>
          <div style="background: #ecfdf5; padding: 20px; border-radius: 20px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <p style="font-size: 10px; font-weight: 900; color: #10b981; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.05em;">Total Visitas</p>
            <p style="font-size: 32px; font-weight: 900; color: #064e3b; margin: 0; line-height: 1;">${stats.totalVisits}</p>
          </div>
          <div style="background: #fff7ed; padding: 20px; border-radius: 20px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <p style="font-size: 10px; font-weight: 900; color: #f97316; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.05em;">Blueprint</p>
            <p style="font-size: 32px; font-weight: 900; color: #7c2d12; margin: 0; line-height: 1;">${stats.blueprintCount}</p>
          </div>
          <div style="background: #fdf2f8; padding: 20px; border-radius: 20px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <p style="font-size: 10px; font-weight: 900; color: #ec4899; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.05em;">Setores</p>
            <p style="font-size: 32px; font-weight: 900; color: #831843; margin: 0; line-height: 1;">${stats.cultCount}</p>
          </div>
        </div>

        <div style="margin-bottom: 40px;">
          <h3 style="font-size: 16px; font-weight: 900; color: #1e293b; text-transform: uppercase; margin-bottom: 20px; border-bottom: 4px solid #f1f5f9; padding-bottom: 10px; letter-spacing: 0.05em;">Detalhamento de Visitas</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 15px 20px; text-align: left; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; color: #475569; font-weight: 900; letter-spacing: 0.05em;">Tipo de Visita</th>
                <th style="padding: 15px 20px; text-align: center; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; color: #475569; font-weight: 900; letter-spacing: 0.05em;">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${visits.map(v => `
                <tr>
                  <td style="padding: 15px 20px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #334155;">${v.label}</td>
                  <td style="padding: 15px 20px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 900; color: #0f172a; font-size: 15px;">${v.value}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${stats.observations ? `
          <div style="margin-top: 40px; padding: 30px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.01);">
            <h3 style="font-size: 14px; font-weight: 900; color: #92400e; text-transform: uppercase; margin: 0 0 15px 0; letter-spacing: 0.05em;">Observações Adicionais</h3>
            <p style="font-size: 14px; color: #b45309; margin: 0; line-height: 1.8; font-weight: 500; font-style: italic;">"${stats.observations}"</p>
          </div>
        ` : ''}

        <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
          ${getBrandedFooter()}
        </div>
      </div>
    </div>
  `;
};
