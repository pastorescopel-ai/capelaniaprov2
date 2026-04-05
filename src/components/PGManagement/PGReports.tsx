
import React, { useMemo, useState, memo } from 'react';
import { Unit } from '../../types';
import { usePro } from '../../contexts/ProContext';
import { useApp } from '../../hooks/useApp';
import { getTimestamp, normalizeString, cleanID } from '../../utils/formatters';
import { useDocumentGenerator } from '../../hooks/useDocumentGenerator';
import { getBrandedHeaderByProfile, getBrandedFooter } from '../../utils/reportTemplates';

interface PGReportsProps {
  unit: Unit;
}

const PGReports: React.FC<PGReportsProps> = memo(({ unit }) => {
  const { proSectors, proStaff, proGroupMembers, proGroupProviderMembers, proProviders, proGroupLocations, proGroups, proHistoryRecords } = usePro();
  const { config } = useApp();
  const { generatePdf, generateZipOfPdfs, isGenerating, progress } = useDocumentGenerator();
  
  // Filtros
  const [selectedTarget, setSelectedTarget] = useState<{type: 'sector' | 'pg' | 'leader', id: string, label: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterCritical, setFilterCritical] = useState(false);

  const searchOptions = useMemo(() => {
    const options: {type: 'sector' | 'pg' | 'leader', id: string, label: string}[] = [];
    proSectors.filter(s => s.unit === unit).forEach(s => options.push({type: 'sector', id: s.id, label: `Setor: ${s.name}`}));
    proGroups.filter(g => g.unit === unit).forEach(g => options.push({type: 'pg', id: g.id, label: `PG: ${g.name}`}));
    proStaff.filter(s => s.unit === unit).forEach(s => {
        const group = proGroups.find(g => g.currentLeader === s.id || g.leader === s.id);
        const sector = proSectors.find(sec => sec.id === s.sectorId);
        options.push({type: 'leader', id: s.id, label: `Líder: ${s.name} (${sector?.name || 'Sem Setor'}) - ${s.whatsapp || 'Sem WhatsApp'}`});
    });
    return options;
  }, [proSectors, proGroups, proStaff, unit]);

  const filteredOptions = useMemo(() => {
    return searchOptions.filter(o => normalizeString(o.label).includes(normalizeString(searchTerm)));
  }, [searchOptions, searchTerm]);

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
        title: `Pequenos Grupos - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year}`,
        periodLabel: `Mês de Referência: ${monthName}/${year}`
      };
    }

    return {
      title: 'Pequenos Grupos',
      periodLabel: `Período: ${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`
    };
  }, [startDate, endDate]);

  const reportResult = useMemo(() => {
    const sectors = proSectors.filter(s => s.unit === unit).sort((a,b) => a.name.localeCompare(b.name));
    let activePGCount = 0;
    const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
    const endTimestamp = new Date(endDate + 'T23:59:59').getTime();
    const sDate = new Date(startDate + 'T12:00:00');
    console.log(`[DEBUG] PGReports - startDate: ${startDate}, endDate: ${endDate}, sDate: ${sDate}`);

    // Dicionários para buscas O(1)
    const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));
    const providersById = new Map(proProviders.map(p => [cleanID(p.id), p]));

    // 0. Verificar se existe histórico para o mês selecionado (Snapshot de Fechamento)
    const monthStr = new Date(sDate.getFullYear(), sDate.getMonth(), 1).toISOString().split('T')[0];
    console.log(`[DEBUG] PGReports - monthStr: ${monthStr}`);
    const isClosed = config.activeCompetenceMonth && monthStr < config.activeCompetenceMonth;
    const historyForMonth = proHistoryRecords.filter(r => r.month === monthStr && r.unit === unit);
    console.log(`[DEBUG] PGReports - historyForMonth.length: ${historyForMonth.length}`);

    let data = [];

    if (historyForMonth.length > 0) {
      data = sectors.map(sector => {
        const sectorIdClean = cleanID(sector.id);
        const staffInHistory = historyForMonth.filter(r => cleanID(r.sectorId) === sectorIdClean || (r.sectorId === 'unassigned' && sectorIdClean === 'unassigned'));
        
        const enrolledStaff = staffInHistory.filter(r => r.isEnrolled);
        const notEnrolled = staffInHistory.filter(r => !r.isEnrolled);

        const enrolledByPGMap = new Map<string, { pgName: string, members: any[], leaderName: string | null }>();
        
        enrolledStaff.forEach(r => {
          const pgName = r.groupName || 'Sem PG Definido';
          const leaderName = r.leaderName || null;

          if (!enrolledByPGMap.has(pgName)) {
            enrolledByPGMap.set(pgName, { pgName, members: [], leaderName });
          }
          enrolledByPGMap.get(pgName)!.members.push({ id: r.staffId, name: r.staffName, registrationId: r.registrationId, type: 'staff' });
        });

        const enrolledByPG = Array.from(enrolledByPGMap.values()).sort((a, b) => a.pgName.localeCompare(b.pgName));
        const pgsInSectorIds = new Set(enrolledStaff.map(r => r.groupId));
        const pgs = Array.from(pgsInSectorIds).map(gid => groupsById.get(gid)).filter(g => !!g);
        const coverage = staffInHistory.length > 0 ? (enrolledStaff.length / staffInHistory.length) * 100 : 0;

        return { 
          sector, 
          totalStaff: staffInHistory.length, 
          enrolledCount: enrolledStaff.length, 
          coverage, 
          pgs, 
          notEnrolledList: notEnrolled.map(r => ({ id: r.staffId, name: r.staffName, registrationId: r.registrationId })), 
          enrolledList: enrolledStaff.map(r => ({ id: r.staffId, name: r.staffName, registrationId: r.registrationId })), 
          enrolledByPG,
          isSnapshot: true
        };
      }).filter(d => d.totalStaff > 0);
      
      const activePGIds = new Set(historyForMonth.filter(r => r.isEnrolled && r.groupId).map(r => cleanID(r.groupId)));
      activePGCount = activePGIds.size;
    } else if (isClosed) {
      data = [];
      activePGCount = 0;
    } else {
      // 1. Filtrar setores e staff da unidade (Dados em Tempo Real)
      const activeStaffMemberships = proGroupMembers.filter(m => {
          const group = groupsById.get(cleanID(m.groupId));
          if (!group || group.unit !== unit) return false;
          
          const mCycleDate = m.cycleMonth ? new Date(m.cycleMonth + 'T12:00:00').getTime() : 0;
          const mLeftDate = getTimestamp(m.leftAt);
          
          return !m.isError &&
                 (!m.cycleMonth || mCycleDate <= endTimestamp) &&
                 (!mLeftDate || mLeftDate >= startTimestamp);
      });

      const activeProviderMemberships = proGroupProviderMembers.filter(m => {
          const group = groupsById.get(cleanID(m.groupId));
          if (!group || group.unit !== unit) return false;
          
          const mCycleDate = m.cycleMonth ? new Date(m.cycleMonth + 'T12:00:00').getTime() : 0;
          const mLeftDate = getTimestamp(m.leftAt);
          
          return !m.isError &&
                 (!m.cycleMonth || mCycleDate <= endTimestamp) &&
                 (!mLeftDate || mLeftDate >= startTimestamp);
      });

      // --- LÓGICA UNIFICADA DE DETECÇÃO DE PGS ATIVOS ---
      const activePGIds = new Set<string>();
      activeStaffMemberships.forEach(m => activePGIds.add(cleanID(m.groupId)));
      activeProviderMemberships.forEach(m => activePGIds.add(cleanID(m.groupId)));
      activePGCount = activePGIds.size;

      const activeStaffMembershipsByStaffId = new Map<string, any>();
      activeStaffMemberships.forEach(m => activeStaffMembershipsByStaffId.set(cleanID(m.staffId), m));

      const staffBySector = new Map<string, any[]>();
      const monthEnd = new Date(sDate.getFullYear(), sDate.getMonth() + 1, 0, 23, 59, 59).getTime();
      const targetDate = new Date(startDate + 'T12:00:00');

      proStaff.forEach(s => {
        if (s.unit !== unit) return;

        const createdDate = getTimestamp(s.createdAt);
        if (createdDate && createdDate > monthEnd) return;

        if (!createdDate && s.cycleMonth) {
          const cycleDate = new Date(s.cycleMonth + 'T12:00:00').getTime();
          if (cycleDate > monthEnd) return;
        }

        const leftDate = getTimestamp(s.leftAt);
        if (leftDate && leftDate < targetDate.getTime()) return;

        const sId = cleanID(s.sectorId);
        if (!staffBySector.has(sId)) staffBySector.set(sId, []);
        staffBySector.get(sId)?.push(s);
      });

      const locsBySector = new Map<string, Set<string>>();
      proGroupLocations.forEach(loc => {
        const sId = cleanID(loc.sectorId);
        if (!locsBySector.has(sId)) locsBySector.set(sId, new Set());
        locsBySector.get(sId)?.add(cleanID(loc.groupId));
      });

      const activeProviderMembershipsByGroupId = new Map<string, any[]>();
      activeProviderMemberships.forEach(m => {
          const gId = cleanID(m.groupId);
          if (!activeProviderMembershipsByGroupId.has(gId)) activeProviderMembershipsByGroupId.set(gId, []);
          activeProviderMembershipsByGroupId.get(gId)?.push(m);
      });

      data = sectors.map(sector => {
          const sectorIdClean = cleanID(sector.id);
          const staff = staffBySector.get(sectorIdClean) || [];
          const enrolledStaff: any[] = [];
          const notEnrolled: any[] = [];

          staff.forEach(s => {
              if (activeStaffMembershipsByStaffId.has(cleanID(s.id))) {
                  enrolledStaff.push(s);
              } else {
                  notEnrolled.push(s);
              }
          });
          
          const enrolledByPGMap = new Map<string, { pgName: string, members: any[], leaderName: string | null }>();
          
          enrolledStaff.forEach(s => {
              const m = activeStaffMembershipsByStaffId.get(cleanID(s.id));
              const pg = m ? groupsById.get(cleanID(m.groupId)) : null;
              const pgName = pg?.name || 'Sem PG Definido';
              const leaderName = pg?.currentLeader || null;
              
              const pgNameNorm = normalizeString(pgName);
              
              if (!enrolledByPGMap.has(pgNameNorm)) {
                  enrolledByPGMap.set(pgNameNorm, { pgName, members: [], leaderName });
              }
              enrolledByPGMap.get(pgNameNorm)!.members.push({ ...s, type: 'staff' });
          });

          const sectorLocs = locsBySector.get(sectorIdClean) || new Set();
          sectorLocs.forEach(pgIdClean => {
              const memberships = activeProviderMembershipsByGroupId.get(pgIdClean) || [];
              memberships.forEach(m => {
                  const provider = providersById.get(cleanID(m.providerId));
                  if (provider) {
                      const pg = groupsById.get(pgIdClean);
                      const pgName = pg?.name || 'Sem PG Definido';
                      const leaderName = pg?.currentLeader || null;
                      
                      const pgNameNorm = normalizeString(pgName);
                      
                      if (!enrolledByPGMap.has(pgNameNorm)) {
                          enrolledByPGMap.set(pgNameNorm, { pgName, members: [], leaderName });
                      }
                      if (!enrolledByPGMap.get(pgNameNorm)!.members.some(mem => mem.id === provider.id)) {
                          enrolledByPGMap.get(pgNameNorm)!.members.push({ ...provider, type: 'provider' });
                      }
                  }
              });
          });

          const enrolledByPG = Array.from(enrolledByPGMap.values()).sort((a, b) => a.pgName.localeCompare(b.pgName));
          const geoGroupIds = sectorLocs;
          const memberGroupIds = new Set(enrolledStaff.map(s => {
              const m = activeStaffMembershipsByStaffId.get(cleanID(s.id));
              return m ? cleanID(m.groupId) : null;
          }).filter(id => id !== null) as string[]);
          
          const allGroupIdsInSector = new Set([...Array.from(geoGroupIds), ...Array.from(memberGroupIds)]);
          const pgs = Array.from(allGroupIdsInSector).map(gid => groupsById.get(gid)).filter(g => !!g);
          const coverage = staff.length > 0 ? (enrolledStaff.length / staff.length) * 100 : 0;

          return { sector, totalStaff: staff.length, enrolledCount: enrolledStaff.length, coverage, pgs, notEnrolledList: notEnrolled, enrolledList: enrolledStaff, enrolledByPG };
      }).filter(d => d.totalStaff > 0);
    }

    const normSearch = normalizeString(searchTerm);
    const searchTerms = normSearch.split(' ').filter(t => t);

    return {
        reportData: data.filter(d => {
            if (d.totalStaff === 0) return false;
            
            // Filtro de Gargalo (< 80%)
            if (filterCritical && d.coverage >= 80) return false;

            if (selectedTarget) {
                if (selectedTarget.type === 'sector') return d.sector.id === selectedTarget.id;
                if (selectedTarget.type === 'pg') return d.pgs.some((pg: any) => pg?.id === selectedTarget.id);
                if (selectedTarget.type === 'leader') return d.enrolledByPG.some((group: any) => group.leaderName === selectedTarget.label.split('Líder: ')[1].split(' (')[0]);
            }
            
            if (searchTerms.length === 0) return true;
            
            const targetText = d.sector.name + ' ' + d.pgs.map((pg: any) => pg?.name || '').join(' ');
                
            const normTarget = normalizeString(targetText);
            return searchTerms.every(term => normTarget.includes(term));
        }),
        activePGCount: activePGCount // Retornar o contador unificado
    };
  }, [proSectors, proStaff, proGroupMembers, proGroupProviderMembers, proProviders, proGroupLocations, proGroups, proHistoryRecords, unit, searchTerm, selectedTarget, startDate, endDate, filterCritical, config.activeCompetenceMonth]);

  const { reportData, activePGCount } = reportResult;

  const generateSectorHtml = (data: any) => {
    const ITEMS_PER_PAGE = 25;
    const enrolledByPG = data.enrolledByPG || [];
    const notEnrolledList = data.notEnrolledList || [];
    
    // Flatten enrolled members for easier chunking if needed, 
    // but better to keep PG grouping. Let's chunk by PG groups.
    
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

    // Subsequent pages for enrolled members if needed
    if (enrolledByPG.length > 3) {
      const remainingPGs = enrolledByPG.slice(3);
      const chunks = [];
      for (let i = 0; i < remainingPGs.length; i += 4) {
        chunks.push(remainingPGs.slice(i, i + 4));
      }

      chunks.forEach((chunk, idx) => {
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

    // Subsequent pages for not enrolled members if needed
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

  const handlePrintAction = async () => {
    if (!searchTerm) {
      // MODO BACKUP ZIP: Múltiplos PDFs
      const pages = reportData.map(data => ({
        html: generateSectorHtml(data),
        name: `Relatorio_${data.sector.name}`
      }));
      await generateZipOfPdfs(pages, `Backup_Relatorios_PDF_${unit}_${startDate}`);
    } else {
      // MODO IMPRESSÃO ÚNICA: Um PDF
      let combinedHtml = '';
      reportData.forEach(data => {
        combinedHtml += generateSectorHtml(data);
      });
      await generatePdf(combinedHtml, `Relatorio_${unit}.pdf`);
    }
  };

  const generateActivityReportHtml = () => {
    const sDate = new Date(startDate + 'T12:00:00');
    const monthStr = new Date(sDate.getFullYear(), sDate.getMonth(), 1).toISOString().split('T')[0];
    const isClosed = config.activeCompetenceMonth && monthStr < config.activeCompetenceMonth;

    const allGroups = proGroups.filter(g => g.unit === unit).sort((a, b) => a.name.localeCompare(b.name));
    const activePGs: any[] = [];
    const inactivePGs: any[] = [];
    let totalMembersInvolved = 0;
    let totalStaffInSector = 0;

    // Dados do mês anterior para comparação
    const prevMonthDate = new Date(sDate.getFullYear(), sDate.getMonth() - 1, 1);
    const prevMonthStr = prevMonthDate.toISOString().split('T')[0];
    const historyPrevMonth = proHistoryRecords.filter(r => r.month === prevMonthStr && r.unit === unit);

    const prevActivePGNames = new Set<string>();
    if (historyPrevMonth.length > 0) {
      historyPrevMonth.forEach(r => {
        if (r.isEnrolled && r.groupName) prevActivePGNames.add(normalizeString(r.groupName));
      });
    } else {
      // Se não houver histórico, tentamos inferir do estado atual (embora impreciso para o passado)
      // Mas o ideal é usar o histórico. Se vazio, a comparação será baseada em "primeiro registro".
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

    const activePGChunks = [];
    for (let i = 0; i < activePGs.length; i += 20) {
      activePGChunks.push(activePGs.slice(i, i + 20));
    }

    const inactivePGChunks = [];
    for (let i = 0; i < inactivePGs.length; i += 20) {
      inactivePGChunks.push(inactivePGs.slice(i, i + 20));
    }

    let html = '';

    // Página de Resumo e Primeiros PGs Ativos
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

    // Páginas restantes de PGs Ativos
    if (activePGs.length > 12) {
      const remainingActive = activePGs.slice(12);
      const chunks = [];
      for (let i = 0; i < remainingActive.length; i += 20) {
        chunks.push(remainingActive.slice(i, i + 20));
      }
      chunks.forEach((chunk, idx) => {
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

    // Página de Comparativo (Novos e Inativados)
    if (isClosed && (newPGs.length > 0 || inactivatedPGs.length > 0)) {
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

    // Páginas de PGs Inativos
    inactivePGChunks.forEach((chunk, idx) => {
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
  };

  const handlePrintActivityAction = async () => {
    const html = generateActivityReportHtml();
    await generatePdf(html, `Atividade_PGs_${unit}_${startDate}.pdf`);
  };

  const generateNoLeaderReportHtml = () => {
    // Apenas PGs ativos (pelo menos um membro CLT ou Prestador)
    const noLeaderPGs = proGroups.filter(g => {
        if (g.unit !== unit) return false;
        
        // Verifica se tem membros CLT ou Prestadores ativos
        const hasMembers = proGroupMembers.some(m => cleanID(m.groupId) === cleanID(g.id) && !m.leftAt) ||
                           proGroupProviderMembers.some(m => cleanID(m.groupId) === cleanID(g.id) && !m.leftAt);
        
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
  };

  const handlePrintNoLeaderAction = async () => {
    const html = generateNoLeaderReportHtml();
    await generatePdf(html, `PGs_Ativos_Sem_Lideres_${unit}_${startDate}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{reportHeaderInfo.title}</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{reportHeaderInfo.periodLabel}</p>
                <p className="text-emerald-600 text-xs font-black uppercase mt-1">{activePGCount} PGs Ativos</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handlePrintNoLeaderAction} 
                disabled={!!isGenerating}
                className="px-6 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                  {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-user-slash"></i>}
                  PGs Sem Líderes
              </button>
              <button 
                onClick={handlePrintActivityAction} 
                disabled={!!isGenerating}
                className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                  {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-list-check"></i>}
                  Atividade de PGs
              </button>
              <button 
                onClick={handlePrintAction} 
                disabled={!!isGenerating}
                className={`px-8 py-4 ${!searchTerm ? 'bg-amber-600' : 'bg-[#005a9c]'} text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50 min-w-[200px]`}
              >
                  {isGenerating ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    <i className={`fas ${!searchTerm ? 'fa-file-archive' : 'fa-file-pdf'}`}></i> 
                  )}
                  {isGenerating ? (progress || 'Processando...') : (!searchTerm ? 'Gerar Backup (ZIP)' : 'Imprimir PDF')}
              </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50 rounded-[2rem]">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início do Período</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-xl bg-white border-none font-bold text-xs shadow-sm" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim do Período</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-xl bg-white border-none font-bold text-xs shadow-sm" />
            </div>
            
            <div className="space-y-1 relative">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Filtrar por Setor, PG ou Líder</label>
                <input 
                    type="text" 
                    placeholder="Buscar..." 
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setSelectedTarget(null); }}
                    className="w-full p-4 rounded-xl bg-white border-none font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-blue-500" 
                />
                {searchTerm && (
                    <div className="absolute z-10 w-full bg-white mt-1 rounded-xl shadow-lg border border-slate-100 max-h-60 overflow-y-auto">
                        {filteredOptions.map(o => (
                            <button key={o.id} onClick={() => { setSelectedTarget(o); setSearchTerm(o.label); }} className="w-full text-left p-3 text-xs hover:bg-slate-50 border-b border-slate-50">{o.label}</button>
                        ))}
                    </div>
                )}
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
                      {data.pgs.map((pg: any) => (
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
});

PGReports.displayName = 'PGReports';

export default PGReports;
