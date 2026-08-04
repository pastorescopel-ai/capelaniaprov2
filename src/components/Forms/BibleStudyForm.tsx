
import React, { useState, useEffect } from 'react';
import { Unit, RecordStatus, BibleStudy, BibleClass, User, UserRole, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
import Button from '../Shared/Button';
import { formatWhatsApp } from '../../utils/formatters';
import { isRecordLocked } from '../../utils/validators';
import { useBibleStudyForm } from '../../hooks/useBibleStudyForm';
import { useBibleClassForm } from '../../hooks/useBibleClassForm';

interface FormProps {
  unit: Unit;
  users: User[];
  currentUser: User;
  studyHistory: BibleStudy[];
  allStudyHistory?: BibleStudy[];
  classHistory: BibleClass[];
  allClassHistory?: BibleClass[];
  editingItem?: BibleStudy | BibleClass;
  isLoading?: boolean;
  onDeleteStudy: (id: string) => void;
  onDeleteClass: (id: string) => void;
  onEdit?: (item: BibleStudy | BibleClass) => void;
  onSubmitStudy: (data: any) => void;
  onSubmitClass: (data: any) => void;
  onTransfer?: (type: string, id: string, newUserId: string) => void;
  isActive?: boolean;
}

// Uma classe tem `students` (array); um estudo individual tem `name` (string).
const isClassRecord = (item: any): item is BibleClass => !!item && Array.isArray(item.students);

const BibleStudyForm: React.FC<FormProps> = ({
  unit, users, currentUser, studyHistory, allStudyHistory = [], classHistory, allClassHistory = [],
  editingItem, isLoading, onSubmitStudy, onSubmitClass, onDeleteStudy, onDeleteClass, onEdit, onTransfer, isActive
}) => {
  const [mode, setMode] = useState<'individual' | 'turma'>(() => isClassRecord(editingItem) ? 'turma' : 'individual');

  useEffect(() => {
    if (editingItem) setMode(isClassRecord(editingItem) ? 'turma' : 'individual');
  }, [editingItem]);

  const studyForm = useBibleStudyForm({
    unit, history: studyHistory, allHistory: allStudyHistory,
    editingItem: isClassRecord(editingItem) ? undefined : editingItem,
    currentUser, onSubmit: onSubmitStudy, isActive
  });

  const classForm = useBibleClassForm({
    unit, history: classHistory, allHistory: allClassHistory,
    editingItem: isClassRecord(editingItem) ? editingItem : undefined,
    currentUser, onSubmit: onSubmitClass, isActive
  });

  const isEditing = !!editingItem;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const activeFormData: any = mode === 'individual' ? studyForm.formData : classForm.formData;
  const isStaff = activeFormData.participantType === ParticipantType.STAFF;
  const ownershipConflict = studyForm.ownershipConflict.show ? studyForm.ownershipConflict : classForm.ownershipConflict;
  const setOwnershipConflict = studyForm.ownershipConflict.show ? studyForm.setOwnershipConflict : classForm.setOwnershipConflict;

  const setParticipantType = (type: ParticipantType) => {
    if (mode === 'individual') {
      studyForm.setFormData({ ...studyForm.formData, participantType: type, name: '', whatsapp: '', sector: '', guide: '', lesson: '' });
      studyForm.setIsSectorLocked(false);
    } else {
      classForm.setFormData({ ...classForm.formData, participantType: type, students: [], sector: '', representativePhone: '' });
    }
  };

  const handleClear = mode === 'individual' ? studyForm.handleClear : classForm.handleClear;

  const headerActions = React.useMemo(() => (
    <>
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
        {(['individual', 'turma'] as const).map(m => (
          <button
            key={m}
            type="button"
            disabled={isEditing}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed ${mode === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {m === 'individual' ? 'Individual' : 'Turma (Classe)'}
          </button>
        ))}
      </div>
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
        {[ParticipantType.STAFF, ParticipantType.PATIENT, ParticipantType.PROVIDER].map(type => (
          <button key={type} type="button" onClick={() => setParticipantType(type)} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${activeFormData.participantType === type ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>{type}</button>
        ))}
      </div>
      <button type="button" onClick={handleClear} className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 active:scale-95 transition-all flex items-center justify-center text-sm shadow-sm" title="Limpar Campos"><i className="fas fa-eraser"></i></button>
    </>
  ), [mode, isEditing, activeFormData.participantType, handleClear]);

  const studyHistorySection = React.useMemo(() => (
    <HistorySection<BibleStudy> data={studyHistory} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['name']} onContinue={studyForm.handleContinueStudy} renderItem={(item) => (
      <HistoryCard
        key={item.id}
        icon="📖"
        color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-blue-600"}
        title={item.name}
        subtitle={`${item.sector} • ${item.status}`}
        chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
        isLocked={isLoading ? false : isRecordLocked(item.date, currentUser.role, 'bibleStudies', studyForm.editAuthorizations)}
        isAdmin={currentUser.role === UserRole.ADMIN}
        users={users}
        onTransfer={(newUid) => onTransfer?.('study', item.id, newUid)}
        onEdit={() => onEdit?.(item)}
        onDelete={() => onDeleteStudy(item.id)}
        onContinue={() => studyForm.handleContinueStudy(item)}
        middle={item.participantType && item.participantType !== ParticipantType.STAFF && (<span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${item.participantType === ParticipantType.PATIENT ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.participantType}</span>)}/>
    )} />
  ), [studyHistory, users, currentUser, isLoading, onTransfer, onEdit, onDeleteStudy, studyForm.handleContinueStudy, studyForm.editAuthorizations]);

  const classHistorySection = React.useMemo(() => (
    <HistorySection<BibleClass> title="Histórico de Classes" data={classHistory} users={users} currentUser={currentUser} isLoading={isLoading} searchFields={['guide', 'students']} onContinue={classForm.handleContinueClass} renderItem={(item) => (
      <HistoryCard key={item.id} icon="👥" color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-indigo-600"} title={item.guide || 'Classe Bíblica'} subtitle={`${item.sector} • ${item.students.length} alunos`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role, 'bibleClasses', classForm.editAuthorizations)} isAdmin={currentUser.role === UserRole.ADMIN} users={users} onTransfer={(newUid) => onTransfer?.('class', item.id, newUid)} onEdit={() => onEdit?.(item)} onDelete={() => onDeleteClass(item.id)} onContinue={() => classForm.handleContinueClass(item)} />
    )} />
  ), [classHistory, users, currentUser, isLoading, onTransfer, onEdit, onDeleteClass, classForm.handleContinueClass, classForm.editAuthorizations]);

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
      <FormScaffold title="Estudo Bíblico" headerActions={headerActions} history={mode === 'individual' ? studyHistorySection : classHistorySection}>
      {mode === 'individual' ? (
      <form onSubmit={studyForm.handleFormSubmit} className="space-y-4 md:space-y-5">
        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          {isAdmin && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Capelão Responsável</label>
              <select
                value={studyForm.formData.userId}
                onChange={e => studyForm.setFormData({...studyForm.formData, userId: e.target.value})}
                className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data</label><input type="date" value={studyForm.formData.date} onChange={e => studyForm.setFormData({...studyForm.formData, date: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" /></div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome do {studyForm.formData.participantType}</label><Autocomplete options={studyForm.studentOptions} value={studyForm.formData.name} onChange={studyForm.handleChangeName} onSelectOption={studyForm.handleSelectStudent} placeholder="Buscar por nome ou setor..." isStrict={false} /></div>

          <div className="space-y-1">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${isStaff ? 'text-slate-400' : 'text-slate-300'}`}>{isStaff ? 'Setor' : 'Local (Opcional)'}</label>
              {isStaff ? (
                studyForm.isSectorLocked ? (
                    <div className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-100 border border-slate-200 font-bold text-slate-500 cursor-not-allowed flex justify-between items-center group relative" title="Preenchido automaticamente pelo cadastro do colaborador">
                        <span>{studyForm.formData.sector}</span>
                        <i className="fas fa-lock text-slate-400"></i>
                        <span className="absolute -top-2 right-2 bg-blue-100 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">RH Link</span>
                    </div>
                ) : (
                    <Autocomplete options={studyForm.sectorOptions} value={studyForm.formData.sector} onChange={v => studyForm.setFormData({...studyForm.formData, sector: v})} placeholder="Buscar setor (opcional)..." isStrict={false} />
                )
              ) : (
                <input
                  type="text"
                  value={studyForm.formData.location || ''}
                  onChange={e => studyForm.setFormData({...studyForm.formData, location: e.target.value})}
                  placeholder="Local do estudo..."
                  className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              )}
          </div>

          <div className="space-y-1">
              <label className="text-[10px] font-black ml-2 uppercase tracking-widest text-slate-400">WhatsApp (Opcional)</label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={studyForm.formData.whatsapp}
                onChange={e => studyForm.setFormData({...studyForm.formData, whatsapp: formatWhatsApp(e.target.value)})}
                className="w-full p-3 md:p-3.5 rounded-2xl border-none font-bold text-sm transition-all focus:ring-2 focus:ring-blue-500/20 bg-slate-50"
              />
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Guia de Estudo</label><Autocomplete options={studyForm.guideOptions} value={studyForm.formData.guide} onChange={v => studyForm.setFormData({...studyForm.formData, guide: v})} placeholder="Ex: O Grande Conflito" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Lição nº</label><input type="number" value={studyForm.formData.lesson} onChange={e => {
              const val = e.target.value;
              const num = parseInt(val);
              studyForm.setFormData({...studyForm.formData, lesson: val, status: (!isNaN(num) && num > 1) ? RecordStatus.CONTINUACAO : studyForm.formData.status});
          }} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-black text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Status</label><div className="flex gap-2">{STATUS_OPTIONS.map(opt => (<button key={opt} type="button" onClick={() => studyForm.setFormData({...studyForm.formData, status: opt as RecordStatus})} className={`flex-1 py-3 md:py-3.5 rounded-2xl font-black text-[10px] uppercase border-2 transition-all active:scale-95 ${studyForm.formData.status === opt ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 text-slate-400 bg-slate-50 hover:bg-slate-100'}`}>{opt}</button>))}</div></div>
        </div>
        <Button
          type="submit"
          isLoading={studyForm.isSubmitting}
          className="w-full py-4 md:py-5 text-xs"
        >
          Salvar Registro
        </Button>
      </form>
      ) : (
      <form onSubmit={classForm.handleFormSubmit} className="space-y-4 md:space-y-5">
        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          {isAdmin && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Capelão Responsável</label>
              <select
                value={classForm.formData.userId}
                onChange={e => classForm.setFormData({...classForm.formData, userId: e.target.value})}
                className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data</label><input type="date" value={classForm.formData.date || ''} onChange={e => classForm.setFormData({...classForm.formData, date: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all" /></div>

          <div className="space-y-1">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${isStaff ? 'text-slate-400' : 'text-slate-300'}`}>{isStaff ? 'Setor (busque para carregar a turma)' : 'Local (Opcional)'}</label>
              {isStaff ? (
                  <Autocomplete options={classForm.sectorOptions} value={classForm.formData.sector || ''} onChange={v => classForm.setFormData({...classForm.formData, sector: v})} onSelectOption={classForm.handleSelectSector} placeholder="Buscar setor..." isStrict={false} />
              ) : (
                  <input
                    type="text"
                    value={classForm.formData.location || ''}
                    onChange={e => classForm.setFormData({...classForm.formData, location: e.target.value})}
                    placeholder="Local da classe..."
                    className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
              )}
          </div>

          <div className={`space-y-1 ${!isStaff ? 'order-first md:order-none col-span-2 md:col-span-2 animate-in slide-in-from-top-2' : ''}`}>
              <label className="text-[10px] font-black ml-2 uppercase tracking-widest text-slate-400">WhatsApp do Representante (Opcional)</label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={classForm.formData.representativePhone || ''}
                onChange={e => classForm.setFormData({...classForm.formData, representativePhone: formatWhatsApp(e.target.value)})}
                className="w-full p-3 md:p-3.5 rounded-2xl border-none font-bold text-sm transition-all focus:ring-2 focus:ring-indigo-500/20 bg-slate-50"
              />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Chamada de Presença (Filtro: {classForm.formData.participantType})</label>
            <div className="flex gap-2">
              <div className="flex-1"><Autocomplete options={classForm.studentSearchOptions} value={classForm.newStudent || ''} onChange={classForm.setNewStudent} onSelectOption={classForm.addStudent} required={false} placeholder={`Buscar ${classForm.formData.participantType.toLowerCase()}...`} isStrict={false} /></div>
              <button type="button" onClick={() => classForm.addStudent()} className="w-12 h-12 md:w-14 md:h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 transition-all"><i className="fas fa-plus"></i></button>
            </div>

            <div className="mt-4 md:mt-5 border border-slate-200 rounded-[1.5rem] overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 p-3 md:p-3.5 border-b border-slate-100 flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2 flex items-center gap-2"><i className="fas fa-clipboard-list text-indigo-400"></i> Lista de Alunos ({classForm.formData.students.length})</span></div>
              <div className="max-h-[15rem] md:max-h-[20rem] overflow-y-auto custom-scrollbar">
                 {classForm.callList.map((s, i) => {
                    const isPresent = classForm.formData.students.includes(s);
                    const isFromLastClass = classForm.lastClassStudents.includes(s);

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
                                classForm.setFormData({...classForm.formData, students: classForm.formData.students.filter(student => student !== s)});
                              } else {
                                classForm.setFormData({...classForm.formData, students: [...classForm.formData.students, s]});
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
                 {classForm.callList.length === 0 && (<div className="p-6 md:p-10 text-center flex flex-col items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 text-xl"><i className="fas fa-user-slash"></i></div><p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase italic">{isStaff ? 'Nenhum aluno na lista. Selecione um setor para carregar.' : 'Adicione o primeiro aluno para buscar familiares/colegas.'}</p></div>)}
              </div>
            </div>
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Guia de Estudo</label><Autocomplete options={classForm.guideOptions} value={classForm.formData.guide || ''} onChange={v => classForm.setFormData({...classForm.formData, guide: v})} placeholder="Ex: O Grande Conflito" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Lição nº</label><input type="number" value={classForm.formData.lesson || ''} onChange={e => {
              const val = e.target.value;
              const num = parseInt(val);
              classForm.setFormData({...classForm.formData, lesson: val, status: (!isNaN(num) && num > 1) ? RecordStatus.CONTINUACAO : classForm.formData.status});
          }} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-black text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Status</label><div className="flex gap-2">{STATUS_OPTIONS.map(opt => (<button key={opt} type="button" onClick={() => classForm.setFormData({...classForm.formData, status: opt as RecordStatus})} className={`flex-1 py-3 md:py-3.5 rounded-2xl font-black text-[10px] uppercase border-2 transition-all active:scale-95 ${classForm.formData.status === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-100 text-slate-400 bg-slate-50 hover:bg-slate-100'}`}>{opt}</button>))}</div></div>
        </div>
        <Button
          type="submit"
          variant="dark"
          isLoading={classForm.isSubmitting}
          className="w-full py-4 md:py-5 text-xs"
        >
          Salvar Registro
        </Button>
      </form>
      )}
    </FormScaffold>
    </>
  );
};

export default BibleStudyForm;
