
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, RecordStatus, BibleStudy, User, UserRole, MasterLists, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete, { AutocompleteOption } from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { formatWhatsApp, getFirstName, normalizeString } from '../../utils/formatters';
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
  const { proStaff, proSectors } = useApp();
  
  const getToday = () => new Date().toLocaleDateString('en-CA');

  const defaultState = { 
    id: '', 
    date: getToday(), 
    sector: '', 
    name: '', 
    whatsapp: '', 
    status: RecordStatus.INICIO, 
    participantType: ParticipantType.STAFF,
    guide: '', 
    lesson: '', 
    observations: '' 
  };
  
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();
  
  const studySuggestions = ["Ouvindo a voz de Deus", "Verdade e Vida", "Apocalipse", "Daniel"];

  const sectorOptions = useMemo(() => {
    return proSectors
      .filter(s => s.unit === unit)
      .map(s => ({ value: s.name, label: s.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [proSectors, unit]);

  const studentOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    
    proStaff.filter(s => s.unit === unit).forEach(staff => {
      const sector = proSectors.find(sec => sec.id === staff.sectorId);
      options.push({
        value: staff.name,
        label: `${staff.name} (${staff.id.split('-')[1] || staff.id})`,
        subLabel: sector ? sector.name : 'Setor não informado',
        category: 'RH'
      });
    });

    const personalHistory = allHistory.filter(s => s.userId === currentUser.id);
    const uniqueHistoryNames = new Set<string>();
    personalHistory.forEach(s => {
      if (s.name && !uniqueHistoryNames.has(normalizeString(s.name))) {
        uniqueHistoryNames.add(normalizeString(s.name));
        options.push({
          value: s.name,
          label: s.name,
          subLabel: s.sector,
          category: 'History'
        });
      }
    });

    return options;
  }, [allHistory, currentUser.id, proStaff, proSectors, unit]);

  useEffect(() => {
    if (editingItem) {
      setFormData({
        ...editingItem,
        participantType: editingItem.participantType || ParticipantType.STAFF,
        date: editingItem.date ? editingItem.date.split('T')[0] : getToday(),
        observations: editingItem.observations || ''
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setFormData({ ...defaultState, date: getToday() });
    }
  }, [editingItem]);

  const handleSelectStudent = (selectedLabel: string) => {
    const match = selectedLabel.match(/\((.*?)\)$/);
    let targetName = selectedLabel.split(' (')[0].trim();
    let targetSector = formData.sector;
    let foundOfficial = false;

    // 1. Identifica se é do Banco Oficial (RH)
    if (match) {
        const rawId = match[1];
        const staff = proStaff.find(s => s.id === `${unit}-${rawId}` || s.id === rawId);
        
        if (staff) {
            const sector = proSectors.find(s => s.id === staff.sectorId || s.id === `${unit}-${staff.sectorId}`);
            targetName = staff.name;
            targetSector = sector ? sector.name : targetSector;
            foundOfficial = true;
        }
    }

    // 2. Lógica de Convergência Total
    const lastRecord = [...allHistory]
      .filter(h => h.userId === currentUser.id && normalizeString(h.name).includes(normalizeString(targetName.split(' ')[0])))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (lastRecord) {
        const nextLesson = !isNaN(Number(lastRecord.lesson)) ? (Number(lastRecord.lesson) + 1).toString() : lastRecord.lesson;
        
        setFormData(prev => ({ 
          ...prev, 
          name: targetName, 
          sector: targetSector,
          participantType: foundOfficial ? ParticipantType.STAFF : prev.participantType,
          whatsapp: lastRecord.whatsapp || prev.whatsapp,
          guide: lastRecord.guide || prev.guide,
          lesson: nextLesson
        }));
        
        if (foundOfficial) {
            showToast(`Vínculo oficial confirmado. Dados recuperados do seu histórico.`, "success");
        } else {
            showToast(`Histórico localizado. Dados preenchidos automaticamente.`, "info");
        }
    } else {
        setFormData(prev => ({ 
            ...prev, 
            name: targetName, 
            sector: targetSector,
            participantType: foundOfficial ? ParticipantType.STAFF : prev.participantType
        }));
        if (foundOfficial) showToast("Vínculo oficial identificado. Setor preenchido.", "success");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.name) {
      showToast("Preencha os campos obrigatórios.");
      return;
    }
    const finalData = { 
        ...formData, 
        unit,
        sector: !formData.sector ? 'Atendimento Externo' : formData.sector 
    };
    onSubmit(finalData);
    setFormData({ ...defaultState, date: getToday() });
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Estudo Bíblico</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidade {unit}</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start">
             {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
               <button
                 key={type}
                 type="button"
                 onClick={() => setFormData({...formData, participantType: type})}
                 className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === type ? 'bg-white shadow-lg text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {type}
               </button>
             ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data do Atendimento *</label>
            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do Aluno *</label>
            <Autocomplete 
                options={studentOptions} 
                value={formData.name} 
                onChange={v => setFormData({...formData, name: v})} 
                onSelectOption={handleSelectStudent} 
                placeholder="Busque por nome ou matrícula..." 
            />
            <p className="text-[8px] text-slate-400 font-bold ml-2 uppercase tracking-tighter italic">Selecione registros com <i className="fas fa-magic text-blue-500"></i> para preenchimento automático.</p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Localização *</label>
            <Autocomplete 
                options={sectorOptions} 
                value={formData.sector} 
                onChange={v => setFormData({...formData, sector: v})} 
                placeholder="Escolha o local do estudo..." 
                isStrict={true} 
            />
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">WhatsApp / Contato</label><input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Guia de Estudo *</label><Autocomplete options={studySuggestions.map(s => ({value: s, label: s}))} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Nome do guia..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nº da Lição *</label><input type="number" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" /></div>
          
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Status do Curso *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Observações Adicionais</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium" /></div>
        </div>
        <button type="submit" className="w-full py-6 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs active:scale-95 transition-all hover:bg-blue-700">Gravar Registro de Estudo</button>
      </form>

      <HistorySection<BibleStudy>
        data={history}
        users={users}
        currentUser={currentUser}
        isLoading={isLoading}
        searchFields={['name']}
        renderItem={(item) => (
          <HistoryCard 
            key={item.id} 
            icon="📖" 
            color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-blue-600"} 
            title={item.name} 
            subtitle={`${item.sector} • Lição ${item.lesson} • ${item.status}`} 
            chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
            isLocked={isRecordLocked(item.date, currentUser.role)}
            isAdmin={currentUser.role === UserRole.ADMIN}
            users={users}
            onTransfer={(newUid) => onTransfer?.('study', item.id, newUid)}
            onEdit={() => onEdit?.(item)} 
            onDelete={() => onDelete(item.id)}
            middle={
               item.participantType && item.participantType !== ParticipantType.STAFF && (
                 <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${item.participantType === ParticipantType.PATIENT ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.participantType === ParticipantType.PATIENT ? 'Paciente' : 'Prestador'}
                 </span>
               )
            }
          />
        )}
      />
    </div>
  );
};

export default BibleStudyForm;
