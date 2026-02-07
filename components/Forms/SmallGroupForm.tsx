
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, SmallGroup, User, UserRole, MasterLists, ProGroup, ProStaff, ParticipantType } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete, { AutocompleteOption } from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import { isRecordLocked } from '../../utils/validators';
import { useApp } from '../../contexts/AppContext';
import { normalizeString, formatWhatsApp } from '../../utils/formatters';

interface FormProps {
  unit: Unit;
  groupsList?: string[];
  users: User[];
  currentUser: User;
  masterLists: MasterLists;
  history: SmallGroup[];
  editingItem?: SmallGroup;
  isLoading?: boolean;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: SmallGroup) => void;
  onSubmit: (data: any) => void;
}

const SmallGroupForm: React.FC<FormProps> = ({ unit, groupsList = [], users, currentUser, masterLists, history, editingItem, isLoading, onSubmit, onDelete, onEdit }) => {
  // Corrigido: syncMasterContact agora é desestruturado do useApp, permitindo sincronização de contatos com o banco RH
  const { proSectors, proGroups, proStaff, saveRecord, visitRequests, syncMasterContact } = useApp();
  
  const getToday = () => new Date().toLocaleDateString('en-CA');

  const defaultState = { id: '', date: getToday(), sector: '', groupName: '', leader: '', leaderPhone: '', shift: 'Manhã', participantsCount: 0, observations: '' };
  const [formData, setFormData] = useState(defaultState);
  const { showToast } = useToast();

  const sectorOptions = useMemo(() => {
    return proSectors.filter(s => s.unit === unit).map(s => ({ value: s.name, label: s.name }));
  }, [proSectors, unit]);

  const pgOptions = useMemo(() => {
    return proGroups.filter(g => g.unit === unit).map(g => ({ value: g.name, label: g.name }));
  }, [proGroups, unit]);

  const staffOptions = useMemo(() => {
    return proStaff.filter(s => s.unit === unit).map(staff => {
      const staffIdStr = String(staff.id);
      return {
        value: staff.name,
        label: `${staff.name} (${staffIdStr.split('-')[1] || staffIdStr})`,
        // Fix: Usando casting 'as const' para garantir que a string literal seja compatível com o tipo da união no AutocompleteOption
        category: 'RH' as const
      };
    });
  }, [proStaff, unit]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ 
        ...editingItem, 
        date: editingItem.date ? editingItem.date.split('T')[0] : getToday(),
        observations: editingItem.observations || '',
        leaderPhone: editingItem.leaderPhone || ''
      });
    } else {
      setFormData({ ...defaultState, date: getToday() });
    }
  }, [editingItem]);

  const handleSelectPG = (pgName: string) => {
      const pgMaster = proGroups.find(g => g.name === pgName && g.unit === unit);
      const leaderName = pgMaster?.currentLeader || '';
      
      let leaderSector = '';
      let leaderPhone = pgMaster?.leaderPhone ? formatWhatsApp(pgMaster.leaderPhone) : '';
      
      if (leaderName) {
          const staff = proStaff.find(s => normalizeString(s.name) === normalizeString(leaderName) && s.unit === unit);
          if (staff) {
              const sec = proSectors.find(s => s.id === staff.sectorId);
              if (sec) leaderSector = sec.name;
              // PRIORIDADE MESTRE: Se o staff tem whatsapp salvo no RH, puxa dele
              if (staff.whatsapp) leaderPhone = formatWhatsApp(staff.whatsapp);
          }
      }

      setFormData(prev => ({ 
        ...prev, 
        groupName: pgName, 
        leader: leaderName || prev.leader,
        leaderPhone: leaderPhone || prev.leaderPhone,
        sector: leaderSector || prev.sector
      }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.groupName || !formData.leader || !formData.leaderPhone || !formData.sector) {
      showToast("Preencha todos os campos obrigatórios.");
      return;
    }
    
    // MASTER ENTITY SYNC: Garante que o contato do líder esteja salvo no RH oficial
    await syncMasterContact(formData.leader, formData.leaderPhone, unit, ParticipantType.STAFF);

    // Sincroniza também no banco de PGs para compatibilidade de busca rápida
    const pgMaster = proGroups.find(g => g.name === formData.groupName && g.unit === unit);
    if (pgMaster) {
        const cleanPhone = formData.leaderPhone.replace(/\D/g, '');
        if (cleanPhone !== (pgMaster.leaderPhone || '')) {
            await saveRecord('proGroups', { ...pgMaster, leaderPhone: cleanPhone });
        }
    }

    // Baixa automática de agendamento
    const pendingAgenda = visitRequests.find(req => 
      (req.status === 'assigned' || req.status === 'pending') && 
      (req.assignedChaplainId === currentUser.id) && 
      normalizeString(req.pgName) === normalizeString(formData.groupName)
    );

    if (pendingAgenda) {
      await saveRecord('visitRequests', { ...pendingAgenda, status: 'confirmed', isRead: true });
    }

    onSubmit({ ...formData, unit, leaderPhone: formData.leaderPhone.replace(/\D/g, '') });
    setFormData({ ...defaultState, date: getToday() });
  };

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Pequeno Grupo</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidade {unit}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data do Encontro *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do Grupo *</label><Autocomplete options={pgOptions} value={formData.groupName} onChange={v => setFormData({...formData, groupName: v})} onSelectOption={handleSelectPG} placeholder="Selecione o PG..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Líder Atual *</label><Autocomplete options={staffOptions} value={formData.leader} onChange={v => setFormData({...formData, leader: v})} placeholder="Busque o líder no banco..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">WhatsApp do Líder *</label><input placeholder="(00) 00000-0000" value={formData.leaderPhone} onChange={e => setFormData({...formData, leaderPhone: formatWhatsApp(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Localização *</label><Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Onde o PG se reúne?" isStrict={true} /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nº de Participantes *</label><input type="number" value={formData.participantsCount || ''} onChange={e => setFormData({...formData, participantsCount: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black" placeholder="0" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Turno *</label><select value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold"><option>Manhã</option><option>Tarde</option><option>Noite</option></select></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Relato / Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium" /></div>
        </div>
        <button type="submit" className="w-full py-6 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs active:scale-95 transition-all hover:bg-emerald-700">Salvar Registro de PG</button>
      </form>

      <HistorySection<SmallGroup>
        data={history}
        users={users}
        currentUser={currentUser}
        isLoading={isLoading}
        searchFields={['groupName', 'leader']}
        renderItem={(item) => (
          <HistoryCard key={item.id} icon="🏠" color="text-emerald-600" title={item.groupName} subtitle={`${item.sector} • ${item.participantsCount} participantes • Líder: ${item.leader}`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} />
        )}
      />
    </div>
  );
};

export default SmallGroupForm;
