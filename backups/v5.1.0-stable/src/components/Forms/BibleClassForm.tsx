
import React from 'react';
import { Unit, RecordStatus, BibleClass, User, UserRole, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
import Button from '../Shared/Button';
import { isRecordLocked } from '../../utils/validators';
import { formatWhatsApp } from '../../utils/formatters';
import { useBibleClassForm } from '../../hooks/useBibleClassForm';

interface FormProps {
  unit: Unit;
  sectors: string[];
  users: User[];
  currentUser: User;
  history: BibleClass[];
  allHistory?: BibleClass[];
  editingItem?: BibleClass;
  isLoading?: boolean;
  onDelete: (id: string) => void;
  onEdit?: (item: BibleClass) => void;
  onSubmit: (data: any) => void;
  onTransfer?: (type: string, id: string, newUserId: string) => void;
}

const BibleClassForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit, onTransfer }) => {
  const {
    formData, setFormData,
    newStudent, setNewStudent,
    isSubmitting,
    lastClassStudents, callList,
    guideOptions, studentSearchOptions, sectorOptions,
    editAuthorizations,
    handleSelectSector,
    addStudent, handleClear, handleFormSubmit,
    handleContinueClass, defaultState, ownershipConflict, setOwnershipConflict
  } = useBibleClassForm({ unit, history, allHistory, editingItem, currentUser, onSubmit });

  const isAdmin = currentUser.role === UserRole.ADMIN;

  const isStaff = formData.participantType === ParticipantType.STAFF;

  const headerActions = React.useMemo(() => (
    <>
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
          {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
          <button key={type} type="button" onClick={() => setFormData({...formData, participantType: type, students: [], sector: '', representativePhone: ''})} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${formData.participantType === type ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>{type}</button>
          ))}
      </div>
      <button type="button" onClick={handleClear} className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 active:scale-95 transition-all flex items-center justify-center text-sm shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
    </>
  ), [formData, handleClear, setFormData]);

  const historySection = React.useMemo(() => (
    <HistorySection<BibleClass> title="Histórico de Classes" data={history} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['guide', 'students']} onContinue={handleContinueClass} renderItem={(item) => (
      <HistoryCard key={item.id} icon="👥" color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-indigo-600"} title={item.guide || 'Classe Bíblica'} subtitle={`${item.sector} • ${item.students.length} alunos`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role, 'bibleClasses', editAuthorizations)} isAdmin={currentUser.role === UserRole.ADMIN} users={users} onTransfer={(newUid) => onTransfer?.('class', item.id, newUid)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} onContinue={() => handleContinueClass(item)} />
    )} />
  ), [history, users, currentUser, isLoading, onTransfer, onEdit, onDelete, handleContinueClass, editAuthorizations]);

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
      <FormScaffold title="Classe Bíblica" headerActions={headerActions} history={historySection}>
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
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data</label><input type="date" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all" /></div>
          
          <div className="space-y-1">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${isStaff ? 'text-slate-400' : 'text-slate-300'}`}>{isStaff ? 'Setor (Obrigatório)' : 'Local (Opcional)'}</label>
              {isStaff ? (
                  <Autocomplete options={sectorOptions} value={formData.sector || ''} onChange={v => setFormData({...formData, sector: v})} onSelectOption={handleSelectSector} placeholder="Selecione ou digite o local..." isStrict={false} />
              ) : (
                  <input 
                    type="text" 
                    value={formData.location || ''} 
                    onChange={e => setFormData({...formData, location: e.target.value})} 
                    placeholder="Local da classe..." 
                    className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all" 
                  />
              )}
          </div>

          <div className={`space-y-1 ${!isStaff ? 'order-first md:order-none col-span-2 md:col-span-2 animate-in slide-in-from-top-2' : ''}`}>
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${!isStaff ? 'text-indigo-600' : 'text-slate-400'}`}>WhatsApp do Representante {!isStaff ? '*' : '(Opcional)'}</label>
              <input 
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000" 
                value={formData.representativePhone || ''} 
                onChange={e => setFormData({...formData, representativePhone: formatWhatsApp(e.target.value)})} 
                className={`w-full p-3 md:p-3.5 rounded-2xl border-none font-bold text-sm transition-all focus:ring-2 focus:ring-indigo-500/20 ${!isStaff ? 'bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100 focus:ring-indigo-300' : 'bg-slate-50'}`}
              />
          </div>
          
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Chamada de Presença (Filtro: {formData.participantType})</label>
            <div className="flex gap-2">
              <div className="flex-1"><Autocomplete options={studentSearchOptions} value={newStudent || ''} onChange={setNewStudent} onSelectOption={addStudent} required={false} placeholder={`Buscar ${formData.participantType.toLowerCase()}...`} isStrict={false} /></div>
              <button type="button" onClick={() => addStudent()} className="w-12 h-12 md:w-14 md:h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 transition-all"><i className="fas fa-plus"></i></button>
            </div>
            
            <div className="mt-4 md:mt-5 border border-slate-200 rounded-[1.5rem] overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 p-3 md:p-3.5 border-b border-slate-100 flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2 flex items-center gap-2"><i className="fas fa-clipboard-list text-indigo-400"></i> Lista de Alunos ({formData.students.length})</span></div>
              <div className="max-h-[15rem] md:max-h-[20rem] overflow-y-auto custom-scrollbar">
                 {callList.map((s, i) => {
                    const isPresent = formData.students.includes(s);
                    const isFromLastClass = lastClassStudents.includes(s);
                    
                    return (
                      <div key={`${s}-${i}`} className={`flex items-center justify-between p-3 md:p-3.5 border-b border-slate-100 last:border-none transition-colors group ${isPresent ? 'bg-emerald-50/50' : isFromLastClass ? 'bg-amber-50/80 border-l-4 border-l-amber-400' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                          <div className="flex items-center gap-3 md:gap-4">
                              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${isPresent ? 'bg-emerald-500 text-white' : isFromLastClass ? 'bg-amber-200 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                                {isPresent ? <i className="fas fa-check"></i> : i + 1}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[11px] md:text-xs font-black uppercase leading-tight ${isPresent ? 'text-emerald-700' : isFromLastClass ? 'text-amber-900' : 'text-slate-700'}`}>{s.split(' (')[0]}</span>
                                  {!isPresent && isFromLastClass && <span className="text-[8px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter"><i className="fas fa-star mr-1"></i>Frequente</span>}
                                </div>
                                {s.includes('(') && <span className={`text-[8px] md:text-[9px] font-bold ${isPresent ? 'text-emerald-400' : isFromLastClass ? 'text-amber-600' : 'text-slate-400'}`}>{s.match(/\((.*?)\)/)?.[0]}</span>}
                              </div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => {
                              if (isPresent) {
                                setFormData({...formData, students: formData.students.filter(student => student !== s)});
                              } else {
                                setFormData({...formData, students: [...formData.students, s]});
                              }
                            }} 
                            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl transition-all shadow-sm flex items-center gap-2 border ${isPresent ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-rose-500 hover:border-rose-500' : isFromLastClass ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-600'}`}
                          >
                            <span className="text-[9px] font-black uppercase hidden sm:inline">{isPresent ? 'Presente' : 'Ausente'}</span>
                            <i className={`fas ${isPresent ? 'fa-user-check' : 'fa-user-plus'} text-xs`}></i>
                          </button>
                      </div>
                    );
                 })}
                 {callList.length === 0 && (<div className="p-6 md:p-10 text-center flex flex-col items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 text-xl"><i className="fas fa-user-slash"></i></div><p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase italic">{isStaff ? 'Nenhum aluno na lista. Selecione um setor para carregar.' : 'Adicione o primeiro aluno para buscar familiares/colegas.'}</p></div>)}
              </div>
            </div>
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Guia de Estudo</label><Autocomplete options={guideOptions} value={formData.guide || ''} onChange={v => setFormData({...formData, guide: v})} placeholder="Ex: O Grande Conflito" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Lição nº</label><input type="number" value={formData.lesson || ''} onChange={e => {
              const val = e.target.value;
              const num = parseInt(val);
              setFormData({...formData, lesson: val, status: (!isNaN(num) && num > 1) ? RecordStatus.CONTINUACAO : formData.status});
          }} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-black text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Status</label><div className="flex gap-2">{STATUS_OPTIONS.map(opt => (<button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 md:py-3.5 rounded-2xl font-black text-[10px] uppercase border-2 transition-all active:scale-95 ${formData.status === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-100 text-slate-400 bg-slate-50 hover:bg-slate-100'}`}>{opt}</button>))}</div></div>
        </div>
        <Button 
          type="submit" 
          variant="dark"
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

export default BibleClassForm;
