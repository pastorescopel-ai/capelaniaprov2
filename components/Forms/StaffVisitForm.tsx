
import React from 'react';
import { Unit, StaffVisit, User, VisitReason, ParticipantType } from '../../types';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
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
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: StaffVisit) => void;
  onSubmit: (data: any) => void;
  onToggleReturn?: (id: string) => void;
}

const StaffVisitForm: React.FC<FormProps> = ({ unit, users, currentUser, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit }) => {
  const {
    formData, setFormData,
    isSectorLocked, setIsSectorLocked,
    isSubmitting,
    sectorOptions, nameOptions,
    handleSelectName, handleClear, handleChangeName, handleFormSubmit, handlePerformReturn,
    sortedHistory, defaultState
  } = useStaffVisitForm({ unit, history, allHistory, editingItem, currentUser, onSubmit });

  const isStaff = formData.participantType === ParticipantType.STAFF;

  const headerActions = (
    <>
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start">
        <button type="button" onClick={() => { setFormData({...defaultState, date: formData.date, participantType: ParticipantType.STAFF}); setIsSectorLocked(false); }} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === ParticipantType.STAFF ? 'bg-white shadow-lg text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}>Colaborador</button>
        <button type="button" onClick={() => { setFormData({...defaultState, date: formData.date, participantType: ParticipantType.PROVIDER}); setIsSectorLocked(false); }} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${formData.participantType === ParticipantType.PROVIDER ? 'bg-white shadow-lg text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}>Prestador</button>
      </div>
      <button type="button" onClick={handleClear} className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 transition-all flex items-center justify-center text-lg shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
    </>
  );

  const historySection = (
    <HistorySection<StaffVisit> 
      data={sortedHistory} 
      users={users} 
      currentUser={currentUser} 
      isLoading={isLoading} 
      searchFields={['staffName']} 
      disableSort={true}
      renderItem={(item, index, allItems) => {
        const isAdmin = currentUser.role === 'ADMIN';
        const normalize = (s: string) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
        
        const isFulfilled = (visit: StaffVisit) => {
          if (!visit.requiresReturn) return true;
          const vDate = new Date(visit.date).getTime();
          return (allHistory.length > 0 ? allHistory : history).some(v => 
            v.id !== visit.id &&
            normalize(v.staffName) === normalize(visit.staffName) && 
            new Date(v.date).getTime() >= vDate
          );
        };

        const isPending = item.requiresReturn && !isFulfilled(item);
        const isPriority = isPending && (isAdmin || item.userId === currentUser.id);

        const prevItem = index > 0 ? allItems[index-1] : null;
        const isPrevPriority = prevItem ? (prevItem.requiresReturn && !isFulfilled(prevItem) && (isAdmin || prevItem.userId === currentUser.id)) : false;
        
        let sectionHeader = null;
        if (index === 0 && isPriority) {
          sectionHeader = (
            <div className="flex items-center gap-2 mb-2 mt-4 px-2">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">Retornos Pendentes</span>
              <div className="flex-1 h-[1px] bg-rose-100"></div>
            </div>
          );
        } else if ((index === 0 && !isPriority) || (isPrevPriority && !isPriority)) {
          sectionHeader = (
            <div className="flex items-center gap-2 mb-2 mt-8 px-2">
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
              {new Date(item.returnDate + 'T12:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
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
              isLocked={isRecordLocked(item.date, currentUser.role)} 
              onEdit={() => onEdit?.(item)} 
              onDelete={() => onDelete(item.id)} 
              middle={returnBadge || ((item as any).participantType === ParticipantType.PROVIDER && (<span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Prestador</span>))}
              extra={returnFlag}
            />
          </React.Fragment>
        );
      }} 
    />
  );

  return (
    <FormScaffold title="Visita Pastoral" subtitle={`Unidade ${unit}`} headerActions={headerActions} history={historySection}>
      <form onSubmit={handleFormSubmit} className="space-y-4 md:space-y-6">
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data da Visita *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-rose-500/20 transition-all" /></div>
          
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">{isStaff ? 'Colaborador Atendido *' : 'Nome do Prestador *'}</label><Autocomplete options={nameOptions} value={formData.staffName} onChange={handleChangeName} onSelectOption={handleSelectName} placeholder={isStaff ? "Busque por nome ou matrícula..." : "Busque ou digite o nome..."} isStrict={isStaff} /></div>

          {!isStaff && (
              <div className="space-y-1 md:col-span-2 animate-in slide-in-from-top-2 duration-300"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Função / Especialidade</label><input placeholder="Ex: Médico Cardiologista, Técnico de TI..." value={formData.providerRole} onChange={e => setFormData({...formData, providerRole: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 focus:ring-2 focus:ring-rose-500/20 transition-all" /></div>
          )}

          <div className="space-y-1"><label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${!isStaff ? 'text-rose-600' : 'text-slate-400'}`}>WhatsApp {!isStaff ? '(Obrigatório)' : '(Opcional)'}</label><input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className={`w-full p-3 md:p-4 rounded-2xl border-none font-bold transition-all focus:ring-2 focus:ring-rose-500/20 ${!isStaff ? 'bg-rose-50 text-rose-900 ring-2 ring-rose-100 focus:ring-rose-300' : 'bg-slate-50'}`} /></div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Motivo da Visita *</label><select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value as VisitReason})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-rose-500/20 transition-all">{Object.values(VisitReason).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          
          <div className="space-y-1 md:col-span-2">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${isStaff ? 'text-slate-400' : 'text-slate-300'}`}>Setor / Local {isStaff ? '(Obrigatório)' : '(Opcional)'}</label>
              {isSectorLocked ? (
                  <div className="w-full p-3 md:p-4 rounded-2xl bg-slate-100 border border-slate-200 font-bold text-slate-500 cursor-not-allowed flex justify-between items-center group relative" title="Vínculo oficial do RH"><span>{formData.sector}</span><i className="fas fa-lock text-slate-400"></i><span className="absolute -top-2 right-2 bg-blue-100 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">RH Link</span></div>
              ) : (
                  <Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local da visita..." isStrict={isStaff} />
              )}
          </div>
          
          <div className="space-y-1 md:col-span-2"><div className="flex items-center gap-4 p-4 md:p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-rose-100 transition-all cursor-pointer active:scale-[0.99]" onClick={() => setFormData({...formData, requiresReturn: !formData.requiresReturn})}><input type="checkbox" checked={formData.requiresReturn} readOnly className="w-6 h-6 rounded-lg text-rose-600 cursor-pointer" /><div><label className="font-black text-slate-700 text-xs uppercase tracking-widest cursor-pointer block">Necessita Retorno?</label></div></div></div>
          {formData.requiresReturn && (<div className="space-y-1 md:col-span-2 animate-in slide-in-from-left duration-300"><label className="text-[10px] font-black text-rose-500 ml-2 uppercase tracking-widest">Agendar Retorno para *</label><input type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl border-2 border-rose-100 text-rose-700 font-black text-lg focus:ring-2 focus:ring-rose-500/20 transition-all" /></div>)}
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Observações da Visita</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none font-medium focus:ring-2 focus:ring-rose-500/20 transition-all" /></div>
        </div>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className={`w-full py-4 md:py-6 text-white font-black rounded-2xl shadow-xl uppercase text-xs transition-all flex items-center justify-center gap-2
            ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-rose-600 shadow-rose-600/20 hover:bg-rose-700 hover:-translate-y-1 active:scale-95'}`}
        >
          {isSubmitting ? (
            <>
              <i className="fas fa-circle-notch fa-spin"></i>
              Gravando...
            </>
          ) : 'Registrar Visita Pastoral'}
        </button>
      </form>
    </FormScaffold>
  );
};

export default StaffVisitForm;
