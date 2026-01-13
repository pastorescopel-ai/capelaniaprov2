
// ############################################################
// # VERSION: 1.0.8-DYNAMIC-ID-RECOGNITION (STABLE)
// # STATUS: RELATIONAL NAME RESOLUTION IMPLEMENTED
// ############################################################

import React, { useState, useMemo } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config, MasterLists } from '../types';
import { REPORT_LOGO_BASE64 } from '../constants';

interface ReportsProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  users: User[];
  masterLists: MasterLists; // Adicionado para resolução
  config: Config;
  onRefresh?: () => Promise<void>;
}

const resolveDynamicName = (val: string, list: string[] = []) => {
  if (!val || !val.includes('_')) return val;
  const prefix = val.split('_')[0] + '_';
  const currentMatch = list.find(item => item.startsWith(prefix));
  return currentMatch || val;
};

const Reports: React.FC<ReportsProps> = ({ studies, classes, groups, visits, users, masterLists, config, onRefresh }) => {
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [selectedDetailUser, setSelectedDetailUser] = useState<User | null>(null);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedChaplain, setSelectedChaplain] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState<'all' | Unit>('all');

  const pColor = config.primaryColor || '#005a9c';

  const filteredData = useMemo(() => {
    const filterFn = (item: any) => {
      if (!item || !item.date) return false;
      const itemDate = item.date.split('T')[0];
      const dateMatch = itemDate >= startDate && itemDate <= endDate;
      const chaplainMatch = selectedChaplain === 'all' || item.userId === selectedChaplain;
      const itemUnit = item.unit || Unit.HAB;
      const unitMatch = selectedUnit === 'all' || itemUnit === selectedUnit;
      return dateMatch && chaplainMatch && unitMatch;
    };

    return {
      studies: (studies || []).filter(filterFn),
      classes: (classes || []).filter(filterFn),
      groups: (groups || []).filter(filterFn),
      visits: (visits || []).filter(filterFn),
    };
  }, [studies, classes, groups, visits, startDate, endDate, selectedChaplain, selectedUnit]);

  const totalStats = useMemo(() => {
    const uniqueStudentsInFilter = new Set<string>();
    filteredData.studies.forEach(s => { if (s.name) uniqueStudentsInFilter.add(s.name.trim().toLowerCase()); });
    filteredData.classes.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(name => { if (name) uniqueStudentsInFilter.add(name.trim().toLowerCase()); }); });
    return {
      studies: filteredData.studies.length,
      classes: filteredData.classes.length,
      groups: filteredData.groups.length,
      visits: filteredData.visits.length,
      totalStudents: uniqueStudentsInFilter.size
    };
  }, [filteredData]);

  const chaplainStats = useMemo(() => {
    return users.map(userObj => {
      const uid = userObj.id;
      const uStudiesFiltered = filteredData.studies.filter(s => s.userId === uid);
      const uClassesFiltered = filteredData.classes.filter(c => c.userId === uid);
      const uVisitsFiltered = filteredData.visits.filter(v => v.userId === uid);
      const uGroupsFiltered = filteredData.groups.filter(g => g.userId === uid);
      
      const uniqueNames = new Set<string>();
      uStudiesFiltered.forEach(s => { if (s.name) uniqueNames.add(s.name.trim().toLowerCase()); });
      uClassesFiltered.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => uniqueNames.add(n.trim().toLowerCase())); });

      const totalActions = uStudiesFiltered.length + uClassesFiltered.length + uVisitsFiltered.length + uGroupsFiltered.length;
      
      const getUnitStats = (unit: Unit) => {
          const uS = uStudiesFiltered.filter(s => (s.unit || Unit.HAB) === unit);
          const uC = uClassesFiltered.filter(c => (c.unit || Unit.HAB) === unit);
          const uG = uGroupsFiltered.filter(g => (g.unit || Unit.HAB) === unit);
          const uV = uVisitsFiltered.filter(v => (v.unit || Unit.HAB) === unit);
          
          const unitUniqueNames = new Set<string>();
          uS.forEach(s => { if (s.name) unitUniqueNames.add(s.name.trim().toLowerCase()); });
          uC.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => unitUniqueNames.add(n.trim().toLowerCase())); });
          
          return {
              students: unitUniqueNames.size,
              studies: uS.length,
              classes: uC.length,
              groups: uG.length,
              visits: uV.length,
              total: uS.length + uC.length + uG.length + uV.length,
              rawStudies: uS.sort((a,b) => b.createdAt - a.createdAt),
              rawClasses: uC.sort((a,b) => b.createdAt - a.createdAt)
          };
      };

      return { 
        user: userObj, name: userObj.name, totalActions, 
        hab: getUnitStats(Unit.HAB), haba: getUnitStats(Unit.HABA), 
        students: uniqueNames.size
      };
    })
    .filter(s => selectedChaplain === 'all' || s.user.id === selectedChaplain)
    .sort((a, b) => b.totalActions - a.totalActions);
  }, [users, filteredData, selectedChaplain]);

  const handlePrintIsolated = () => {
    const printContent = document.getElementById('pdf-root');
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) return;
    const styles = Array.from(document.querySelectorAll('link, style')).map(s => s.outerHTML).join('\n');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Capelania - Filtro Inteligente</title>
          ${styles}
          <style>@media print { @page { size: A4; margin: 0; } .no-print { display: none; } } body { background: #f1f5f9; padding: 20px; }</style>
        </head>
        <body><div style="background:white; width:210mm; margin:auto; padding:15mm;">${printContent.innerHTML}</div></body>
      </html>
    `);
    printWindow.document.close();
  };

  const PdfTemplate = () => (
    <div id="pdf-root" className="bg-white p-[15mm] flex flex-col gap-6 text-slate-900 border border-slate-100">
      <header className="relative border-b-4 flex-shrink-0" style={{ height: '140px', borderColor: pColor }}>
        {REPORT_LOGO_BASE64 && <img src={REPORT_LOGO_BASE64} style={{ position: 'absolute', left: `${config.reportLogoX}px`, top: `${config.reportLogoY}px`, width: `${config.reportLogoWidth}px` }} alt="Logo" />}
        <div style={{ position: 'absolute', left: `${config.headerLine1X}px`, top: `${config.headerLine1Y}px`, width: '450px', textAlign: config.headerTextAlign }}>
          <h1 style={{ fontSize: `${config.fontSize1}px`, color: pColor }} className="font-black uppercase">{config.headerLine1}</h1>
        </div>
        <div style={{ position: 'absolute', left: `${config.headerLine2X}px`, top: `${config.headerLine2Y}px`, width: '450px', textAlign: config.headerTextAlign }}>
          <h2 style={{ fontSize: `${config.fontSize2}px` }} className="font-bold text-slate-600 uppercase">{config.headerLine2}</h2>
        </div>
        <div style={{ position: 'absolute', left: `${config.headerLine3X}px`, top: `${config.headerLine3Y}px`, width: '450px', textAlign: config.headerTextAlign }}>
          <h3 style={{ fontSize: `${config.fontSize3}px` }} className="font-medium text-slate-400 uppercase">{config.headerLine3}</h3>
        </div>
      </header>

      <section className="space-y-10 mt-4 flex-1">
        {[Unit.HAB, Unit.HABA].map(unitKey => {
            if (selectedUnit !== 'all' && selectedUnit !== unitKey) return null;
            return (
              <div key={unitKey} className="space-y-4">
                <h3 className="text-[11px] font-black uppercase border-b-2 border-slate-100 pb-1" style={{ color: pColor }}>Unidade {unitKey}</h3>
                <table className="w-full text-left text-[9px] border-collapse">
                  <thead>
                    <tr className="text-white font-black uppercase" style={{ backgroundColor: pColor }}>
                      <th className="p-3">Capelão</th>
                      <th className="p-3 text-center">Alunos</th>
                      <th className="p-3 text-center">Estudos</th>
                      <th className="p-3 text-center">Classes</th>
                      <th className="p-3 text-center">PGs</th>
                      <th className="p-3 text-center">Visitas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chaplainStats.map((stat, idx) => {
                      const uS = unitKey === Unit.HAB ? stat.hab : stat.haba;
                      return (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-3 font-bold text-slate-700 uppercase">{stat.name}</td>
                          <td className="p-3 text-center font-black text-sm">{uS.students}</td>
                          <td className="p-3 text-center font-black text-sm">{uS.studies}</td>
                          <td className="p-3 text-center font-black text-sm">{uS.classes}</td>
                          <td className="p-3 text-center font-black text-sm">{uS.groups}</td>
                          <td className="p-3 text-center font-black text-sm">{uS.visits}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
        })}
      </section>
    </div>
  );

  const currentDetailStat = chaplainStats.find(s => s.user.id === selectedDetailUser?.id);

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Relatórios e Estatísticas</h1>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onRefresh && onRefresh()} className="px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase text-[9px] tracking-widest"><i className="fas fa-sync-alt"></i> Sincronizar</button>
            <button onClick={handlePrintIsolated} className="px-6 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[9px] tracking-widest"><i className="fas fa-print"></i> Impressão Direta</button>
            <button onClick={() => setShowPdfPreview(true)} className="px-6 py-4 text-white font-black rounded-2xl shadow-xl uppercase text-[9px] tracking-widest" style={{ backgroundColor: pColor }}><i className="fas fa-file-pdf"></i> Visualizar PDF</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[2.5rem]">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Capelão</label>
            <select value={selectedChaplain} onChange={e => setSelectedChaplain(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs">
              <option value="all">Todos os Capelães</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Unidade</label>
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value as any)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs">
              <option value="all">Todas as Unidades</option>
              <option value={Unit.HAB}>HAB</option>
              <option value={Unit.HABA}>HABA</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[{label: 'Alunos', val: totalStats.totalStudents, color: 'bg-blue-600'}, {label: 'Estudos', val: totalStats.studies, color: 'bg-blue-500'}, {label: 'Classes', val: totalStats.classes, color: 'bg-indigo-500'}, {label: 'PGs', val: totalStats.groups, color: 'bg-emerald-500'}, {label: 'Visitas', val: totalStats.visits, color: 'bg-rose-500'}].map((card, i) => (
            <div key={i} className={`${card.color} p-6 rounded-[2.5rem] text-white shadow-xl flex flex-col items-center`}>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">{card.label}</p>
              <p className="text-2xl font-black">{card.val}</p>
            </div>
          ))}
        </div>
      </section>

      {selectedDetailUser && currentDetailStat && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase">{selectedDetailUser.name} - Detalhamento</h3>
              <button onClick={() => setSelectedDetailUser(null)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
              {['HAB', 'HABA'].map((unitKey) => {
                const uStat = unitKey === 'HAB' ? currentDetailStat.hab : currentDetailStat.haba;
                if (uStat.total === 0) return null;
                return (
                  <div key={unitKey} className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-center">Unidade {unitKey}</h4>
                    <div className="grid gap-4">
                      {uStat.rawStudies.map((s, i) => (
                        <div key={`study-${i}`} className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div><p className="font-black text-slate-800 uppercase text-xs">{s.name}</p><p className="text-[9px] font-bold text-blue-600 uppercase">{resolveDynamicName(s.sector, unitKey === 'HAB' ? masterLists.sectorsHAB : masterLists.sectorsHABA)}</p></div>
                          <div className="text-right"><p className="text-[10px] font-bold text-slate-700">{s.guide} - Lição {s.lesson}</p></div>
                        </div>
                      ))}
                      {uStat.rawClasses.map((c, i) => (
                        <div key={`class-${i}`} className="p-5 bg-indigo-50/50 rounded-3xl border border-indigo-100 space-y-3">
                          <div className="flex justify-between items-center"><p className="font-black text-indigo-700 uppercase text-xs">Classe: {c.guide} (Lição {c.lesson})</p><p className="text-[9px] font-black text-indigo-400">{resolveDynamicName(c.sector, unitKey === 'HAB' ? masterLists.sectorsHAB : masterLists.sectorsHABA)}</p></div>
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-indigo-100/50">{c.students?.map((name, si) => <span key={si} className="text-[8px] font-bold bg-white text-slate-600 px-2.5 py-1 rounded-full border border-indigo-50 uppercase">{name}</span>)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-center">
               <button onClick={() => setSelectedDetailUser(null)} className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showPdfPreview && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[950] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl my-auto rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center no-print">
              <h2 className="text-xl font-black text-slate-800 uppercase">Pré-visualização do Relatório</h2>
              <div className="flex items-center gap-3">
                <button onClick={handlePrintIsolated} className="px-8 py-3.5 bg-slate-900 text-white font-black rounded-xl shadow-2xl uppercase text-[12px] tracking-widest">Imprimir</button>
                <button onClick={() => setShowPdfPreview(false)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500"><i className="fas fa-times"></i></button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-4 md:p-10 overflow-y-auto no-scrollbar"><PdfTemplate /></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
