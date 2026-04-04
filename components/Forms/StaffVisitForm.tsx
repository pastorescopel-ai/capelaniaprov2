
import React from 'react';
import { Unit, StaffVisit, User, UserRole, VisitReason, ParticipantType } from '../../types';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
import Button from '../Shared/Button';
import { isRecordLocked } from '../../utils/validators';
import { formatWhatsApp } from '../../utils/formatters';
import { useStaffVisitForm } from '../../hooks/useStaffVisitForm';

interface FormProps {
  unit: Unit;
  users: User[];
  currentUser: User;
  history: StaffVisit[];
  allHistory?: StaffVisit[];
  editingItem?: StaffVisit;
  isLoading?: boolean;
  onDelete: (id: string) => void;
  onEdit?: (item: StaffVisit) => void;
  onSubmit: (data: any) => void;
}

const StaffVisitForm: React.FC<FormProps> = ({ unit, users, currentUser, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit }) => {
  const {
    formData, setFormData,
    isSectorLocked, setIsSectorLocked,
    isSubmitting,
    sectorOptions, nameOptions,
    editAuthorizations,
    handleSelectName, handleClear, handleChangeName, handleFormSubmit, handlePerformReturn,
    sortedHistory, defaultState
  } = useStaffVisitForm({ unit, history, allHistory, editingItem, currentUser, onSubmit });

  const isAdmin = currentUser.role === UserRole.ADMIN;

  const isStaff = formData.participantType === ParticipantType.STAFF;

  const headerActions = React.useMemo(() => (
    <>
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
        <button type="button" onClick={() => { setFormData({...defaultState, date: formData.date, participantType: ParticipantType.STAFF}); setIsSectorLocked(false); }} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${formData.participantType === ParticipantType.STAFF ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}>Colaborador</button>
        <button type="button" onClick={() => { setFormData({...defaultState, date: formData.date, participantType: ParticipantType.PROVIDER}); setIsSectorLocked(false); }} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${formData.participantType === ParticipantType.PROVIDER ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}>Prestador</button>
      </div>
      <button type="button" onClick={handleClear} className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 active:scale-95 transition-all flex items-center justify-center text-sm shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
    </>
  ), [formData.date, formData.participantType, defaultState, handleClear, setFormData, setIsSectorLocked]);

  const historySection = React.useMemo(() => (
    <HistorySection<StaffVisit> 
      data={sortedHistory} 
      users={users} 
      currentUser={currentUser} 
      isLoading={isLoading} 
      searchFields={['staffName']} 
      disableSort={true}
      bypassFilter={(item) => {
        if (!item.requiresReturn) return false;
        const isAdmin = currentUser.role === 'ADMIN';
        if (!isAdmin && item.userId !== currentUser.id) return false;
        
        const normalize = (s: string) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
        const vDate = new Date(item.date).getTime();
        const isFulfilled = (allHistory.length > 0 ? allHistory : history).some(v => {
          if (v.id === item.id) return false;
          
          // ID-BASED LINKING
          if (item.staffId && v.staffId) {
            return v.staffId === item.staffId && new Date(v.date).getTime() >= vDate;
          }
          if (item.providerId && v.providerId) {
            return v.providerId === item.providerId && new Date(v.date).getTime() >= vDate;
          }

          // Fallback to name
          return normalize(v.staffName) === normalize(item.staffName) && new Date(v.date).getTime() >= vDate;
        });
        return !isFulfilled;
      }}
      renderItem={(item, index, allItems) => {
        const isAdmin = currentUser.role === 'ADMIN';
        const normalize = (s: string) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
        
        const isFulfilled = (visit: StaffVisit) => {
          if (!visit.requiresReturn) return true;
          const vDate = new Date(visit.date).getTime();
          return (allHistory.length > 0 ? allHistory : history).some(v => {
            if (v.id === visit.id) return false;

            // ID-BASED LINKING
            if (visit.staffId && v.staffId) {
              return v.staffId === visit.staffId && new Date(v.date).getTime() >= vDate;
            }
            if (visit.providerId && v.providerId) {
              return v.providerId === visit.providerId && new Date(v.date).getTime() >= vDate;
            }

            // Fallback to name
            return normalize(v.staffName) === normalize(visit.staffName) && new Date(v.date).getTime() >= vDate;
          });
        };

        const isPending = item.requiresReturn && !isFulfilled(item);
        const isPriority = isPending && (isAdmin || item.userId === currentUser.id);

        const prevItem = index > 0 ? allItems[index-1] : null;
        const isPrevPriority = prevItem ? (prevItem.requiresReturn && !isFulfilled(prevItem) && (isAdmin || prevItem.userId === currentUser.id)) : false;
        
        let sectionHeader = null;
        if (index === 0 && isPriority) {
          sectionHeader = (
            <div id="return-history-header" className="flex items-center gap-2 mb-2 mt-4 px-2">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">Retornos Pendentes</span>
              <div className="flex-1 h-[1px] bg-rose-100"></div>
            </div>
          );
        } else if ((index === 0 && !isPriority) || (isPrevPriority && !isPriority)) {
          sectionHeader = (
            <div id="history-section" className="flex items-center gap-2 mb-2 mt-8 px-2">
              <div className="w-2 h-2 rounded-full bg-slate-300"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Histórico Geral</span>
              <div className="flex-1 h-[1px] bg-slate-100"></div>
            </div>
          );
        }

        let isReturnFulfilled = false;
        if (item.requiresReturn) {
          const itemDate = new Date(item.date).getTime();
          const subsequentVisit = (allHistory.length > 0 ? allHistory : history).find(v => 
            v.id !== item.id &&
            normalize(v.staffName) === normalize(item.staffName) && 
            new Date(v.date).getTime() >= itemDate
          );
          if (subsequentVisit) {
            isReturnFulfilled = true;
          }
        }

        const returnBadge = item.requiresReturn ? (
          <div className={`px-3 py-1 rounded-lg border flex flex-col items-center justify-center ${isReturnFulfilled ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
            <span className={`text-[8px] font-black uppercase tracking-widest ${isReturnFulfilled ? 'text-emerald-400' : 'text-rose-400'}`}>Retorno</span>
            <span className={`text-[10px] font-black ${isReturnFulfilled ? 'text-emerald-600' : 'text-rose-600'}`}>
              {(() => {
                const d = typeof item.returnDate === 'number' ? new Date(item.returnDate) : new Date(String(item.returnDate).split('T')[0] + 'T12:00:00');
                return isNaN(d.getTime()) ? 'Data Inválida' : d.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
              })()}
            </span>
          </div>
        ) : null;

        const returnFlag = item.requiresReturn ? (
          <div className="flex items-center gap-2 mr-2">
            {isReturnFulfilled ? (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-emerald-50 border-emerald-100 text-emerald-500" title="Retorno Realizado">
                <i className="fas fa-flag text-xs"></i>
              </div>
            ) : (
              <button 
                onClick={() => handlePerformReturn(item)}
                className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm animate-pulse group/flag"
                title="Clique para realizar retorno"
              >
                <i className="fas fa-flag text-xs group-hover/flag:scale-125 transition-transform"></i>
              </button>
            )}
          </div>
        ) : null;

        return (
          <React.Fragment key={item.id}>
            {sectionHeader}
            <HistoryCard 
              icon="🤝" 
              color="text-rose-600" 
              title={item.staffName} 
              subtitle={`${item.sector} • ${item.reason}`} 
              chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} 
              isLocked={isRecordLocked(item.date, currentUser.role, 'staffVisits', editAuthorizations)} 
              onEdit={() => onEdit?.(item)} 
              onDelete={() => onDelete(item.id)} 
              middle={returnBadge || ((item as any).participantType === ParticipantType.PROVIDER && (<span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Prestador</span>))}
              extra={returnFlag}
            />
          </React.Fragment>
        );
      }} 
    />
  ), [sortedHistory, users, currentUser, isLoading, allHistory, history, handlePerformReturn, onDelete, onEdit, editAuthorizations]);

  return (
    <FormScaffold title="Visita Pastoral" subtitle={`Unidade ${unit}`} headerActions={headerActions} history={historySection}>
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
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data da Visita *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-rose-500/20 transition-all" /></div>
          
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">{isStaff ? 'Colaborador Atendido *' : 'Nome do Prestador *'}</label><Autocomplete options={nameOptions} value={formData.staffName} onChange={handleChangeName} onSelectOption={handleSelectName} placeholder={isStaff ? "Busque por nome ou matrícula..." : "Busque ou digite o nome..."} isStrict={false} /></div>

          {!isStaff && (
              <div className="space-y-1 md:col-span-2 animate-in slide-in-from-top-2 duration-300"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Função / Especialidade</label><input placeholder="Ex: Médico Cardiologista, Técnico de TI..." value={formData.providerRole} onChange={e => setFormData({...formData, providerRole: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm text-slate-700 focus:ring-2 focus:ring-rose-500/20 transition-all" /></div>
          )}

          <div className="space-y-1">
            <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${!isStaff ? 'text-rose-600' : 'text-slate-400'}`}>WhatsApp {!isStaff ? '(Obrigatório)' : '(Opcional)'}</label>
            <input 
              type="tel"
              inputMode="numeric"
              placeholder="(00) 00000-0000" 
              value={formData.whatsapp} 
              onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} 
              className={`w-full p-3 md:p-3.5 rounded-2xl border-none font-bold text-sm transition-all focus:ring-2 focus:ring-rose-500/20 ${!isStaff ? 'bg-rose-50 text-rose-900 ring-2 ring-rose-100 focus:ring-rose-300' : 'bg-slate-50'}`} 
            />
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Motivo da Visita *</label><select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value as VisitReason})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-rose-500/20 transition-all">{Object.values(VisitReason).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          
          <div className="space-y-1 md:col-span-2">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${isStaff ? 'text-slate-400' : 'text-slate-300'}`}>{isStaff ? 'Setor (Obrigatório)' : 'Local (Opcional)'}</label>
              {isStaff ? (
                isSectorLocked ? (
                    <div className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-100 border border-slate-200 font-bold text-slate-500 cursor-not-allowed flex justify-between items-center group relative" title="Vínculo oficial do RH"><span>{formData.sector}</span><i className="fas fa-lock text-slate-400"></i><span className="absolute -top-2 right-2 bg-blue-100 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">RH Link</span></div>
                ) : (
                    <Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Setor..." isStrict={false} />
                )
              ) : (
                  <input 
                    type="text" 
                    value={formData.location || ''} 
                    onChange={e => setFormData({...formData, location: e.target.value})} 
                    placeholder="Local da visita..." 
                    className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-rose-500/20 transition-all" 
                  />
              )}
          </div>
          
          <div className="space-y-1 md:col-span-2"><div className="flex items-center gap-4 p-4 md:p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-rose-100 transition-all cursor-pointer active:scale-[0.99]" onClick={() => setFormData({...formData, requiresReturn: !formData.requiresReturn})}><input type="checkbox" checked={formData.requiresReturn} readOnly className="w-6 h-6 rounded-lg text-rose-600 cursor-pointer" /><div><label className="font-black text-slate-700 text-xs uppercase tracking-widest cursor-pointer block">Necessita Retorno?</label></div></div></div>
          {formData.requiresReturn && (<div className="space-y-1 md:col-span-2 animate-in slide-in-from-left duration-300"><label className="text-[10px] font-black text-rose-500 ml-2 uppercase tracking-widest">Agendar Retorno para *</label><input type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl border-2 border-rose-100 text-rose-700 font-black text-sm focus:ring-2 focus:ring-rose-500/20 transition-all" /></div>)}
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Observações da Visita</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium focus:ring-2 focus:ring-rose-500/20 transition-all" /></div>
        </div>
        <Button 
          type="submit" 
          variant="danger"
          isLoading={isSubmitting}
          className="w-full py-4 md:py-5 text-xs"
        >
          Salvar Registro
        </Button>
      </form>
    </FormScaffold>
  );
};

export default StaffVisitForm;
