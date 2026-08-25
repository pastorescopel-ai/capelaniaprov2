
import React, { useEffect } from 'react';
import { Unit, SmallGroup, User, UserRole } from '../../types';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
import Button from '../Shared/Button';
import MonthComparisonBars from '../Shared/MonthComparisonBars';
import { isRecordLocked } from '../../utils/validators';
import { formatWhatsApp, formatNameCounts } from '../../utils/formatters';
import { useSmallGroupForm } from '../../hooks/useSmallGroupForm';
import { useMonthComparison } from '../../hooks/useMonthComparison';

interface FormProps {
  unit: Unit;
  groupsList?: string[];
  users: User[];
  currentUser: User;
  history: SmallGroup[];
  allHistory?: SmallGroup[];
  editingItem?: SmallGroup;
  isLoading?: boolean;
  onDelete: (id: string) => void;
  onEdit?: (item: SmallGroup) => void;
  onSubmit: (data: any) => void;
  isActive?: boolean;
}

const SmallGroupForm: React.FC<FormProps> = ({ unit, groupsList = [], users, currentUser, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit, isActive }) => {
  const monthComparison = useMonthComparison(allHistory, currentUser.id, unit);
  // formatNameCounts junta o mesmo PG reunido 2x no mês numa linha só ("Nome (2x)").
  const curPGNames = formatNameCounts(monthComparison.curItems.map(g => g.groupName).filter(Boolean));
  const prevPGNames = formatNameCounts(monthComparison.prevItems.map(g => g.groupName).filter(Boolean));
  const {
    formData, setFormData,
    isSectorLocked, setIsSectorLocked,
    isSubmitting,
    sectorOptions, pgOptions, staffOptions,
    handleSelectPG, handleSelectLeader, handleLeaderChange, handleClear, handleFormSubmit
  } = useSmallGroupForm({ unit, history, editingItem, currentUser, onSubmit, isActive });

  const isAdmin = currentUser.role === UserRole.ADMIN;

  // Refs para controle de foco
  const phoneInputRef = React.useRef<HTMLInputElement>(null);
  const participantsInputRef = React.useRef<HTMLInputElement>(null);

  // Foca uma única vez quando a missão é carregada -- antes dependia de
  // `formData.leaderPhone`, então rodava de novo a cada dígito digitado no campo de
  // WhatsApp e, 500ms depois, arrancava o foco pro campo de participantes (porque o
  // telefone tinha acabado de deixar de estar vazio). Usa o valor do telefone que já
  // veio com a missão (não o estado ao vivo do formulário) pra decidir o foco inicial.
  const focusedMissionIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (editingItem && (editingItem as any).isMission) {
      const missionId = (editingItem as any).id || (editingItem as any).visitRequestId || (editingItem as any).groupName;
      if (focusedMissionIdRef.current === missionId) return;
      focusedMissionIdRef.current = missionId;
      const initialPhone = (editingItem as any).leaderPhone;
      setTimeout(() => {
        if (!initialPhone) {
          phoneInputRef.current?.focus();
        } else {
          participantsInputRef.current?.focus();
        }
      }, 500);
    } else if (!editingItem) {
      focusedMissionIdRef.current = null;
    }
  }, [editingItem]);

  const headerActions = React.useMemo(() => (
    <button type="button" onClick={handleClear} className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 active:scale-95 transition-all flex items-center justify-center text-sm shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
  ), [handleClear]);

  const historySection = React.useMemo(() => (
    <HistorySection<SmallGroup> data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['groupName', 'leader']} renderItem={(item) => (
      <HistoryCard key={item.id} icon="🏠" color="text-emerald-600" title={item.groupName} subtitle={`${item.sector} • ${item.participantsCount} participantes • Líder: ${item.leader}`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} />
    )} />
  ), [history, users, currentUser, isLoading, onEdit, onDelete]);

  return (
    <FormScaffold
      title="Pequeno Grupo"
      subtitle={`Unidade ${unit}`}
      headerActions={headerActions}
      history={historySection}
      compareWidget={<MonthComparisonBars label="PGs" color="#10b981" {...monthComparison} curNames={curPGNames} prevNames={prevPGNames} />}
    >
      <form onSubmit={handleFormSubmit} className="space-y-4 md:space-y-5">
        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          {isAdmin && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Capelão Responsável</label>
              <select 
                value={formData.userId} 
                onChange={e => setFormData({...formData, userId: e.target.value})} 
                className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data do Encontro *</label><input type="date" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do Grupo *</label><Autocomplete options={pgOptions} value={formData.groupName || ''} onChange={v => setFormData({...formData, groupName: v})} onSelectOption={handleSelectPG} placeholder="Selecione o PG..." isStrict={true} /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Líder Atual *</label><Autocomplete options={staffOptions} value={formData.leader || ''} onChange={handleLeaderChange} onSelectOption={handleSelectLeader} placeholder="Busque o líder no banco..." /></div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">WhatsApp do Líder *</label>
            <input
              ref={phoneInputRef}
              type="tel"
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              value={formData.leaderPhone || ''}
              onChange={e => setFormData({...formData, leaderPhone: formatWhatsApp(e.target.value)})}
              className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            {/* Há números incompletos/de outra pessoa no cadastro (preenchimento automático por
                nome pode pegar o registro errado em caso de homônimo) -- por isso o campo é
                editável e pedimos confirmação explícita antes de salvar. */}
            <p className="text-[10px] font-bold text-amber-600 ml-2 mt-0.5">
              ⚠️ Confira se este é realmente o WhatsApp correto do líder antes de salvar — o preenchimento automático pode trazer um número desatualizado ou de outra pessoa.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Setor / Localização *</label>
            {isSectorLocked ? (<div className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-100 border border-slate-200 font-bold text-slate-500 cursor-not-allowed flex justify-between items-center"><span>{formData.sector || ''}</span><i className="fas fa-lock text-slate-400"></i></div>) : (<Autocomplete options={sectorOptions} value={formData.sector || ''} onChange={v => setFormData({...formData, sector: v})} placeholder="Onde o PG se reúne?" isStrict={true} />)}
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nº de Participantes *</label><input ref={participantsInputRef} type="number" min={0} value={formData.participantsCount || ''} onChange={e => setFormData({...formData, participantsCount: Math.max(0, parseInt(e.target.value) || 0)})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-black text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all" placeholder="0" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Turno *</label><select value={formData.shift || 'Manhã'} onChange={e => setFormData({...formData, shift: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"><option>Manhã</option><option>Tarde</option><option>Noite</option></select></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Relato / Observações</label><textarea value={formData.observations || ''} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all" /></div>
        </div>
        <Button 
          type="submit" 
          variant="success"
          isLoading={isSubmitting}
          className="w-full py-4 md:py-5 text-xs"
        >
          Salvar Registro
        </Button>
      </form>
    </FormScaffold>
  );
};

export default SmallGroupForm;
