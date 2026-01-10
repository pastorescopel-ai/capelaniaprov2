
import React, { useState, useEffect } from 'react';
import { Unit, RecordStatus, VisitReason, BibleStudy, BibleClass, SmallGroup, StaffVisit, UserRole } from '../types';
import { STATUS_OPTIONS, VISIT_REASONS } from '../constants';

interface FormProps {
  unit: Unit;
  sectors: string[];
  groupsList?: string[];
  staffList?: string[];
  history: any[];
  allHistory?: any[]; 
  editingItem?: any;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: any) => void;
  onSubmit: (data: any) => void;
  onToggleReturn?: (id: string) => void;
}

const formatWhatsApp = (value: string) => {
  const nums = value.replace(/\D/g, "");
  if (nums.length === 0) return "";
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
};

const Autocomplete: React.FC<{ options: string[], value: string, onChange: (v: string) => void, placeholder: string, isStrict?: boolean }> = ({ options, value, onChange, placeholder, isStrict }) => {
  const [open, setOpen] = useState(false);
  const filtered = options.filter(o => o.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative">
      <input 
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
           setTimeout(() => {
             setOpen(false);
             if (isStrict && !options.includes(value)) {
               onChange("");
             }
           }, 200);
        }}
        className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-48 overflow-y-auto no-scrollbar">
          {filtered.map(o => (
            <button key={o} type="button" className="w-full text-left p-4 hover:bg-slate-50 text-sm font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-none" onClick={() => { onChange(o); setOpen(false); }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const HistoryCard: React.FC<{ 
  icon: string, 
  color: string, 
  title: string, 
  subtitle: string, 
  onEdit: () => void, 
  onDelete: () => void, 
  extra?: React.ReactNode,
  middle?: React.ReactNode 
}> = ({ icon, color, title, subtitle, onEdit, onDelete, extra, middle }) => (
  <div className="bg-white p-5 md:p-6 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between shadow-sm hover:border-blue-200 transition-all group gap-4">
    <div className="flex items-center gap-4 flex-1">
      <div className={`w-12 h-12 ${color} bg-opacity-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <h4 className="font-bold text-slate-800 leading-tight truncate">{title}</h4>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1 truncate">{subtitle}</p>
      </div>
    </div>
    
    {middle && (
      <div className="flex flex-1 justify-center items-center">
        {middle}
      </div>
    )}

    <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
      {extra}
      <div className="flex items-center gap-1.5 ml-auto md:ml-0">
        <button onClick={onEdit} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors"><i className="fas fa-edit text-xs"></i></button>
        <button onClick={onDelete} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors"><i className="fas fa-trash text-xs"></i></button>
      </div>
    </div>
  </div>
);

export const BibleStudyForm: React.FC<FormProps> = ({ unit, sectors, history, allHistory, editingItem, onSubmit, onDelete, onEdit }) => {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], sector: '', name: '', whatsapp: '', status: RecordStatus.INICIO, guide: '', lesson: '', observations: '' });
  const [showContinuity, setShowContinuity] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingItem) setFormData(editingItem);
    else setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
  }, [editingItem]);

  const activeStudentsInHistory = React.useMemo(() => {
    if (!allHistory) return [];
    const latestByStudent: Record<string, BibleStudy> = {};
    allHistory.forEach(h => {
      const currentLatest = latestByStudent[h.name];
      if (!currentLatest || new Date(h.date) > new Date(currentLatest.date)) {
        latestByStudent[h.name] = h;
      }
    });
    return Object.values(latestByStudent).filter(h => h.status !== RecordStatus.TERMINO);
  }, [allHistory]);

  const handleSelectHistorical = (last: BibleStudy) => {
    if (last.date === formData.date) {
      setErrorMsg("ERRO: Este aluno já possui um registro na data selecionada. Registre a continuação em outro dia!");
      setTimeout(() => setErrorMsg(null), 6000);
      return;
    }
    setFormData({ ...last, status: RecordStatus.CONTINUACAO, date: formData.date, lesson: '', observations: '' });
    setShowContinuity(false);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-10 pb-20">
      {errorMsg && (
        <div className="bg-rose-600 p-6 rounded-[2rem] text-white flex items-center gap-5 shadow-2xl shadow-rose-200 animate-in slide-in-from-top duration-300">
          <i className="fas fa-exclamation-circle text-3xl"></i>
          <p className="font-black text-sm uppercase tracking-tight leading-relaxed">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...formData, unit }); setFormData({ date: new Date().toISOString().split('T')[0], sector: '', name: '', whatsapp: '', status: RecordStatus.INICIO, guide: '', lesson: '', observations: '' }); }} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Estudo Bíblico ({unit})</h2>
          <button type="button" onClick={() => setShowContinuity(!showContinuity)} className="text-blue-600 font-bold text-xs bg-blue-50 px-4 py-2 rounded-xl flex items-center gap-2">
            <i className={`fas ${showContinuity ? 'fa-times' : 'fa-search'}`}></i>
            {showContinuity ? 'Fechar' : 'Buscar Aluno'}
          </button>
        </div>
        {showContinuity && (
          <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-200 animate-in zoom-in duration-200">
            <h4 className="font-bold text-slate-700 mb-4 text-[10px] uppercase tracking-widest">Alunos Ativos</h4>
            <div className="grid gap-2 max-h-40 overflow-y-auto no-scrollbar">
              {activeStudentsInHistory.map(last => (
                <button key={last.id} type="button" onClick={() => handleSelectHistorical(last)} className="text-left p-3 bg-white rounded-xl border border-slate-100 hover:border-blue-300 transition-all flex justify-between items-center">
                  <span className="font-bold text-slate-800">{last.name}</span>
                  <span className="text-[9px] bg-slate-100 px-2 py-1 rounded-lg text-slate-500 font-black uppercase">Último: {last.date.split('-').reverse().join('/')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data Atendimento *</label><input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Selecione o setor..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome do Aluno *</label><input required placeholder="Nome completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">WhatsApp *</label><input required placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-mono" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Guia de Estudo *</label><input required placeholder="Guia" value={formData.guide} onChange={e => setFormData({...formData, guide: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lição Ministrada *</label><input required placeholder="Lição" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-50 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs">Salvar Estudo</button>
      </form>
      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-800 px-2 uppercase tracking-tight">Histórico Recente</h3>
        {history.map(item => (
          <HistoryCard 
            key={item.id} 
            icon="📖" 
            color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-blue-600"} 
            title={item.name} 
            subtitle={`${item.sector} • ${item.lesson} • ${item.status}`} 
            onEdit={() => onEdit?.(item)} 
            onDelete={() => onDelete(item.id)} 
            extra={item.status === RecordStatus.TERMINO && <span className="text-[8px] bg-rose-50 text-rose-600 px-2 py-1 rounded-lg font-black uppercase">Terminado</span>}
          />
        ))}
      </div>
    </div>
  );
};

export const BibleClassForm: React.FC<FormProps> = ({ unit, sectors, history, allHistory, editingItem, onSubmit, onDelete, onEdit }) => {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], sector: '', students: [] as string[], guide: '', lesson: '', status: RecordStatus.INICIO, observations: '' });
  const [newStudent, setNewStudent] = useState('');
  const [showClassSearch, setShowClassSearch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingItem) setFormData(editingItem);
    else setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
  }, [editingItem]);

  const activeClassesInHistory = React.useMemo(() => {
    if (!allHistory) return [];
    const latestByClass: Record<string, BibleClass> = {};
    allHistory.forEach(h => {
      const key = `${h.guide}-${h.sector}`;
      const currentLatest = latestByClass[key];
      if (!currentLatest || new Date(h.date) > new Date(currentLatest.date)) {
        latestByClass[key] = h;
      }
    });
    return Object.values(latestByClass).filter(h => h.status !== RecordStatus.TERMINO);
  }, [allHistory]);

  const addStudent = () => { if (newStudent.trim()) { setFormData({...formData, students: [...formData.students, newStudent.trim()]}); setNewStudent(''); } };

  const handleSelectHistorical = (last: BibleClass) => {
    if (last.date === formData.date) {
      setErrorMsg("ERRO: Esta classe já foi registrada hoje. Escolha outro dia para a continuação!");
      setTimeout(() => setErrorMsg(null), 6000);
      return;
    }
    setFormData({ ...last, status: RecordStatus.CONTINUACAO, date: formData.date, lesson: '', observations: '' });
    setShowClassSearch(false);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-10 pb-20">
      {errorMsg && (
        <div className="bg-rose-600 p-6 rounded-[2rem] text-white flex items-center gap-5 shadow-2xl shadow-rose-200 animate-in slide-in-from-top duration-300">
          <i className="fas fa-exclamation-triangle text-3xl"></i>
          <p className="font-black text-sm uppercase tracking-tight leading-relaxed">{errorMsg}</p>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if(formData.students.length===0) return; onSubmit({...formData, unit}); setFormData({ date: new Date().toISOString().split('T')[0], sector: '', students: [], guide: '', lesson: '', status: RecordStatus.INICIO, observations: '' }); }} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Classe Bíblica ({unit})</h2>
          <button type="button" onClick={() => setShowClassSearch(!showClassSearch)} className="text-indigo-600 font-bold text-xs bg-indigo-50 px-4 py-2 rounded-xl flex items-center gap-2">
            <i className={`fas ${showClassSearch ? 'fa-times' : 'fa-search'}`}></i>
            {showClassSearch ? 'Fechar' : 'Buscar Classe'}
          </button>
        </div>
        {showClassSearch && (
          <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-200 animate-in zoom-in duration-200">
            <h4 className="font-bold text-slate-700 mb-4 text-[10px] uppercase tracking-widest">Classes Ativas</h4>
            <div className="grid gap-2 max-h-48 overflow-y-auto no-scrollbar">
              {activeClassesInHistory.map(last => (
                <button key={last.id} type="button" onClick={() => handleSelectHistorical(last)} className="text-left p-3 bg-white rounded-xl border border-slate-100 hover:border-indigo-300 transition-all flex justify-between items-center">
                  <div><span className="font-bold text-slate-800 block">{last.guide}</span><span className="text-[8px] text-slate-400 font-black uppercase">Setor: {last.sector}</span></div>
                  <span className="text-[10px] bg-indigo-50 px-2 py-1 rounded-lg text-indigo-600 font-black uppercase">{last.date.split('-').reverse().join('/')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data *</label><input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Escolha o setor..." /></div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Alunos (Adicionar/Excluir) *</label>
            <div className="flex gap-2">
              <input value={newStudent} onChange={e => setNewStudent(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addStudent())} placeholder="Nome do aluno" className="flex-1 p-4 rounded-2xl bg-slate-50 border-none" />
              <button type="button" onClick={addStudent} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg hover:bg-indigo-700 transition-all"><i className="fas fa-plus"></i></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {formData.students.map((s, i) => (
                <div key={i} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm border border-indigo-100 animate-in fade-in duration-300">
                  {s} <button type="button" onClick={() => setFormData({...formData, students: formData.students.filter((_, idx) => idx !== i)})} className="hover:text-rose-500 transition-colors"><i className="fas fa-times-circle"></i></button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Guia de Estudo *</label><input required placeholder="Nome do guia" value={formData.guide} onChange={e => setFormData({...formData, guide: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lição Ministrada *</label><input required placeholder="Título da lição" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status da Classe *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs">Salvar Classe</button>
      </form>
      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-800 px-2 uppercase tracking-tight">Histórico Recente</h3>
        {history.map(item => (
          <HistoryCard 
            key={item.id} 
            icon="👥" 
            color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-indigo-600"} 
            title={item.lesson || 'Classe Bíblica'} 
            subtitle={`${item.sector} • ${item.students.length} alunos • ${item.status}`} 
            onEdit={() => onEdit?.(item)} 
            onDelete={() => onDelete(item.id)} 
            extra={item.status === RecordStatus.TERMINO && <span className="text-[8px] bg-rose-50 text-rose-600 px-2 py-1 rounded-lg font-black uppercase">Terminado</span>}
          />
        ))}
      </div>
    </div>
  );
};

export const SmallGroupForm: React.FC<FormProps> = ({ unit, sectors, groupsList = [], history, editingItem, onSubmit, onDelete, onEdit }) => {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], sector: '', groupName: '', leader: '', shift: 'Manhã', participantsCount: 0, observations: '' });
  useEffect(() => {
    if (editingItem) setFormData(editingItem);
    else setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
  }, [editingItem]);
  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({...formData, unit}); setFormData({ date: new Date().toISOString().split('T')[0], sector: '', groupName: '', leader: '', shift: 'Manhã', participantsCount: 0, observations: '' }); }} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Pequeno Grupo ({unit})</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data Atendimento *</label><input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local do PG..." /></div>
          
          {/* Campo Nome do Grupo Restrito à Lista Mestra com busca */}
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome do Grupo *</label>
            <Autocomplete 
              options={groupsList} 
              value={formData.groupName} 
              onChange={v => setFormData({...formData, groupName: v})} 
              placeholder="Pesquise o nome do grupo..." 
              isStrict={true}
            />
          </div>

          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Líder *</label><input required placeholder="Líder do PG" value={formData.leader} onChange={e => setFormData({...formData, leader: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Participantes *</label><input required type="number" value={formData.participantsCount || ''} onChange={e => setFormData({...formData, participantsCount: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs">Salvar PG</button>
      </form>
      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-800 px-2 uppercase tracking-tight">Histórico Recente</h3>
        {history.map(item => (
          <HistoryCard key={item.id} icon="🏠" color="text-emerald-600" title={item.groupName} subtitle={`${item.sector} • ${item.participantsCount} participantes`} onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} />
        ))}
      </div>
    </div>
  );
};

export const StaffVisitForm: React.FC<FormProps> = ({ unit, sectors, staffList = [], history, editingItem, onSubmit, onDelete, onEdit, onToggleReturn }) => {
  const [formData, setFormData] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    sector: '', 
    reason: VisitReason.AGENDAMENTO, 
    staffName: '', 
    requiresReturn: false, 
    returnDate: new Date().toISOString().split('T')[0],
    returnCompleted: false, 
    observations: '' 
  });

  useEffect(() => {
    if (editingItem) setFormData({
      ...editingItem,
      returnDate: editingItem.returnDate || new Date().toISOString().split('T')[0]
    });
    else setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
  }, [editingItem]);

  return (
    <div className="space-y-10 pb-20">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({...formData, unit}); setFormData({ date: new Date().toISOString().split('T')[0], sector: '', reason: VisitReason.AGENDAMENTO, staffName: '', requiresReturn: false, returnDate: new Date().toISOString().split('T')[0], returnCompleted: false, observations: '' }); }} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Visita a Colaborador ({unit})</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data *</label><input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local da visita..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Colaborador *</label><Autocomplete options={staffList} value={formData.staffName} onChange={v => setFormData({...formData, staffName: v})} placeholder="Nome do colaborador..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Motivo *</label>
            <select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value as VisitReason})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold">
              {Object.values(VisitReason).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-rose-100 transition-colors">
              <input type="checkbox" id="requiresReturn" checked={formData.requiresReturn} onChange={e => setFormData({...formData, requiresReturn: e.target.checked})} className="w-6 h-6 rounded-lg text-rose-600 focus:ring-rose-500 cursor-pointer" />
              <label htmlFor="requiresReturn" className="font-black text-slate-700 text-xs uppercase tracking-widest cursor-pointer">Necessita Retorno / Acompanhamento?</label>
            </div>
          </div>

          {formData.requiresReturn && (
            <div className="space-y-1 md:col-span-2 animate-in slide-in-from-left duration-300">
              <label className="text-[10px] font-black text-rose-500 ml-2 uppercase">Agendar Retorno para *</label>
              <input 
                required 
                type="date" 
                value={formData.returnDate} 
                onChange={e => setFormData({...formData, returnDate: e.target.value})} 
                className="w-full p-4 rounded-2xl bg-rose-50 border-2 border-rose-100 text-rose-700 font-bold" 
              />
            </div>
          )}

          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-rose-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs">Salvar Visita</button>
      </form>
      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-800 px-2 uppercase tracking-tight">Histórico de Visitas</h3>
        {history.map(item => (
          <HistoryCard 
            key={item.id} 
            icon="🤝" 
            color="text-rose-600" 
            title={item.staffName} 
            subtitle={`${item.sector} • ${item.reason}`} 
            onEdit={() => onEdit?.(item)} 
            onDelete={() => onDelete(item.id)} 
            middle={item.requiresReturn && !item.returnCompleted && item.returnDate && (
              <div className="bg-rose-500 text-white px-5 py-3 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-rose-200 border-2 border-white transform hover:scale-105 transition-all animate-in zoom-in duration-300">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80 leading-none mb-1">Retorno em</span>
                <span className="text-base md:text-lg font-black tracking-tighter leading-none">
                  {item.returnDate.split('-').reverse().join('/')}
                </span>
              </div>
            )}
            extra={item.requiresReturn && (
              <button 
                onClick={() => onToggleReturn?.(item.id)} 
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md ${item.returnCompleted ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-500 animate-pulse'}`}
                title={item.returnCompleted ? "Atendimento Concluído" : "Pendente de Retorno"}
              >
                <i className={`fas ${item.returnCompleted ? 'fa-check' : 'fa-flag'} text-base`}></i>
              </button>
            )}
          />
        ))}
      </div>
    </div>
  );
};
