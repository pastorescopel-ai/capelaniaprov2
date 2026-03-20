
import React from 'react';
import { Unit, RecordStatus, BibleStudy, User, UserRole, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
import Button from '../Shared/Button';
import { formatWhatsApp } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';
import { useBibleStudyForm } from '../../hooks/useBibleStudyForm';

interface FormProps {
  unit: Unit;
  users: User[];
  currentUser: User;
  history: BibleStudy[];
  allHistory?: BibleStudy[];
  editingItem?: BibleStudy;
  isLoading?: boolean;
  onDelete: (id: string) => void;
  onEdit?: (item: BibleStudy) => void;
  onSubmit: (data: any) => void;
  onTransfer?: (type: string, id: string, newUserId: string) => void;
}

const BibleStudyForm: React.FC<FormProps> = ({ unit, users, currentUser, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit, onTransfer }) => {
  const {
    formData, setFormData,
    isSectorLocked, setIsSectorLocked,
    isSubmitting,
    guideOptions, sectorOptions, studentOptions,
    editAuthorizations,
    handleSelectStudent, handleClear, handleChangeName, handleFormSubmit,
    handleContinueStudy, ownershipConflict, setOwnershipConflict
  } = useBibleStudyForm({ unit, history, allHistory, editingItem, currentUser, onSubmit });

  const isStaff = formData.participantType === ParticipantType.STAFF;

  const headerActions = React.useMemo(() => (
    <>
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
          {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
          <button key={type} type="button" onClick={() => {
              setFormData({...formData, participantType: type, name: '', whatsapp: '', sector: '', guide: '', lesson: ''});
              setIsSectorLocked(false);
          }} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${formData.participantType === type ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>{type}</button>
          ))}
      </div>
      <button type="button" onClick={handleClear} className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 active:scale-95 transition-all flex items-center justify-center text-base shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
    </>
  ), [formData, handleClear, setFormData, setIsSectorLocked]);

  const historySection = React.useMemo(() => (
    <HistorySection<BibleStudy> data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['name']} onContinue={handleContinueStudy} renderItem={(item) => (
      <HistoryCard key={item.id} icon="📖" color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-blue-600"} title={item.name} subtitle={`${item.sector} • ${item.status}`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role, 'bibleStudies', editAuthorizations)} isAdmin={currentUser.role === UserRole.ADMIN} users={users} onTransfer={(newUid) => onTransfer?.('study', item.id, newUid)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} onContinue={() => handleContinueStudy(item)} middle={item.participantType && item.participantType !== ParticipantType.STAFF && (<span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${item.participantType === ParticipantType.PATIENT ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.participantType}</span>)}/>
    )} />
  ), [history, users, currentUser, isLoading, onTransfer, onEdit, onDelete, handleContinueStudy, editAuthorizations]);

  return (
    <>
      {ownershipConflict.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-rose-500 p-6 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-lock text-3xl text-white"></i>
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-wider">Acesso Bloqueado</h3>
            </div>
            <div className="p-6 text-center space-y-6">
              <p className="text-slate-600 font-medium leading-relaxed">
                {ownershipConflict.message}
              </p>
              <button 
                type="button"
                onClick={() => setOwnershipConflict({ show: false, message: '' })}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl uppercase tracking-widest transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
      <FormScaffold title="Estudo Bíblico" headerActions={headerActions} history={historySection}>
      <form onSubmit={handleFormSubmit} className="space-y-4 md:space-y-5">
        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-blue-500/20 transition-all" /></div>
          
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do {formData.participantType}</label><Autocomplete options={studentOptions} value={formData.name} onChange={handleChangeName} onSelectOption={handleSelectStudent} placeholder="Buscar..." isStrict={isStaff} /></div>
          
          <div className="space-y-1">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${isStaff ? 'text-slate-400' : 'text-slate-300'}`}>Setor / Local {isStaff ? '(Obrigatório)' : '(Opcional)'}</label>
              {isSectorLocked ? (
                  <div className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-100 border border-slate-200 font-bold text-slate-500 cursor-not-allowed flex justify-between items-center group relative" title="Vínculo oficial do RH">
                      <span>{formData.sector}</span>
                      <i className="fas fa-lock text-slate-400"></i>
                      <span className="absolute -top-2 right-2 bg-blue-100 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">RH Link</span>
                  </div>
              ) : (
                  <Autocomplete options={sectorOptions} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local..." isStrict={isStaff} />
              )}
          </div>
          
          <div className="space-y-1">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${!isStaff ? 'text-blue-600' : 'text-slate-400'}`}>WhatsApp {!isStaff ? '(Obrigatório)' : '(Opcional)'}</label>
              <input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className={`w-full p-3 md:p-3.5 rounded-2xl border-none font-bold transition-all focus:ring-2 focus:ring-blue-500/20 ${!isStaff ? 'bg-blue-50 text-blue-900 ring-2 ring-blue-100 focus:ring-blue-300' : 'bg-slate-50'}`}/>
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Guia de Estudo</label><Autocomplete options={guideOptions} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Ex: O Grande Conflito" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Lição nº</label><input type="number" value={formData.lesson} onChange={e => {
              const val = e.target.value;
              const num = parseInt(val);
              setFormData({...formData, lesson: val, status: (!isNaN(num) && num > 1) ? RecordStatus.CONTINUACAO : formData.status});
          }} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-black focus:ring-2 focus:ring-blue-500/20 transition-all" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Status</label><div className="flex gap-2">{STATUS_OPTIONS.map(opt => (<button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 md:py-3.5 rounded-2xl font-black text-[10px] uppercase border-2 transition-all active:scale-95 ${formData.status === opt ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 text-slate-400 bg-slate-50 hover:bg-slate-100'}`}>{opt}</button>))}</div></div>
        </div>
        <Button 
          type="submit" 
          isLoading={isSubmitting}
          className="w-full py-4 md:py-5 text-xs"
        >
          Salvar Registro
        </Button>
      </form>
    </FormScaffold>
    </>
  );
};

export default BibleStudyForm;
