
import React from 'react';
import { Unit, RecordStatus, BibleClass, User, UserRole, ParticipantType } from '../../types';
import { STATUS_OPTIONS } from '../../constants';
import Autocomplete from '../Shared/Autocomplete';
import HistoryCard from '../Shared/HistoryCard';
import HistorySection from '../Shared/HistorySection';
import FormScaffold from '../Shared/FormScaffold';
import Button from '../Shared/Button';
import MonthComparisonBars from '../Shared/MonthComparisonBars';
import { isRecordLocked } from '../../utils/validators';
import { formatWhatsApp, countUniqueClasses, getUniqueClassLabels } from '../../utils/formatters';
import { useBibleClassForm } from '../../hooks/useBibleClassForm';
import { useMonthComparison } from '../../hooks/useMonthComparison';

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
  isActive?: boolean;
}

const BibleClassForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, history, allHistory = [], editingItem, isLoading, onSubmit, onDelete, onEdit, onTransfer, isActive }) => {
  const {
    formData, setFormData,
    newStudent, setNewStudent,
    isSubmitting, isLinkingClass,
    callList,
    recognizedTurmas, selectTurma,
    pasteText, setPasteText, showPasteList, setShowPasteList, applyPastedList,
    guideOptions, studentSearchOptions, sectorOptions,
    handleSelectSector,
    addStudent, addAllFromLastClass, toggleAdventist, handleClear, handleFormSubmit,
    handleContinueClass, defaultState
  } = useBibleClassForm({ unit, history, allHistory, editingItem, currentUser, onSubmit, isActive });

  // Classe Bíblica é gravada uma linha por aluno presente -- o "vs. mês anterior" precisa
  // contar sessões de classe únicas (mesma lógica de countUniqueClasses usada em Relatórios),
  // não linhas cruas, senão uma classe de 10 alunos contaria como 10 aulas.
  const monthComparison = useMonthComparison(allHistory, currentUser.id, unit, countUniqueClasses);
  const curClassNames = getUniqueClassLabels(monthComparison.curItems);
  const prevClassNames = getUniqueClassLabels(monthComparison.prevItems);

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
      <HistoryCard key={item.id} icon="👥" color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-indigo-600"} title={item.guide || 'Classe Bíblica'} subtitle={`${item.sector} • ${item.students.length} alunos`} chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} isLocked={isRecordLocked(item.date, currentUser.role)} isAdmin={currentUser.role === UserRole.ADMIN} users={users} onTransfer={(newUid) => onTransfer?.('class', item.id, newUid)} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} onContinue={() => handleContinueClass(item)} />
    )} />
  ), [history, users, currentUser, isLoading, onTransfer, onEdit, onDelete, handleContinueClass]);

  return (
    <>
      <FormScaffold
        title="Classe Bíblica"
        headerActions={headerActions}
        history={historySection}
        compareWidget={<MonthComparisonBars label="Classes" color="#6366f1" {...monthComparison} curNames={curClassNames} prevNames={prevClassNames} itemLabel="turmas" />}
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
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Data</label><input type="date" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 md:p-3.5 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all" /></div>
          
          <div className="space-y-1">
              <label className={`text-[10px] font-black ml-2 uppercase tracking-widest ${isStaff ? 'text-slate-400' : 'text-slate-300'}`}>{isStaff ? 'Setor (opcional, ajuda a buscar)' : 'Local (Opcional)'}</label>
              {isStaff ? (
                  <Autocomplete options={sectorOptions} value={formData.sector || ''} onChange={v => setFormData({...formData, sector: v})} onSelectOption={handleSelectSector} placeholder="Buscar setor (opcional)..." isStrict={false} />
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

          <div className={`space-y-1 ${!isStaff ? 'order-first md:order-none md:col-span-2 animate-in slide-in-from-top-2' : ''}`}>
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
            {/* Escolha a turma -- só aparece antes de a chamada começar (nenhum aluno ainda);
                toca numa turma já reconhecida (mesma turma/setor/conjunto de alunos de sempre)
                e ela entra pronta, todo mundo já presente. Some assim que a lista de alunos
                começa a ser montada (por aqui, pela busca abaixo, ou por "Continuar" no
                histórico), dando lugar à chamada em si. */}
            {!editingItem && formData.students.length === 0 && (
              <div className="space-y-2 mb-4">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Escolha a turma</label>
                {recognizedTurmas.length > 0 && (
                  <div className="space-y-2">
                    {recognizedTurmas.map(t => (
                      <button
                        key={t.signature}
                        type="button"
                        onClick={() => selectTurma(t)}
                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 transition-all text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase text-slate-800 truncate">{t.label}</p>
                          <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${t.sector ? 'text-indigo-400' : 'text-amber-500'}`}>{t.sector ? 'Por setor' : 'Sem setor · por nome de aluno'}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-[11px] font-black text-slate-500">{t.students.length} aluno{t.students.length === 1 ? '' : 's'}</p>
                          <p className="text-[8px] font-bold text-slate-300 uppercase">Última vez {new Date((t.lastDate || '').split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowPasteList(v => !v)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 text-indigo-500 transition-all"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center font-black">+</div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Nova turma (colar lista)</span>
                </button>
                {showPasteList && (
                  <div className="p-4 rounded-2xl bg-slate-50 space-y-2">
                    <textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder={'Um nome por linha...\nEx:\nAna Cristina Viana\nCarlos Eduardo Melo'}
                      className="w-full h-24 p-3 rounded-xl bg-white border border-slate-200 font-bold text-xs resize-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <Button type="button" onClick={applyPastedList} className="w-full py-3 text-[10px]">Processar lista</Button>
                  </div>
                )}
                <p className="text-[9px] font-bold text-slate-400 ml-1">Ou busque um aluno específico abaixo pra encontrar a turma dele.</p>
              </div>
            )}

            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Adicionar aluno de fora da turma</label>
            <div className="flex gap-2">
              <div className="flex-1"><Autocomplete options={studentSearchOptions} value={newStudent || ''} onChange={setNewStudent} onSelectOption={addStudent} required={false} placeholder={`Digite o nome de um aluno da turma...`} isStrict={false} /></div>
              <button type="button" onClick={() => addStudent()} disabled={isLinkingClass} className="w-12 h-12 md:w-14 md:h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-60 disabled:hover:translate-y-0">
                <i className={`fas ${isLinkingClass ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i>
              </button>
            </div>
            {isLinkingClass && (
              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1.5 ml-2 flex items-center gap-1.5">
                <i className="fas fa-spinner fa-spin"></i> Procurando a turma deste aluno no histórico...
              </p>
            )}

            {/* Atalho de continuidade: some quando não há mais ninguém da turma reconhecida
                pra adicionar de uma vez (turma nova, ou já todo mundo presente). */}
            {callList.length > formData.students.length && (
              <button
                type="button"
                onClick={addAllFromLastClass}
                className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 active:scale-[0.99] transition-all"
              >
                <i className="fas fa-user-plus"></i>
                Adicionar todos os {callList.length - formData.students.length} alunos da última turma
              </button>
            )}

            {/* Chamada -- cada aluno é um chip com 2 zonas de toque: o NOME alterna
                presença/ausência (verde/cinza), a ESTRELA no canto marca Adventista sem mexer
                na presença. Todo mundo carregado por uma turma reconhecida já entra presente
                (verde) -- só marca quem faltou, em vez de marcar um a um quem veio. */}
            <div className="mt-4 md:mt-5 border border-slate-200 rounded-[1.5rem] overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 p-3 md:p-3.5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-1">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2 flex items-center gap-2"><i className="fas fa-clipboard-list text-indigo-400"></i> Lista de Alunos ({formData.students.length})</span>
                {formData.adventistStudents.length > 0 && (
                  <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md flex items-center gap-1"><i className="fas fa-star"></i> {formData.adventistStudents.filter(a => formData.students.includes(a)).length} adventista(s)</span>
                )}
              </div>
              <div className="max-h-[15rem] md:max-h-[20rem] overflow-y-auto custom-scrollbar p-3 md:p-4 flex flex-wrap gap-2">
                 {callList.map((s, i) => {
                    const isPresent = formData.students.includes(s);
                    const isAdventist = formData.adventistStudents.includes(s);

                    return (
                      <span key={`${s}-${i}`} className={`inline-flex items-stretch rounded-full border overflow-hidden ${isPresent ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-emerald-300'} ${isAdventist ? 'ring-2 ring-purple-300' : ''}`}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isPresent) {
                              setFormData({...formData, students: formData.students.filter(student => student !== s)});
                            } else {
                              setFormData({...formData, students: [...formData.students, s]});
                            }
                          }}
                          className="px-3 py-2 text-[10px] font-black uppercase"
                        >
                          {s.split(' (')[0]}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAdventist(s)}
                          title={isAdventist ? 'Remover marcação de Adventista' : 'Marcar como Adventista (não conta no total de alunos)'}
                          className={`px-2.5 flex items-center justify-center border-l ${isPresent ? 'border-white/30' : 'border-slate-200'} ${isAdventist ? 'text-purple-600 bg-white' : isPresent ? 'text-white/70 hover:text-white' : 'text-slate-300 hover:text-purple-500'}`}
                        >
                          <i className="fas fa-star text-[10px]"></i>
                        </button>
                      </span>
                    );
                 })}
                 {callList.length === 0 && (<div className="w-full p-6 md:p-10 text-center flex flex-col items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 text-xl"><i className="fas fa-user-slash"></i></div><p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase italic">Escolha uma turma acima ou adicione um aluno.</p></div>)}
              </div>
            </div>
            {formData.adventistStudents.some(a => formData.students.includes(a)) && (
              <p className="text-[9px] font-bold text-slate-400 mt-1.5 normal-case tracking-normal">
                Total de alunos que vai contar no relatório: <b className="text-slate-600 font-black">{formData.students.filter(s => !formData.adventistStudents.includes(s)).length}</b> -- os marcados como <span className="text-purple-600 font-black">Adventista</span> continuam presentes na chamada, mas não entram nesse total (aparecem só no relatório de Adventistas em Classes).
              </p>
            )}
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Guia de Estudo</label><Autocomplete options={guideOptions} value={formData.guide || ''} onChange={v => setFormData({...formData, guide: v})} placeholder="Ex: O Grande Conflito" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Lição nº</label><input type="number" min={0} value={formData.lesson || ''} onChange={e => {
              // Trava numérica de verdade (não só apagar o sinal "-" do texto): remover só o
              // caractere "-" transformava "-1" (que alguns navegadores, principalmente
              // Safari, mandam ao clicar na setinha pra baixo com o campo vazio/zerado) em
              // "1" em vez de "0". Agora sempre calcula o número e nunca deixa passar de 0,
              // igual ao campo "Nº de Participantes".
              const raw = e.target.value;
              const num = raw === '' ? NaN : parseInt(raw, 10);
              const val = isNaN(num) ? '' : String(Math.max(0, num));
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
