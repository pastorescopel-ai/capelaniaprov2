
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, StaffVisit, User, UserRole, VisitReason, ProStaff, ParticipantType } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete, { AutocompleteOption } from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';
import { normalizeString, formatWhatsApp } from '../../utils/formatters';

interface FormProps {
  unit: Unit;
  users: User[];
  currentUser: User;
  history: StaffVisit[];
  editingItem?: StaffVisit;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: StaffVisit) => void;
  onSubmit: (data: any) => void;
  onToggleReturn?: (id: string) => void;
}

const StaffVisitForm: React.FC<FormProps> = ({ unit, users, currentUser, history, editingItem, isLoading, onSubmit, onDelete, onEdit, onToggleReturn }) => {
  const { proStaff, proProviders, proSectors, syncMasterContact } = useApp();
  
  const getToday = () => new Date().toLocaleDateString('en-CA');

  const defaultState = { 
    id: '', 
    date: getToday(), 
    sector: '', 
    reason: VisitReason.ROTINA, 
    staffName: '', 
    whatsapp: '', 
    participantType: ParticipantType.STAFF, // Padrão: Colaborador
    providerRole: '', // Apenas para Prestadores
    requiresReturn: false, 
    returnDate: getToday(), 
    returnCompleted: false, 
    observations: '' 
  };
  
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();

  // --- RESET INTELIGENTE AO ENTRAR NA ABA ---
  useEffect(() => {
    if (!editingItem) {
      setFormData(prev => ({ ...defaultState, date: prev.date || getToday(), participantType: prev.participantType }));
    }
  }, []); // Executa apenas na montagem (entrada na aba)

  const sectorOptions = useMemo(() => {
    return proSectors.filter(s => s.unit === unit).map(s => ({value: s.name, label: s.name})).sort((a,b) => a.label.localeCompare(b.label));
  }, [proSectors, unit]);

  // Opções dinâmicas baseadas no tipo selecionado (Colaborador vs Prestador)
  const nameOptions = useMemo(() => {
    const options: AutocompleteOption[] = [];
    
    if (formData.participantType === ParticipantType.STAFF) {
        // Modo Colaborador: Fonte proStaff (RH)
        proStaff.filter(s => s.unit === unit).forEach(staff => {
          const sector = proSectors.find(sec => sec.id === staff.sectorId);
          const staffIdStr = String(staff.id);
          options.push({
            value: staff.name,
            label: `${staff.name} (${staffIdStr.split('-')[1] || staffIdStr})`,
            subLabel: sector ? sector.name : 'Setor não informado',
            category: 'RH'
          });
        });
    } else {
        // Modo Prestador: Fonte proProviders
        proProviders.filter(p => p.unit === unit).forEach(provider => {
            options.push({
                value: provider.name,
                label: provider.name,
                subLabel: provider.sector || 'Sem setor fixo',
                category: 'RH' // Usamos a categoria visual 'RH' para indicar registro salvo
            });
        });
    }

    // Histórico (apenas nomes que não estão na lista principal para evitar duplicatas visuais)
    const uniqueNames = new Set<string>();
    history.forEach(v => {
      // Filtra histórico pelo tipo atual para não misturar
      const historyType = (v as any).participantType || ParticipantType.STAFF;
      if (historyType === formData.participantType && v.staffName && !uniqueNames.has(normalizeString(v.staffName))) {
         // Verifica se já não foi adicionado via banco oficial
         const isOfficiallyListed = options.some(o => normalizeString(o.value) === normalizeString(v.staffName));
         if (!isOfficiallyListed) {
             uniqueNames.add(normalizeString(v.staffName));
             options.push({
                 value: v.staffName,
                 label: v.staffName,
                 subLabel: v.sector,
                 category: 'History'
             });
         }
      }
    });
    
    return options;
  }, [proStaff, proProviders, proSectors, unit, history, formData.participantType]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        ...editingItem, 
        whatsapp: (editingItem as any).whatsapp || '',
        participantType: (editingItem as any).participantType || ParticipantType.STAFF,
        providerRole: (editingItem as any).providerRole || '',
        date: editingItem.date ? editingItem.date.split('T')[0] : getToday(), 
        returnDate: editingItem.returnDate ? editingItem.returnDate.split('T')[0] : getToday(),
        observations: editingItem.observations || ''
      });
    }
  }, [editingItem]);

  const handleSelectName = (label: string) => {
      const nameOnly = label.split(' (')[0].trim();
      const match = label.match(/\((.*?)\)$/); // Tenta pegar matrícula se houver
      
      let foundSector = formData.sector;
      let foundWhatsapp = formData.whatsapp;

      if (formData.participantType === ParticipantType.STAFF) {
          // Lógica Colaborador (Imã do RH)
          let staff: ProStaff | undefined;
          if (match) {
              const rawId = match[1];
              staff = proStaff.find(s => s.id === `${unit}-${rawId}` || s.id === rawId || s.id === rawId.padStart(6, '0'));
          }
          if (!staff) {
              staff = proStaff.find(s => normalizeString(s.name) === normalizeString(nameOnly) && s.unit === unit);
          }

          if (staff) {
              const sector = proSectors.find(s => s.id === staff.sectorId);
              if (sector) {
                  foundSector = sector.name;
                  showToast(`Setor carregado: ${sector.name}`, "info");
              }
              if (staff.whatsapp) foundWhatsapp = formatWhatsApp(staff.whatsapp);
          }
      } else {
          // Lógica Prestador (Imã Reverso / Memória)
          const provider = proProviders.find(p => normalizeString(p.name) === normalizeString(nameOnly) && p.unit === unit);
          if (provider) {
              if (provider.sector) {
                  foundSector = provider.sector;
                  showToast(`Setor frequente: ${provider.sector}`, "info");
              }
              if (provider.whatsapp) foundWhatsapp = formatWhatsApp(provider.whatsapp);
          }
      }

      setFormData(prev => ({ 
        ...prev, 
        staffName: nameOnly, 
        whatsapp: foundWhatsapp,
        sector: foundSector
      }));
  };

  const handleClear = () => {
    setFormData({ ...defaultState, date: formData.date, participantType: formData.participantType });
    showToast("Campos limpos!", "info");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date) { showToast("O campo 'Data da Visita' é obrigatório."); return; }
    if (!formData.staffName) { showToast(`O campo '${formData.participantType === ParticipantType.STAFF ? 'Colaborador' : 'Nome do Prestador'}' é obrigatório.`); return; }
    if (!formData.sector) { showToast("O campo 'Setor / Localização' é obrigatório."); return; }
    if (!formData.reason) { showToast("O campo 'Motivo da Visita' é obrigatório."); return; }
    
    // --- VALIDAÇÃO RESTRITA (STRICT MODE) ---
    // 1. Validar Setor (Sempre deve ser oficial)
    const sectorExists = proSectors.some(s => s.name === formData.sector && s.unit === unit);
    if (!sectorExists) {
        showToast("O setor informado não consta na lista oficial.", "warning");
        return;
    }

    // 2. Validar Pessoa conforme Tipo
    if (formData.participantType === ParticipantType.STAFF) {
        // Colaborador: Deve existir no RH
        const staffExists = proStaff.some(s => normalizeString(s.name) === normalizeString(formData.staffName) && s.unit === unit);
        if (!staffExists) {
            showToast("O colaborador informado não consta no Banco de RH.", "warning");
            return;
        }
        // Sync simples (atualiza zap se necessário)
        if (formData.whatsapp) {
            await syncMasterContact(formData.staffName, formData.whatsapp, unit, ParticipantType.STAFF);
        }
    } else {
        // Prestador: Nome livre, mas salva no banco de prestadores (com vínculo de setor)
        // O "Imã Reverso": Salvamos o setor atual como o setor do prestador
        await syncMasterContact(formData.staffName, formData.whatsapp, unit, ParticipantType.PROVIDER, formData.sector);
    }
    
    onSubmit({...formData, unit});
    setFormData({ ...defaultState, date: getToday(), returnDate: getToday(), participantType: formData.participantType });
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Visita Pastoral</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidade {unit}</p>
          </div>
          
          <div className="flex items-center gap-2">
             {/* TOGGLE TIPO DE PESSOA */}
             <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start">
                <button 
                    type="button" 
                    onClick={() => setFormData({...defaultState, date: formData.date, participantType: ParticipantType.STAFF})} 
                    className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === ParticipantType.STAFF ? 'bg-white shadow-lg text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Colaborador
                </button>
                <button 
                    type="button" 
                    onClick={() => setFormData({...defaultState, date: formData.date, participantType: ParticipantType.PROVIDER})} 
                    className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === ParticipantType.PROVIDER ? 'bg-white shadow-lg text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Prestador
                </button>
             </div>

             <button type="button" onClick={handleClear} className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 transition-all flex items-center justify-center text-lg shadow-sm" title="Limpar Campos">
                <i className="fas fa-eraser"></i>
             </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data da Visita *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          
          <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">
                  {formData.participantType === ParticipantType.STAFF ? 'Colaborador Atendido *' : 'Nome do Prestador *'}
              </label>
              <Autocomplete 
                  options={nameOptions} 
                  value={formData.staffName} 
                  onChange={v => setFormData({...formData, staffName: v})} 
                  onSelectOption={handleSelectName} 
                  placeholder={formData.participantType === ParticipantType.STAFF ? "Busque por nome ou matrícula..." : "Busque ou digite o nome..."} 
                  isStrict={formData.participantType === ParticipantType.STAFF} 
              />
          </div>

          {/* Campo Extra para Prestador */}
          {formData.participantType === ParticipantType.PROVIDER && (
              <div className="space-y-1 md:col-span-2 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Função / Especialidade</label>
                  <input 
                      placeholder="Ex: Médico Cardiologista, Técnico de TI..." 
                      value={formData.providerRole} 
                      onChange={e => setFormData({...formData, providerRole: e.target.value})} 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-700" 
                  />
              </div>
          )}

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">WhatsApp (Opcional)</label><input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Motivo da Visita *</label><select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value as VisitReason})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold">{Object.values(VisitReason).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Localização *</label><Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local da visita..." isStrict={true} /></div>
          
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-rose-100 transition-all cursor-pointer" onClick={() => setFormData({...formData, requiresReturn: !formData.requiresReturn})}>
              <input type="checkbox" checked={formData.requiresReturn} readOnly className="w-6 h-6 rounded-lg text-rose-600 cursor-pointer" />
              <div><label className="font-black text-slate-700 text-xs uppercase tracking-widest cursor-pointer block">Necessita Retorno?</label></div>
            </div>
          </div>
          {formData.requiresReturn && (<div className="space-y-1 md:col-span-2 animate-in slide-in-from-left duration-300"><label className="text-[10px] font-black text-rose-500 ml-2 uppercase tracking-widest">Agendar Retorno para *</label><input type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full p-4 rounded-2xl border-2 border-rose-100 text-rose-700 font-black text-lg" /></div>)}
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Observações da Visita</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium" /></div>
        </div>
        <button type="submit" className="w-full py-6 bg-rose-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs hover:bg-rose-700 transition-all">Registrar Visita Pastoral</button>
      </form>

      <HistorySection<StaffVisit> 
        data={history} 
        users={users} 
        currentUser={currentUser} 
        isLoading={isLoading} 
        searchFields={['staffName']} 
        renderItem={(item) => (
            <HistoryCard 
                key={item.id} 
                icon="🤝" 
                color="text-rose-600" 
                title={item.staffName} 
                subtitle={`${item.sector} • ${item.reason}`} 
                chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} 
                isLocked={isRecordLocked(item.date, currentUser.role)} 
                onEdit={() => onEdit?.(item)} 
                onDelete={() => onDelete(item.id)} 
                middle={(item as any).participantType === ParticipantType.PROVIDER && (
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Prestador</span>
                )}
            />
        )} 
      />
    </div>
  );
};

export default StaffVisitForm;
