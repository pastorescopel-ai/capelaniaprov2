
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Unit, SmallGroup, User, ProGroup } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';
import { normalizeString, formatWhatsApp } from '../../utils/formatters';
import { ParticipantType } from '../../types';

interface FormProps {
  unit: Unit;
  groupsList?: string[];
  users: User[];
  currentUser: User;
  history: SmallGroup[];
  editingItem?: SmallGroup;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: SmallGroup) => void;
  onSubmit: (data: any) => void;
}

const SmallGroupForm: React.FC<FormProps> = ({ unit, groupsList = [], users, currentUser, history, editingItem, isLoading, onSubmit, onDelete, onEdit }) => {
  const { proSectors, proGroups, proStaff, saveRecord, visitRequests, syncMasterContact, proGroupLocations } = useApp();
  
  const getToday = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const defaultState = useMemo(() => ({ id: '', date: getToday(), sector: '', groupName: '', leader: '', leaderPhone: '', shift: 'Manhã', participantsCount: 0, observations: '' }), [getToday]);
  const [formData, setFormData] = useState(defaultState);
  const [isSectorLocked, setIsSectorLocked] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!editingItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({ ...defaultState, date: prev.date || getToday() }));
      setIsSectorLocked(false);
    }
  }, [editingItem, defaultState, getToday]);

  useEffect(() => {
    if (!formData.groupName && !editingItem) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData(prev => ({ ...prev, leader: '', leaderPhone: '', sector: '' }));
        setIsSectorLocked(false);
    }
  }, [formData.groupName, editingItem]);

  const sectorOptions = useMemo(() => proSectors.filter(s => s.unit === unit).map(s => ({ value: s.name, label: s.name })), [proSectors, unit]);
  const pgOptions = useMemo(() => proGroups.filter(g => g.unit === unit).map(g => ({ value: g.name, label: g.name })), [proGroups, unit]);
  const staffOptions = useMemo(() => proStaff.filter(s => s.unit === unit).map(staff => ({ value: staff.name, label: `${staff.name} (${String(staff.id).split('-')[1] || staff.id})`, category: 'RH' as const })), [proStaff, unit]);

  useEffect(() => {
    if (editingItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({ ...editingItem, date: editingItem.date ? editingItem.date.split('T')[0] : getToday(), observations: editingItem.observations || '', leaderPhone: editingItem.leaderPhone || '' });
      const pg = proGroups.find(g => g.name === editingItem.groupName && g.unit === unit);
      if (pg) {
          const loc = proGroupLocations.find(l => l.groupId === pg.id);
          setIsSectorLocked(!!loc);
      }
    }
  }, [editingItem, proGroups, proGroupLocations, unit, getToday]);

  const handleSelectPG = (pgName: string) => {
      const pgMaster = proGroups.find(g => g.name === pgName && g.unit === unit);
      const leaderName = pgMaster?.currentLeader || '';
      let leaderSector = '';
      let leaderPhone = pgMaster?.leaderPhone ? formatWhatsApp(pgMaster.leaderPhone) : '';
      let locked = false;
      
      if (pgMaster) {
          const location = proGroupLocations.find(l => l.groupId === pgMaster.id);
          if (location) {
              const sec = proSectors.find(s => s.id === location.sectorId);
              if (sec) { leaderSector = sec.name; locked = true; }
          }
          
          // Busca oficial no RH (proStaff) para garantir dados atualizados e oficiais
          if (leaderName) {
              const staff = proStaff.find(s => normalizeString(s.name) === normalizeString(leaderName) && s.unit === unit);
              if (staff) {
                  const sec = proSectors.find(s => s.id === staff.sectorId);
                  if (sec && !leaderSector) {
                      leaderSector = sec.name;
                      locked = true; 
                  }
                  if (staff.whatsapp) {
                      leaderPhone = formatWhatsApp(staff.whatsapp);
                  }
              }
          }
      }
      setIsSectorLocked(locked);
      setFormData(prev => ({ ...prev, groupName: pgName, leader: leaderName, leaderPhone: leaderPhone, sector: leaderSector }));
      if(leaderName || leaderSector) showToast("Dados oficiais do líder carregados.", "info");
  };

  const handleSelectLeader = (label: string) => {
      const nameOnly = label.split(' (')[0].trim();
      const match = label.match(/\((.*?)\)$/);
      let foundPhone = formData.leaderPhone;
      let foundSector = formData.sector;
      let lockSector = false;

      let staff: any;
      if (match) staff = proStaff.find(s => s.id === `${unit}-${match[1]}` || s.id === match[1]);
      if (!staff) staff = proStaff.find(s => normalizeString(s.name) === normalizeString(nameOnly) && s.unit === unit);

      if (staff) {
          if (staff.whatsapp) foundPhone = formatWhatsApp(staff.whatsapp);
          const sector = proSectors.find(s => s.id === staff.sectorId);
          if (sector) {
              foundSector = sector.name;
              lockSector = true;
          }
      }

      setFormData(prev => ({ ...prev, leader: nameOnly, leaderPhone: foundPhone, sector: foundSector }));
      setIsSectorLocked(lockSector);
      if (lockSector) showToast("Setor e WhatsApp vinculados ao cadastro.", "info");
  };

  const handleClear = () => {
    setFormData({ ...defaultState, date: formData.date });
    setIsSectorLocked(false);
    showToast("Campos limpos!", "info");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.groupName || !formData.leader || !formData.leaderPhone || !formData.sector) { showToast("Preencha todos os campos obrigatórios."); return; }
    
    // Validação de Líder Oficial (RH)
    const isOfficialLeader = proStaff.some(s => normalizeString(s.name) === normalizeString(formData.leader) && s.unit === unit);
    if (!isOfficialLeader) {
        showToast("Líder não reconhecido. Por favor, use o campo de busca para selecionar um colaborador oficial do RH.", "warning");
        return;
    }

    if (!proGroups.some(g => g.name === formData.groupName && g.unit === unit)) { showToast("Selecione um Pequeno Grupo válido da lista.", "warning"); return; }
    if (!proSectors.some(s => s.name === formData.sector && s.unit === unit)) { showToast("Selecione um setor oficial válido.", "warning"); return; }
    
    await syncMasterContact(formData.leader, formData.leaderPhone, unit, ParticipantType.STAFF);
    const pgMaster = proGroups.find(g => g.name === formData.groupName && g.unit === unit);
    if (pgMaster) {
        const cleanPhone = formData.leaderPhone.replace(/\D/g, '');
        if (cleanPhone !== (pgMaster.leaderPhone || '')) {
            await saveRecord('proGroups', { ...pgMaster, leaderPhone: cleanPhone });
        }
    }
    const pendingAgenda = visitRequests.find(req => (req.status === 'assigned' || req.status === 'pending') && (req.assignedChaplainId === currentUser.id) && normalizeString(req.pgName) === normalizeString(formData.groupName));
    if (pendingAgenda) await saveRecord('visitRequests', { ...pendingAgenda, status: 'confirmed', isRead: true });

    onSubmit({ ...formData, unit, leaderPhone: formData.leaderPhone.replace(/\D/g, '') });
    setFormData({ ...defaultState, date: getToday() });
    setIsSectorLocked(false);
  };

  const headerActions = (
    <button type="button" onClick={handleClear} className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 transition-all flex items-center justify-center text-lg shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
  );

  const historySection = (
    <HistorySection<SmallGroup> data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['groupName', 'leader']} renderItem={(item) => (
      <HistoryCard key={item.id} icon="🏠" color="text-emerald-600" title={item.groupName} subtitle={`${item.sector} • ${item.participantsCount} participantes • Líder: ${item.leader}`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} />
    )} />
  );

  return (
    <FormScaffold title="Pequeno Grupo" subtitle={`Unidade ${unit}`} headerActions={headerActions} history={historySection}>
      <form onSubmit={handleFormSubmit} className="space-y-4 md:space-y-6">
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data do Encontro *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do Grupo *</label><Autocomplete options={pgOptions} value={formData.groupName} onChange={v => setFormData({...formData, groupName: v})} onSelectOption={handleSelectPG} placeholder="Selecione o PG..." isStrict={true} /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Líder Atual *</label><Autocomplete options={staffOptions} value={formData.leader} onChange={v => { setFormData({...formData, leader: v}); if(!v) setIsSectorLocked(false); }} onSelectOption={handleSelectLeader} placeholder="Busque o líder no banco..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">WhatsApp do Líder *</label><input placeholder="(00) 00000-0000" value={formData.leaderPhone} onChange={e => setFormData({...formData, leaderPhone: formatWhatsApp(e.target.value)})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all" /></div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Localização *</label>
            {isSectorLocked ? (<div className="w-full p-3 md:p-4 rounded-2xl bg-slate-100 border border-slate-200 font-bold text-slate-500 cursor-not-allowed flex justify-between items-center"><span>{formData.sector}</span><i className="fas fa-lock text-slate-400"></i></div>) : (<Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Onde o PG se reúne?" isStrict={true} />)}
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nº de Participantes *</label><input type="number" value={formData.participantsCount || ''} onChange={e => setFormData({...formData, participantsCount: parseInt(e.target.value)})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-black focus:ring-2 focus:ring-emerald-500/20 transition-all" placeholder="0" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Turno *</label><select value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all"><option>Manhã</option><option>Tarde</option><option>Noite</option></select></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Relato / Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all" /></div>
        </div>
        <button type="submit" className="w-full py-4 md:py-6 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 uppercase text-xs active:scale-95 transition-all hover:bg-emerald-700 hover:-translate-y-1">Salvar Registro de PG</button>
      </form>
    </FormScaffold>
  );
};

export default SmallGroupForm;
