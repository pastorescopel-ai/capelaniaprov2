
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Unit, RecordStatus, BibleStudy, User, UserRole, MasterLists, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { formatWhatsApp, resolveDynamicName, getFirstName } from '../../utils/formatters';
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

const BibleStudyForm: React.FC<FormProps> = ({ unit, users, currentUser, masterLists, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit, onTransfer }) => {
  const { proStaff, proSectors } = useApp();
  const defaultState = { 
    id: '', 
    date: new Date().toISOString().split('T')[0], 
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
      .map(s => s.name)
      .sort();
  }, [proSectors, unit]);

  const studentOptions = useMemo(() => {
    const names = new Set<string>();
    // No modo STAFF, mostramos a lista oficial
    if (formData.participantType === ParticipantType.STAFF) {
        proStaff.filter(s => s.unit === unit).forEach(s => { names.add(`${s.name} (${s.id.split('-')[1] || s.id})`); });
    }
    // Sempre incluímos nomes do histórico do capelão
    allHistory.filter(s => s.userId === currentUser.id).forEach(s => { if(s.name) names.add(s.name.trim()); });
    return Array.from(names).sort();
  }, [allHistory, currentUser.id, proStaff, unit, formData.participantType]);

  const highlightOptions = useMemo(() => {
    if (formData.participantType !== ParticipantType.STAFF) return [];
    return proStaff.filter(s => s.unit === unit).map(s => `${s.name} (${s.id.split('-')[1] || s.id})`);
  }, [proStaff, unit, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      setFormData({
        ...editingItem,
        participantType: editingItem.participantType || ParticipantType.STAFF,
        date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0],
        observations: editingItem.observations || ''
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setFormData(defaultState);
    }
  }, [editingItem]);

  const handleSelectStudent = (selectedValue: string) => {
    if (formData.participantType === ParticipantType.STAFF) {
        const match = selectedValue.match(/\((.*?)\)$/);
        if (match) {
            const rawId = match[1];
            const staff = proStaff.find(s => s.id === `${unit}-${rawId}` || s.id === rawId);
            if (staff) {
                const sector = proSectors.find(s => s.id === staff.sectorId || s.id === `${unit}-${staff.sectorId}`);
                setFormData(prev => ({ 
                  ...prev, 
                  name: staff.name, 
                  sector: sector ? sector.name : prev.sector 
                }));
                showToast(`Vínculo oficial: ${staff.name}`, "success");
                return;
            }
        }
    }
    setFormData(prev => ({ ...prev, name: selectedValue.split(' (')[0] }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isFreeMode = formData.participantType !== ParticipantType.STAFF;
    
    // Validação flexível: Se for paciente/prestador, o setor não é obrigatório
    if (!formData.date || !formData.name || (!isFreeMode && !formData.sector)) {
      showToast("Preencha os campos obrigatórios.");
      return;
    }

    const finalData = { 
        ...formData, 
        unit,
        sector: isFreeMode && !formData.sector ? 'Atendimento Externo/Geral' : formData.sector 
    };
    
    onSubmit(finalData);
    setFormData(defaultState);
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">Estudo Bíblico ({unit})</h2>
          
          {/* SELETOR DE PÚBLICO */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 self-start">
             {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
               <button
                 key={type}
                 type="button"
                 onClick={() => setFormData({...formData, participantType: type})}
                 className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${formData.participantType === type ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {type}
               </button>
             ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome do Aluno *</label>
            <Autocomplete 
                options={studentOptions} 
                highlightOptions={highlightOptions} 
                value={formData.name} 
                onChange={v => setFormData({...formData, name: v})} 
                onSelectOption={handleSelectStudent} 
                placeholder={formData.participantType === ParticipantType.STAFF ? "Busca por nome ou matrícula..." : "Digite o nome livremente..."} 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor {formData.participantType === ParticipantType.STAFF ? '*' : '(Opcional)'}</label>
            <Autocomplete 
                options={sectorOptions} 
                value={formData.sector} 
                onChange={v => setFormData({...formData, sector: v})} 
                placeholder={formData.participantType === ParticipantType.STAFF ? "Local do atendimento..." : "Opcional p/ pacientes"} 
                isStrict={formData.participantType === ParticipantType.STAFF} 
            />
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">WhatsApp</label><input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Guia *</label><Autocomplete options={studySuggestions} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Nome do guia..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lição *</label><input type="number" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" /></div>
          
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-50 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs active:scale-95 transition-all">Salvar Registro</button>
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
