
import { getBrandedHeaderByProfile, getBrandedFooter } from './reportTemplates';
import { normalizeString } from './formatters';

export function generateSectorHtml(data: any, config: any, reportHeaderInfo: any) {
    const enrolledByPG = data.enrolledByPG || [];
    const notEnrolledList = data.notEnrolledList || [];
    
    let html = '';
    
    // Page 1: Summary and first batch of PGs
    html += `
      <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
          ${getBrandedHeaderByProfile(config, 'smallGroups', reportHeaderInfo.periodLabel)}
          
          <div style="padding: 0 20mm 20mm 20mm;">
            <div style="background: #f8fafc; padding: 30px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 35px; border-radius: 0 25px 25px 0; border-left: 15px solid ${config.primaryColor}; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                <span style="font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em; color: #0f172a;">${data.sector.name}</span>
                <span style="font-size: 16px; font-weight: 900; padding: 12px 28px; border-radius: 16px; color: white; background: ${data.coverage >= 80 ? '#10b981' : data.coverage >= 50 ? '#f59e0b' : '#f43f5e'}; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    ${Math.round(data.coverage)}% Cobertura
                </span>
            </div>

            <div style="display: flex; gap: 30px; margin-bottom: 45px;">
                <div style="flex: 1; background: #fff; border: 1px solid #e2e8f0; padding: 30px; border-radius: 28px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <span style="font-size: 42px; font-weight: 900; display: block; color: #0f172a; line-height: 1;">${data.totalStaff}</span>
                    <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 800; margin-top: 10px; letter-spacing: 0.1em; display: block;">Colaboradores</span>
                </div>
                <div style="flex: 1; background: #fff; border: 1px solid #e2e8f0; padding: 30px; border-radius: 28px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <span style="font-size: 42px; font-weight: 900; display: block; color: #0f172a; line-height: 1;">${data.enrolledCount}</span>
                    <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 800; margin-top: 10px; letter-spacing: 0.1em; display: block;">Matriculados</span>
                </div>
                <div style="flex: 1; background: #fff; border: 1px solid #e2e8f0; padding: 30px; border-radius: 28px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <span style="font-size: 42px; font-weight: 900; display: block; color: #0f172a; line-height: 1;">${data.pgs.length}</span>
                    <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 800; margin-top: 10px; letter-spacing: 0.1em; display: block;">PGs Atuantes</span>
                </div>
            </div>

            <div style="margin-bottom: 45px;">
                <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 25px; color: #475569; letter-spacing: 0.05em;">Pequenos Grupos do Setor</div>
                <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                    ${data.pgs.length > 0 ? data.pgs.map((pg:any) => `<span style="background: #f0f9ff; color: #0369a1; padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 800; text-transform: uppercase; border: 1px solid #bae6fd;">${pg?.name}</span>`).join('') : '<span style="font-size: 13px; color: #94a3b8; font-style: italic;">Nenhum PG vinculado.</span>'}
                </div>
            </div>

            <div style="display: flex; gap: 60px; align-items: flex-start;">
                <div style="flex: 1;">
                    <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #d1fae5; padding-bottom: 12px; margin-bottom: 20px; color: #10b981; letter-spacing: 0.05em;">Matriculados (${data.enrolledList.length})</div>
                    ${enrolledByPG.slice(0, 3).map((group: any) => {
                        const leaderInSector = group.members.find((m: any) => normalizeString(m.name) === normalizeString(group.leaderName || ''));
                        const leaderInfo = !leaderInSector 
                          ? (group.leaderName ? ` (Líder: ${group.leaderName})` : ' (Sem Líder)')
                          : '';
                        
                        return `
                        <div style="margin-top: 20px; margin-bottom: 10px;">
                            <span style="font-size: 11px; font-weight: 900; color: #059669; background: #ecfdf5; padding: 6px 16px; border-radius: 10px; text-transform: uppercase; border: 1px solid #d1fae5; letter-spacing: 0.05em; display: inline-block;">
                              ${group.pgName}${leaderInfo}
                            </span>
                        </div>
                        ${group.members.map((s: any) => {
                            const isLeader = normalizeString(s.name) === normalizeString(group.leaderName || '');
                            const isProvider = s.type === 'provider';
                            return `<div style="font-size: 13px; padding: 8px 0 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 500; display: flex; align-items: center; gap: 10px;">
                              <span style="flex: 1;">${s.name}${isLeader ? ' <span style="font-weight: 900; color: #059669; font-size: 11px; margin-left: 6px;">(LÍDER)</span>' : ''}</span>
                              ${isProvider ? '<span style="font-size: 9px; background: #dcfce7; color: #166534; padding: 3px 10px; border-radius: 8px; font-weight: 900; letter-spacing: 0.05em;">PRESTADOR</span>' : ''}
                            </div>`;
                        }).join('')}
                    `;}).join('')}
                    ${enrolledByPG.length > 3 ? `<p style="font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 15px;">Continua na próxima página...</p>` : ''}
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #ffe4e6; padding-bottom: 12px; margin-bottom: 20px; color: #f43f5e; letter-spacing: 0.05em;">Não Alcançados (${data.notEnrolledList.length})</div>
                    ${notEnrolledList.slice(0, 15).map((s:any) => `<div style="font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 500;">${s.name}</div>`).join('')}
                    ${notEnrolledList.length > 15 ? `<p style="font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 15px;">Continua na próxima página...</p>` : ''}
                </div>
            </div>
            <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
              ${getBrandedFooter()}
            </div>
          </div>
      </div>
    `;

    // Subsequent pages
    if (enrolledByPG.length > 3) {
      const remainingPGs = enrolledByPG.slice(3);
      const chunks = [];
      for (let i = 0; i < remainingPGs.length; i += 4) {
        chunks.push(remainingPGs.slice(i, i + 4));
      }

      chunks.forEach((chunk) => {
        html += `
          <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
            ${getBrandedHeaderByProfile(config, 'smallGroups', `${reportHeaderInfo.periodLabel} (Continuação)`)}
            <div style="padding: 0 20mm 20mm 20mm;">
              <h3 style="font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #d1fae5; padding-bottom: 12px; margin-bottom: 20px; color: #10b981; letter-spacing: 0.05em;">Matriculados (Continuação)</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
                ${chunk.map((group: any) => `
                  <div>
                    <div style="margin-top: 10px; margin-bottom: 10px;">
                        <span style="font-size: 11px; font-weight: 900; color: #059669; background: #ecfdf5; padding: 6px 16px; border-radius: 10px; text-transform: uppercase; border: 1px solid #d1fae5; letter-spacing: 0.05em; display: inline-block;">
                          ${group.pgName}
                        </span>
                    </div>
                    ${group.members.map((s: any) => `
                      <div style="font-size: 12px; padding: 6px 0 6px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 500;">
                        ${s.name}
                      </div>
                    `).join('')}
                  </div>
                `).join('')}
              </div>
              <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
                ${getBrandedFooter()}
              </div>
            </div>
          </div>
        `;
      });
    }

    if (notEnrolledList.length > 15) {
      const remainingNotEnrolled = notEnrolledList.slice(15);
      const chunks = [];
      for (let i = 0; i < remainingNotEnrolled.length; i += 40) {
        chunks.push(remainingNotEnrolled.slice(i, i + 40));
      }

      chunks.forEach((chunk) => {
        html += `
          <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
            ${getBrandedHeaderByProfile(config, 'smallGroups', `${reportHeaderInfo.periodLabel} (Continuação)`)}
            <div style="padding: 0 20mm 20mm 20mm;">
              <h3 style="font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #ffe4e6; padding-bottom: 12px; margin-bottom: 20px; color: #f43f5e; letter-spacing: 0.05em;">Não Alcançados (Continuação)</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
                <div>
                  ${chunk.slice(0, 20).map((s:any) => `<div style="font-size: 12px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 500;">${s.name}</div>`).join('')}
                </div>
                <div>
                  ${chunk.slice(20).map((s:any) => `<div style="font-size: 12px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 500;">${s.name}</div>`).join('')}
                </div>
              </div>
              <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
                ${getBrandedFooter()}
              </div>
            </div>
          </div>
        `;
      });
    }

    return html;
};

export function generateActivityReportHtml(reportData: any[], allGroups: any[], proHistoryRecords: any[], unit: string, startDate: string, reportHeaderInfo: any, config: any) {
    const sDate = new Date(startDate + 'T12:00:00');
    const activePGs: any[] = [];
    const inactivePGs: any[] = [];
    let totalMembersInvolved = 0;
    let totalStaffInSector = 0;

    const prevMonthDate = new Date(sDate.getFullYear(), sDate.getMonth() - 1, 1);
    const prevMonthStr = prevMonthDate.toISOString().split('T')[0];
    const historyPrevMonth = proHistoryRecords.filter(r => r.month === prevMonthStr && r.unit === unit);

    const prevActivePGNames = new Set<string>();
    if (historyPrevMonth.length > 0) {
      historyPrevMonth.forEach(r => {
        if (r.isEnrolled && r.groupName) prevActivePGNames.add(normalizeString(r.groupName));
      });
    }

    reportData.forEach(sectorData => {
      totalStaffInSector += sectorData.totalStaff;
      sectorData.enrolledByPG.forEach((pg: any) => {
        totalMembersInvolved += pg.members.length;
      });
    });

    allGroups.forEach(group => {
      let memberCount = 0;
      reportData.forEach(sectorData => {
        const pgData = sectorData.enrolledByPG.find((pg: any) => normalizeString(pg.pgName) === normalizeString(group.name));
        if (pgData) {
          memberCount += pgData.members.length;
        }
      });

      if (memberCount > 0) {
        activePGs.push({ ...group, memberCount });
      } else {
        inactivePGs.push({ ...group, memberCount: 0 });
      }
    });

    const currentActivePGNames = new Set(activePGs.map(pg => normalizeString(pg.name)));
    const newPGs = activePGs.filter(pg => !prevActivePGNames.has(normalizeString(pg.name)));
    const inactivatedPGs = Array.from(prevActivePGNames)
      .filter(name => !currentActivePGNames.has(name))
      .map(name => allGroups.find(g => normalizeString(g.name) === name))
      .filter(g => !!g);

    const renderPGGrid = (pgs: any[], color: string, bgColor: string, borderColor: string) => {
      const chunks = [];
      for (let i = 0; i < pgs.length; i += 16) {
        chunks.push(pgs.slice(i, i + 16));
      }

      return chunks.map((chunk, idx) => `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; ${idx > 0 ? 'margin-top: 30px;' : ''}">
          ${chunk.map(pg => `
            <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 15px 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; page-break-inside: avoid; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <span style="font-size: 13px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: -0.01em;">${pg.name}</span>
              ${pg.memberCount > 0 ? `
                <span style="font-size: 12px; font-weight: 900; background: #fff; color: ${color}; padding: 6px 12px; border-radius: 10px; border: 1px solid ${borderColor};">
                  ${pg.memberCount} ${pg.memberCount === 1 ? 'membro' : 'membros'}
                </span>
              ` : `
                <span style="font-size: 10px; font-weight: 900; color: #f43f5e; letter-spacing: 0.05em; background: #fff1f2; padding: 4px 10px; border-radius: 8px; border: 1px solid #fecdd3;">INATIVO</span>
              `}
            </div>
          `).join('')}
        </div>
      `).join('');
    };

    let html = '';

    html += `
      <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
          ${getBrandedHeaderByProfile(config, 'smallGroups', `Relatório de Atividade - ${reportHeaderInfo.periodLabel}`)}
          <div style="padding: 0 20mm 20mm 20mm;">
            
            <div style="display: flex; gap: 20px; margin-bottom: 40px;">
                <div style="flex: 1; background: #f0f9ff; border: 1px solid #bae6fd; padding: 20px; border-radius: 20px; text-align: center;">
                    <span style="font-size: 28px; font-weight: 900; display: block; color: #0369a1;">${activePGs.length}</span>
                    <span style="font-size: 10px; text-transform: uppercase; color: #0369a1; font-weight: 800; letter-spacing: 0.05em;">PGs Ativos</span>
                    <span style="font-size: 8px; color: #64748b; font-weight: 600; display: block; margin-top: 4px;">De ${allGroups.length} cadastrados</span>
                </div>
                <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 20px; text-align: center;">
                    <span style="font-size: 28px; font-weight: 900; display: block; color: #166534;">${totalStaffInSector}</span>
                    <span style="font-size: 10px; text-transform: uppercase; color: #166534; font-weight: 800; letter-spacing: 0.05em;">Total Colaboradores</span>
                </div>
                <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 20px; text-align: center;">
                    <span style="font-size: 28px; font-weight: 900; display: block; color: #991b1b;">${totalMembersInvolved}</span>
                    <span style="font-size: 10px; text-transform: uppercase; color: #991b1b; font-weight: 800; letter-spacing: 0.05em;">Membros Matriculados</span>
                </div>
            </div>

            <div style="font-size: 18px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #10b981; padding-bottom: 15px; margin-bottom: 25px; color: #059669; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.05em;">
              <span>Pequenos Grupos Ativos</span>
              <span style="font-size: 14px; background: #ecfdf5; padding: 6px 16px; border-radius: 24px; border: 1px solid #d1fae5;">${activePGs.length} Grupos</span>
            </div>
            ${renderPGGrid(activePGs.slice(0, 12), '#059669', '#f0fdf4', '#d1fae5')}
            
            <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
              ${getBrandedFooter()}
            </div>
          </div>
      </div>
    `;

    if (activePGs.length > 12) {
      const remainingActive = activePGs.slice(12);
      const chunks = [];
      for (let i = 0; i < remainingActive.length; i += 20) {
        chunks.push(remainingActive.slice(i, i + 20));
      }
      chunks.forEach((chunk) => {
        html += `
          <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
              ${getBrandedHeaderByProfile(config, 'smallGroups', `PGs Ativos (Cont.) - ${reportHeaderInfo.periodLabel}`)}
              <div style="padding: 0 20mm 20mm 20mm;">
                ${renderPGGrid(chunk, '#059669', '#f0fdf4', '#d1fae5')}
                <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
                  ${getBrandedFooter()}
                </div>
              </div>
          </div>
        `;
      });
    }

    if (newPGs.length > 0 || inactivatedPGs.length > 0) {
      html += `
        <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
            ${getBrandedHeaderByProfile(config, 'smallGroups', `Comparativo Mensal - ${reportHeaderInfo.periodLabel}`)}
            <div style="padding: 0 20mm 20mm 20mm;">
              <div style="margin-bottom: 40px;">
                <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; color: #1d4ed8;">Novos Pequenos Grupos (Surgiram este mês)</div>
                ${newPGs.length > 0 ? `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    ${newPGs.map(pg => `<div style="padding: 12px; background: #eff6ff; border-radius: 12px; font-size: 12px; font-weight: 800; color: #1e40af; border: 1px solid #bfdbfe;">${pg.name}</div>`).join('')}
                  </div>
                ` : '<p style="font-size: 12px; color: #94a3b8; font-style: italic;">Nenhum novo PG identificado.</p>'}
              </div>

              <div>
                <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #f43f5e; padding-bottom: 10px; margin-bottom: 20px; color: #be123c;">PGs Inativados (Em relação ao mês anterior)</div>
                ${inactivatedPGs.length > 0 ? `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    ${inactivatedPGs.map(pg => `<div style="padding: 12px; background: #fff1f2; border-radius: 12px; font-size: 12px; font-weight: 800; color: #9f1239; border: 1px solid #fecdd3;">${pg?.name}</div>`).join('')}
                  </div>
                ` : '<p style="font-size: 12px; color: #94a3b8; font-style: italic;">Nenhum PG inativado este mês.</p>'}
              </div>

              <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
                ${getBrandedFooter()}
              </div>
            </div>
        </div>
      `;
    }

    const inactiveChunks = [];
    for (let i = 0; i < inactivePGs.length; i += 20) {
      inactiveChunks.push(inactivePGs.slice(i, i + 20));
    }

    inactiveChunks.forEach((chunk, idx) => {
      html += `
        <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
            ${getBrandedHeaderByProfile(config, 'smallGroups', `Relatório de Atividade - ${reportHeaderInfo.periodLabel} ${idx > 0 ? '(Cont.)' : ''}`)}
            <div style="padding: 0 20mm 20mm 20mm;">
              <div style="font-size: 18px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #94a3b8; padding-bottom: 15px; margin-bottom: 30px; color: #475569; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.05em;">
                <span>Pequenos Grupos Inativos ${idx > 0 ? '(Continuação)' : ''}</span>
                ${idx === 0 ? `<span style="font-size: 14px; background: #f8fafc; padding: 6px 16px; border-radius: 24px; border: 1px solid #e2e8f0;">${inactivePGs.length} Grupos</span>` : ''}
              </div>
              ${renderPGGrid(chunk, '#64748b', '#f8fafc', '#e2e8f0')}
              <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
                ${getBrandedFooter()}
              </div>
            </div>
        </div>
      `;
    });

    return html;
}

export function generateNoLeaderReportHtml(proGroups: any[], proGroupMembers: any[], proGroupProviderMembers: any[], unit: string, reportHeaderInfo: any, config: any) {
    const noLeaderPGs = proGroups.filter(g => {
        if (g.unit !== unit) return false;
        const hasMembers = proGroupMembers.some(m => m.groupId === g.id && !m.leftAt) ||
                           proGroupProviderMembers.some(m => m.groupId === g.id && !m.leftAt);
        return hasMembers && (!g.currentLeader || g.currentLeader.trim() === '');
    }).sort((a, b) => a.name.localeCompare(b.name));

    const html = `
      <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always;">
          ${getBrandedHeaderByProfile(config, 'smallGroups', `PGs Ativos Sem Líderes - ${reportHeaderInfo.periodLabel}`)}
          <div style="padding: 0 20mm 20mm 20mm;">
            <div style="font-size: 18px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid #f43f5e; padding-bottom: 15px; margin-bottom: 30px; color: #be123c; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.05em;">
              <span>Pequenos Grupos Ativos Sem Líderes</span>
              <span style="font-size: 14px; background: #fff1f2; padding: 6px 16px; border-radius: 24px; border: 1px solid #fecdd3;">${noLeaderPGs.length} Grupos</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              ${noLeaderPGs.map(pg => `
                <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 15px 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; page-break-inside: avoid; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                  <span style="font-size: 13px; font-weight: 800; color: #9f1239; text-transform: uppercase; letter-spacing: -0.01em;">${pg.name}</span>
                </div>
              `).join('')}
            </div>
            <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
              ${getBrandedFooter()}
            </div>
          </div>
      </div>
    `;
    return html;
}

export function generateLeadersReportHtml(proGroups: any[], proStaff: any[], proSectors: any[], unit: string, reportHeaderInfo: any, config: any) {
    const list = proGroups
        .filter(g => g.unit === unit && g.active !== false)
        .map(g => {
            const leaderName = g.currentLeader || g.leader || 'Sem Líder Definido';
            const staff = proStaff.find(s => 
                s.unit === unit && 
                normalizeString(s.name) === normalizeString(leaderName)
            );
            let sector = null;
            if (staff && staff.sectorId) {
                sector = proSectors.find(sec => sec.id === staff.sectorId);
            }
            if (!sector && g.sectorId) {
                sector = proSectors.find(sec => sec.id === g.sectorId);
            }
            
            const leaderPhone = staff?.whatsapp || g.leaderPhone || '-';
            
            return {
                pgName: g.name,
                leaderName: leaderName,
                leaderPhone: leaderPhone,
                sectorName: sector ? sector.name : 'Sem Setor Definido'
            };
        })
        .sort((a, b) => a.leaderName.localeCompare(b.leaderName));

    const itemsPerPage = 18;
    const pages: any[][] = [];
    for (let i = 0; i < list.length; i += itemsPerPage) {
        pages.push(list.slice(i, i + itemsPerPage));
    }

    if (pages.length === 0) {
        pages.push([]);
    }

    let html = '';
    pages.forEach((pageItems, pageIdx) => {
        html += `
          <div class="pdf-page" style="width: 210mm; min-height: 297mm; background: white; box-sizing: border-box; font-family: 'Inter', sans-serif; color: #1e293b; display: block; overflow: hidden; line-height: 1.6; page-break-after: always; position: relative;">
              ${getBrandedHeaderByProfile(config, 'smallGroups', `Relação de Líderes por Setor - ${reportHeaderInfo.periodLabel} ${pages.length > 1 ? `(${pageIdx + 1}/${pages.length})` : ''}`)}
              <div style="padding: 0 20mm 20mm 20mm;">
                <div style="font-size: 18px; font-weight: 900; text-transform: uppercase; border-bottom: 4px solid ${config.primaryColor || '#0284c7'}; padding-bottom: 15px; margin-bottom: 25px; color: ${config.primaryColor || '#0284c7'}; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.05em;">
                  <span>Líderes de Pequenos Grupos</span>
                  <span style="font-size: 14px; background: #f0f9ff; color: #0369a1; padding: 6px 16px; border-radius: 24px; border: 1px solid #bae6fd;">${list.length} PGs</span>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                  <thead>
                    <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc;">
                      <th style="padding: 10px 15px; font-weight: 800; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Líder do PG</th>
                      <th style="padding: 10px 15px; font-weight: 800; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Celular</th>
                      <th style="padding: 10px 15px; font-weight: 800; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Pequeno Grupo</th>
                      <th style="padding: 10px 15px; font-weight: 800; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Setor do Líder</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pageItems.length > 0 ? pageItems.map(item => `
                      <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 15px; font-weight: 700; color: #1e293b; text-transform: uppercase;">${item.leaderName}</td>
                        <td style="padding: 12px 15px; font-weight: 600; color: #475569;">${item.leaderPhone}</td>
                        <td style="padding: 12px 15px; font-weight: 600; color: #0284c7;">${item.pgName}</td>
                        <td style="padding: 12px 15px; font-weight: 600; color: #475569; text-transform: uppercase;">
                          <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 8px; font-size: 11px; border: 1px solid #e2e8f0;">
                            ${item.sectorName}
                          </span>
                        </td>
                      </tr>
                    `).join('') : `
                      <tr>
                        <td colspan="4" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">
                          Nenhum Pequeno Grupo ativo encontrado nesta unidade.
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>
                
                <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm;">
                  ${getBrandedFooter()}
                </div>
              </div>
          </div>
        `;
    });

    return html;
}
