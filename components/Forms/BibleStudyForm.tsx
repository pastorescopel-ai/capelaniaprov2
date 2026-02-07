
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, RecordStatus, BibleStudy, User, UserRole, MasterLists, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete, { AutocompleteOption } from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { formatWhatsApp, normalizeString } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';

interface FormProps {
  unit: Unit;
  users: User[];
  currentUser: User;
  masterLists: MasterLists;
  history: BibleStudy[];
  allHistory?: BibleStudy[];
  editingItem?: BibleStudy;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: BibleStudy) => void;
  onSubmit: (data: any) => void;
  onTransfer?: (type: string, id: string, newUserId: string) => void;
}

const BibleStudyForm: React.FC<FormProps> = ({ unit, users, currentUser, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit, onTransfer }) => {
  const { proStaff, proPatients, proProviders, proSectors, syncMasterContact } = useApp();
  const { showToast } = useToast();
  
  const getToday = () => new Date().toLocaleDateString('en-CA');
  const defaultState = { id: '', date: getToday(), sector: '', name: '', whatsapp: '', status: RecordStatus.INICIO, participantType: ParticipantType.STAFF, guide: '', lesson: '', observations: '' };
  
  const [formData, setFormData] = useState(defaultState);

  // --- SUGESTÕES DE GUIAS (Restaurado) ---
  const guideOptions = useMemo(() => {
    const uniqueGuides = new Set<string>();
    allHistory.forEach(s => { if (s.guide) uniqueGuides.add(s.guide); });
    return Array.from(uniqueGuides).sort().map(g => ({ value: g, label: g }));
  }, [allHistory]);

  const sectorOptions = useMemo(() => {
    if (formData.participantType === ParticipantType.PATIENT) {
        return [{value: 'Internado', label: 'Internado'}, {value: 'Acompanhante', label: 'Acompanhante'}, {value: 'Emergência', label: 'Emergência'}, {value: 'Outros', label: 'Outros'}];
    }
    if (formData.participantType === ParticipantType.PROVIDER) {
        return [{value: 'Profissional da Saúde', label: 'Profissional da Saúde'}, {value: 'Apoio/Serviços', label: 'Apoio/Serviços'}, {value: 'Administrativo', label: 'Administrativo'}, {value: 'Outros', label: 'Outros'}];
    }
    return proSectors.filter(s => s.unit === unit).map(s => ({value: s.name, label: s.name}));
  }, [formData.participantType, proSectors, unit]);

  const studentOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    const normalizedRHNames = new Set(proStaff.filter(s => s.unit === unit).map(s => normalizeString(s.name)));

    if (formData.participantType === ParticipantType.STAFF) {
        proStaff.filter(s => s.unit === unit).forEach(staff => {
          const sector = proSectors.find(sec => sec.id === staff.sectorId);
          options.push({ value: staff.name, label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`, subLabel: sector ? sector.name : 'Setor não informado', category: 'RH' as const });
        });
    } else if (formData.participantType === ParticipantType.PATIENT) {
        proPatients.filter(p => p.unit === unit).forEach(p => options.push({ value: p.name, label: p.name, subLabel: "Paciente", category: "RH" as const }));
    } else {
        proProviders.filter(p => p.unit === unit).forEach(p => options.push({ value: p.name, label: p.name, subLabel: p.sector || "Prestador", category: "RH" as const }));
    }
    
    // Filtro Lógica Samara: Se o nome do histórico já existe no RH, não mostra o duplicado do histórico
    const personalHistory = allHistory.filter(s => s.userId === currentUser.id);
    const uniqueHistoryNames = new Set<string>();
    personalHistory.forEach(s => {
      const norm = normalizeString(s.name);
      if (s.name && !uniqueHistoryNames.has(norm) && !normalizedRHNames.has(norm)) {
        uniqueHistoryNames.add(norm);
        options.push({ value: s.name, label: s.name, subLabel: s.sector, category: 'History' as const });
      }
    });
    return options;
  }, [allHistory, currentUser.id, proStaff, proPatients, proProviders, proSectors, unit, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ ...editingItem, participantType: editingItem.participantType || ParticipantType.STAFF, date: editingItem.date ? editingItem.date.split('T')[0] : getToday() });
    } else {
      setFormData({ ...defaultState, date: getToday() });
    }
  }, [editingItem]);

  // --- MOTOR DE CONTINUIDADE (Lógica Samara) ---
  const handleSelectStudent = (selectedLabel: string) => {
    const targetName = selectedLabel.split(' (')[0].trim();
    let targetSector = formData.sector;
    let targetWhatsApp = formData.whatsapp;
    let targetGuide = formData.guide;
    let targetLesson = formData.lesson;
    const normName = normalizeString(targetName);

    // 1. Puxar Dados do Cadastro (RH/Paciente/Prestador)
    if (formData.participantType === ParticipantType.STAFF) {
        const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
        if (staff) {
            const sector = proSectors.find(s => s.id === staff.sectorId);
            targetSector = sector ? sector.name : targetSector;
            targetWhatsApp = staff.whatsapp ? formatWhatsApp(staff.whatsapp) : targetWhatsApp;
        }
    } else if (formData.participantType === ParticipantType.PATIENT) {
        const p = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (p) targetWhatsApp = p.whatsapp ? formatWhatsApp(p.whatsapp) : targetWhatsApp;
    } else {
        const pr = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (pr) { targetWhatsApp = pr.whatsapp ? formatWhatsApp(pr.whatsapp) : targetWhatsApp; targetSector = pr.sector || targetSector; }
    }

    // 2. BUSCA DE CONTINUIDADE (Varre o histórico para preencher Guia e Lição + 1)
    // Busca no histórico total pelo nome normalizado
    const lastRecord = [...allHistory]
        .filter(h => normalizeString(h.name).includes(normName.split(' ')[0])) // Busca aproximada para captar Samara -> Samara de Alcantara
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (lastRecord) {
        targetGuide = lastRecord.guide;
        // Incrementa lição se for número
        const lastNum = parseInt(lastRecord.lesson);
        targetLesson = isNaN(lastNum) ? lastRecord.lesson : (lastNum + 1).toString();
        showToast(`Continuidade: ${targetGuide}, Lição ${targetLesson}`, "info");
    }

    setFormData(prev => ({ ...prev, name: targetName, sector: targetSector, whatsapp: targetWhatsApp, guide: targetGuide, lesson: targetLesson }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sector || !formData.whatsapp || !formData.guide || !formData.lesson) {
        showToast("Preencha todos os campos obrigatórios.");
        return;
    }
    // Sincroniza o contato no banco mestre
    await syncMasterContact(formData.name, formData.whatsapp, unit, formData.participantType!, formData.sector);
    
    // Envia o tipo de participante explicitamente para o banco
    onSubmit({ ...formData, unit, participantType: formData.participantType });
    setFormData({ ...defaultState, date: getToday() });
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Estudo Bíblico</h2>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start">
             {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
               <button key={type} type="button" onClick={() => setFormData({...formData, participantType: type, name: '', whatsapp: '', sector: '', guide: '', lesson: ''})} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === type ? 'bg-white shadow-lg text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>{type}</button>
             ))}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do {formData.participantType}</label><Autocomplete options={studentOptions} value={formData.name} onChange={v => setFormData({...formData, name: v})} onSelectOption={handleSelectStudent} placeholder="Buscar..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Local</label><Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">WhatsApp</label><input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Guia de Estudo</label><Autocomplete options={guideOptions} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Ex: O Grande Conflito" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Lição nº</label><input type="number" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Status</label><div className="flex gap-2">{STATUS_OPTIONS.map(opt => (<button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>{opt}</button>))}</div></div>
        </div>
        <button type="submit" className="w-full py-6 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs hover:bg-blue-700">Gravar Registro</button>
      </form>
      <HistorySection<BibleStudy> data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['name']} renderItem={(item) => (
          <HistoryCard key={item.id} icon="📖" color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-blue-600"} title={item.name} subtitle={`${item.sector} • ${item.status}`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} isAdmin={currentUser.role === UserRole.ADMIN} users={users} onTransfer={(newUid) => onTransfer?.('study', item.id, newUid)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} 
          middle={item.participantType && item.participantType !== ParticipantType.STAFF && (<span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${item.participantType === ParticipantType.PATIENT ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.participantType}</span>)}/>
        )}
      />
    </div>
  );
};

export default BibleStudyForm;
