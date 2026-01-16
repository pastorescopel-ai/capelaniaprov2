
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, RecordStatus, VisitReason, BibleStudy, BibleClass, SmallGroup, StaffVisit, User, UserRole, MasterLists } from '../types';
import { STATUS_OPTIONS, VISIT_REASONS } from '../constants';

interface FormProps {
  unit: Unit;
  sectors: string[];
  groupsList?: string[];
  staffList?: string[];
  users: User[];
  currentUser: User;
  masterLists: MasterLists;
  history: any[];
  allHistory?: any[]; 
  editingItem?: any;
  onCancelEdit?: () => void;
  onDelete: (id: string) => void;
  onEdit?: (item: any) => void;
  onSubmit: (data: any) => void;
  onToggleReturn?: (id: string) => void;
  onTransfer?: (type: string, id: string, newUserId: string) => void;
}

// Componente Interno de Notificação Flutuante (Toast)
const Toast: React.FC<{ message: string; show: boolean; onClose: () => void }> = ({ message, show, onClose }) => {
  if (!show) return null;
  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-300">
      <div className="bg-slate-900/90 backdrop-blur-md text-white px-8 py-4 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3">
        <i className="fas fa-exclamation-circle text-amber-400 text-lg"></i>
        <span className="font-black uppercase text-[10px] tracking-widest">{message}</span>
        <button onClick={onClose} className="ml-4 hover:text-rose-400 transition-colors">
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
};

const isRecordLocked = (dateStr: string, userRole: UserRole) => {
  if (userRole === UserRole.ADMIN) return false;
  const now = new Date();
  const recordDate = new Date(dateStr);
  return (recordDate.getFullYear() < now.getFullYear()) || 
         (recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() < now.getMonth());
};

const resolveDynamicName = (val: string, list: string[] = []) => {
  if (!val || !val.includes('_')) return val;
  const prefix = val.split('_')[0] + '_';
  const currentMatch = list.find(item => item.startsWith(prefix));
  return currentMatch || val;
};

const formatWhatsApp = (value: string) => {
  const nums = String(value || "").replace(/\D/g, "");
  if (nums.length === 0) return "";
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
};

const Autocomplete: React.FC<{ 
  options: string[], 
  value: string, 
  onChange: (v: string) => void, 
  onSelectOption?: (v: string) => void,
  placeholder: string, 
  isStrict?: boolean,
  className?: string
}> = ({ options, value, onChange, onSelectOption, placeholder, isStrict, className }) => {
  const [open, setOpen] = useState(false);
  const filtered = options.filter(o => o.toLowerCase().includes(String(value || "").toLowerCase()));

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
             if (isStrict && value && !options.includes(value)) {
               onChange("");
             }
           }, 250);
        }}
        className={className || "w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-48 overflow-y-auto no-scrollbar">
          {filtered.map(o => (
            <button 
              key={o} 
              type="button" 
              className="w-full text-left p-4 hover:bg-slate-50 text-sm font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-none" 
              onMouseDown={(e) => { 
                e.preventDefault(); 
                onChange(o);
                if(onSelectOption) onSelectOption(o);
                setOpen(false); 
              }}
            >
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
  chaplainName: string,
  isLocked?: boolean,
  isAdmin?: boolean,
  users?: User[],
  onEdit: () => void, 
  onDelete: () => void, 
  onTransfer?: (newUserId: string) => void,
  extra?: React.ReactNode,
  middle?: React.ReactNode 
}> = ({ icon, color, title, subtitle, chaplainName, isLocked, isAdmin, users, onEdit, onDelete, onTransfer, extra, middle }) => {
  const [showTransfer, setShowTransfer] = useState(false);

  return (
    <div className="bg-white p-5 md:p-6 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between shadow-sm hover:border-blue-200 transition-all group gap-4">
      <div className="flex items-center gap-4 flex-1">
        <div className={`w-12 h-12 ${color} bg-opacity-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0`}>{icon}</div>
        <div className="min-w-0">
          <h4 className="font-bold text-slate-800 leading-tight truncate">{title}</h4>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1 truncate">{subtitle}</p>
          <div className="flex items-center gap-1 mt-1">
             <i className="fas fa-user-tie text-[8px] text-blue-400"></i>
             <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter">Responsável: {chaplainName}</span>
          </div>
        </div>
      </div>
      
      {middle && (
        <div className="flex flex-1 justify-center items-center">
          {middle}
        </div>
      )}

      <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
        {extra}
        
        {isLocked ? (
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100" title="Mês encerrado. Edição permitida apenas para administradores.">
            <i className="fas fa-lock text-slate-300 text-xs"></i>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Somente Leitura</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 ml-auto md:ml-0">
            {isAdmin && users && (
              <div className="relative">
                <button 
                  onClick={() => setShowTransfer(!showTransfer)} 
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${showTransfer ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600'}`}
                  title="Transferir Responsável"
                >
                  <i className="fas fa-exchange-alt text-xs"></i>
                </button>
                {showTransfer && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[110] animate-in zoom-in duration-200">
                    <p className="text-[8px] font-black uppercase text-slate-400 p-2 border-b border-slate-50 mb-1">Transferir para:</p>
                    <div className="max-h-40 overflow-y-auto no-scrollbar">
                      {users.map(u => (
                        <button 
                          key={u.id} 
                          onClick={() => { onTransfer?.(u.id); setShowTransfer(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg text-[10px] font-bold text-slate-700 transition-colors uppercase"
                        >
                          {u.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button onClick={onEdit} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors"><i className="fas fa-edit text-xs"></i></button>
            <button onClick={onDelete} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors"><i className="fas fa-trash text-xs"></i></button>
          </div>
        )}
      </div>
    </div>
  );
};

const HistoryFilterBar: React.FC<{
  users: User[],
  selectedChaplain: string,
  onChaplainChange: (v: string) => void,
  startDate: string,
  onStartChange: (v: string) => void,
  endDate: string,
  onEndChange: (v: string) => void,
  isAdmin: boolean
}> = ({ users, selectedChaplain, onChaplainChange, startDate, onStartChange, endDate, onEndChange, isAdmin }) => {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm mb-6 flex flex-col md:flex-row items-end gap-4 animate-in fade-in duration-300">
      {isAdmin && (
        <div className="flex-1 w-full space-y-1">
          <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-widest">Filtrar por Capelão</label>
          <select 
            value={selectedChaplain} 
            onChange={e => onChaplainChange(e.target.value)}
            className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os Capelães</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}
      <div className="w-full md:w-44 space-y-1">
        <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-widest">Início</label>
        <input 
          type="date" 
          value={startDate} 
          onChange={e => onStartChange(e.target.value)} 
          className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="w-full md:w-44 space-y-1">
        <label className="text-[9px] font-black text-slate-400 ml-2 uppercase tracking-widest">Fim</label>
        <input 
          type="date" 
          value={endDate} 
          onChange={e => onEndChange(e.target.value)} 
          className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 flex items-center justify-center">
         <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter leading-none">Visão: Período Filtrado</span>
      </div>
    </div>
  );
};

export const BibleStudyForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, masterLists, history, allHistory = [], editingItem, onSubmit, onDelete, onEdit, onTransfer }) => {
  const [formData, setFormData] = useState({ id: '', date: new Date().toISOString().split('T')[0], sector: '', name: '', whatsapp: '', status: RecordStatus.INICIO, guide: '', lesson: '', observations: '' });
  const [toast, setToast] = useState({ show: false, message: '' });
  
  const [filterChaplain, setFilterChaplain] = useState('all');
  const [filterStart, setFilterStart] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [filterEnd, setFilterEnd] = useState(new Date().toISOString().split('T')[0]);

  const studySuggestions = ["Ouvindo a voz de Deus", "Verdade e Vida", "Apocalipse", "Daniel"];

  const studentNames = useMemo(() => {
    const names = new Set<string>();
    allHistory
      .filter(s => s.userId === currentUser.id)
      .forEach(s => { if(s.name) names.add(s.name.trim()); });
    return Array.from(names);
  }, [allHistory, currentUser.id]);

  useEffect(() => {
    if (editingItem) {
      setFormData({
        ...editingItem,
        date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', name: '', whatsapp: '', status: RecordStatus.INICIO, guide: '', lesson: '', observations: '' });
    }
  }, [editingItem]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const itemDate = item.date.split('T')[0];
      const matchChaplain = filterChaplain === 'all' || item.userId === filterChaplain;
      const matchRange = itemDate >= filterStart && itemDate <= filterEnd;
      return matchChaplain && matchRange;
    });
  }, [history, filterChaplain, filterStart, filterEnd]);

  const handleSelectStudent = (name: string) => {
    const lastRecord = [...allHistory]
      .filter(s => s.userId === currentUser.id) 
      .sort((a, b) => b.createdAt - a.createdAt)
      .find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());

    if (lastRecord) {
      setFormData({
        ...lastRecord,
        id: lastRecord.id,
        date: new Date().toISOString().split('T')[0],
        status: lastRecord.status === RecordStatus.TERMINO ? RecordStatus.TERMINO : RecordStatus.CONTINUACAO,
        lesson: lastRecord.status === RecordStatus.TERMINO ? lastRecord.lesson : (parseInt(lastRecord.lesson) + 1).toString(),
        observations: ''
      });
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.name || !formData.whatsapp || !formData.guide || !formData.lesson) {
      setToast({ show: true, message: "Atenção: Todos os campos com (*) são obrigatórios!" });
      setTimeout(() => setToast({ show: false, message: "" }), 3000);
      return;
    }
    onSubmit({ ...formData, unit });
    setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', name: '', whatsapp: '', status: RecordStatus.INICIO, guide: '', lesson: '', observations: '' });
  };

  return (
    <div className="space-y-10 pb-20">
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: "" })} />
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Estudo Bíblico ({unit})</h2>
          {formData.id && (
            <button type="button" onClick={() => setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', name: '', whatsapp: '', status: RecordStatus.INICIO, guide: '', lesson: '', observations: '' })} className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 px-4 py-2 rounded-full border border-rose-100">Limpar / Novo Aluno</button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data Atendimento *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Selecione o setor..." isStrict={true} /></div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome do Aluno (Seus Alunos) *</label>
            <Autocomplete 
              options={studentNames} 
              value={formData.name} 
              onChange={v => setFormData({...formData, name: v})} 
              onSelectOption={handleSelectStudent}
              placeholder="Digite para buscar seu aluno..." 
            />
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">WhatsApp *</label><input placeholder="(00) 00000-0000" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: formatWhatsApp(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-mono" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Guia de Estudo *</label><Autocomplete options={studySuggestions} value={formData.guide} onChange={v => setFormData({...formData, guide: v})} placeholder="Selecione ou digite o guia..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lição Atual *</label><input type="number" min="1" placeholder="Ex: 5" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-black" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-50 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações do Encontro</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest active:scale-95 transition-all">
          {formData.id ? 'Atualizar Progresso do Aluno' : 'Salvar Novo Aluno'}
        </button>
      </form>

      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Histórico de Atividades</h3>
        <HistoryFilterBar users={users} isAdmin={currentUser.role === UserRole.ADMIN} selectedChaplain={filterChaplain} onChaplainChange={setFilterChaplain} startDate={filterStart} onStartChange={setFilterStart} endDate={filterEnd} onEndChange={setFilterEnd} />
        <div className="grid gap-4">
          {filteredHistory.length > 0 ? filteredHistory.map(item => (
            <HistoryCard 
              key={item.id} icon="📖" color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-blue-600"} 
              title={item.name} 
              subtitle={`${resolveDynamicName(item.sector, item.unit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA)} • Lição ${item.lesson} • ${item.status}`} 
              chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
              isLocked={isRecordLocked(item.date, currentUser.role)}
              isAdmin={currentUser.role === UserRole.ADMIN}
              users={users}
              onTransfer={(newUid) => onTransfer?.('study', item.id, newUid)}
              onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} 
              extra={item.status === RecordStatus.TERMINO && <span className="text-[8px] bg-rose-50 text-rose-600 px-2 py-1 rounded-lg font-black uppercase">Concluído</span>}
            />
          )) : <p className="text-slate-400 text-center py-10 font-bold uppercase text-[10px]">Nenhum registro para este filtro.</p>}
        </div>
      </div>
    </div>
  );
};

export const BibleClassForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, masterLists, history, allHistory = [], editingItem, onSubmit, onDelete, onEdit, onTransfer }) => {
  const [formData, setFormData] = useState({ id: '', date: new Date().toISOString().split('T')[0], sector: '', students: [] as string[], guide: '', lesson: '', status: RecordStatus.INICIO, observations: '' });
  const [newStudent, setNewStudent] = useState('');
  const [toast, setToast] = useState({ show: false, message: '' });

  const [filterChaplain, setFilterChaplain] = useState('all');
  const [filterStart, setFilterStart] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [filterEnd, setFilterEnd] = useState(new Date().toISOString().split('T')[0]);

  const classGuides = useMemo(() => {
    const guides = new Set<string>();
    allHistory
      .filter(c => c.userId === currentUser.id)
      .forEach(c => { if(c.guide) guides.add(c.guide.trim()); });
    return Array.from(guides);
  }, [allHistory, currentUser.id]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ ...editingItem, date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0] });
    } else {
      setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', students: [], guide: '', lesson: '', status: RecordStatus.INICIO, observations: '' });
    }
  }, [editingItem]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const itemDate = item.date.split('T')[0];
      const matchChaplain = filterChaplain === 'all' || item.userId === filterChaplain;
      const matchRange = itemDate >= filterStart && itemDate <= filterEnd;
      return matchChaplain && matchRange;
    });
  }, [history, filterChaplain, filterStart, filterEnd]);

  const handleSelectClass = (guideName: string) => {
    const lastClass = [...allHistory]
      .filter(c => c.userId === currentUser.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .find(c => c.guide.trim().toLowerCase() === guideName.trim().toLowerCase());

    if (lastClass) {
      setFormData({
        ...lastClass,
        id: lastClass.id,
        date: new Date().toISOString().split('T')[0],
        status: lastClass.status === RecordStatus.TERMINO ? RecordStatus.TERMINO : RecordStatus.CONTINUACAO,
        lesson: lastClass.status === RecordStatus.TERMINO ? lastClass.lesson : (parseInt(lastClass.lesson) + 1).toString(),
        observations: ''
      });
    }
  };

  const addStudent = () => { if (newStudent.trim()) { setFormData({...formData, students: [...formData.students, newStudent.trim()]}); setNewStudent(''); } };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.guide || !formData.lesson || formData.students.length === 0) {
      setToast({ show: true, message: "Atenção: Data, Setor, Classe, Lição e pelo menos um Aluno são obrigatórios!" });
      setTimeout(() => setToast({ show: false, message: "" }), 3000);
      return;
    }
    onSubmit({...formData, unit});
    setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', students: [], guide: '', lesson: '', status: RecordStatus.INICIO, observations: '' });
  };

  return (
    <div className="space-y-10 pb-20">
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: "" })} />
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Classe Bíblica ({unit})</h2>
          {formData.id && (
            <button type="button" onClick={() => setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', students: [], guide: '', lesson: '', status: RecordStatus.INICIO, observations: '' })} className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 px-4 py-2 rounded-full border border-rose-100">Criar Nova Classe</button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Escolha o setor..." isStrict={true} /></div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lista de Presença *</label>
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
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome da Classe (Suas Classes) *</label>
            <Autocomplete 
              options={classGuides} 
              value={formData.guide} 
              onChange={v => setFormData({...formData, guide: v})} 
              onSelectOption={handleSelectClass}
              placeholder="Digite para buscar sua classe..." 
            />
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Lição Ministrada *</label><input type="number" min="1" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 font-black" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status da Classe *</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setFormData({...formData, status: opt as RecordStatus})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${formData.status === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 text-slate-400 bg-slate-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest active:scale-95 transition-all">
          {formData.id ? 'Atualizar Classe Existente' : 'Salvar Nova Classe'}
        </button>
      </form>

      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-800 px-2 uppercase tracking-tight">Histórico de Classes</h3>
        <HistoryFilterBar users={users} isAdmin={currentUser.role === UserRole.ADMIN} selectedChaplain={filterChaplain} onChaplainChange={setFilterChaplain} startDate={filterStart} onStartChange={setFilterStart} endDate={filterEnd} onEndChange={setFilterEnd} />
        <div className="grid gap-4">
          {filteredHistory.length > 0 ? filteredHistory.map(item => (
            <HistoryCard 
              key={item.id} icon="👥" color={item.status === RecordStatus.TERMINO ? "text-rose-600" : "text-indigo-600"} 
              title={item.guide || 'Classe Bíblica'} 
              subtitle={`${resolveDynamicName(item.sector, item.unit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA)} • ${item.students.length} alunos • ${item.status}`} 
              chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
              isLocked={isRecordLocked(item.date, currentUser.role)}
              isAdmin={currentUser.role === UserRole.ADMIN}
              users={users}
              onTransfer={(newUid) => onTransfer?.('class', item.id, newUid)}
              onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} 
            />
          )) : <p className="text-slate-400 text-center py-10 font-bold uppercase text-[10px]">Nenhum registro para este filtro.</p>}
        </div>
      </div>
    </div>
  );
};

export const SmallGroupForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, masterLists, groupsList = [], history, editingItem, onSubmit, onDelete, onEdit }) => {
  const [formData, setFormData] = useState({ id: '', date: new Date().toISOString().split('T')[0], sector: '', groupName: '', leader: '', shift: 'Manhã', participantsCount: 0, observations: '' });
  const [toast, setToast] = useState({ show: false, message: '' });
  const [filterChaplain, setFilterChaplain] = useState('all');
  const [filterStart, setFilterStart] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [filterEnd, setFilterEnd] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ ...editingItem, date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0] });
    } else {
      setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', groupName: '', leader: '', shift: 'Manhã', participantsCount: 0, observations: '' });
    }
  }, [editingItem]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const itemDate = item.date.split('T')[0];
      const matchChaplain = filterChaplain === 'all' || item.userId === filterChaplain;
      const matchRange = itemDate >= filterStart && itemDate <= filterEnd;
      return matchChaplain && matchRange;
    });
  }, [history, filterChaplain, filterStart, filterEnd]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.groupName || !formData.leader || formData.participantsCount === undefined) {
      setToast({ show: true, message: "Atenção: Preencha todos os campos obrigatórios (*)" });
      setTimeout(() => setToast({ show: false, message: "" }), 3000);
      return;
    }
    onSubmit({...formData, unit});
    setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', groupName: '', leader: '', shift: 'Manhã', participantsCount: 0, observations: '' });
  };

  return (
    <div className="space-y-10 pb-20">
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: "" })} />
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Pequeno Grupo ({unit})</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data Atendimento *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local do PG..." isStrict={true} /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome do Grupo *</label><Autocomplete options={groupsList} value={formData.groupName} onChange={v => setFormData({...formData, groupName: v})} placeholder="Pesquise o nome do grupo..." isStrict={true} /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Líder *</label><input placeholder="Líder do PG" value={formData.leader} onChange={e => setFormData({...formData, leader: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Participantes *</label><input type="number" min="0" value={formData.participantsCount || ''} onChange={e => setFormData({...formData, participantsCount: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none" /></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs">Salvar PG</button>
      </form>

      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-800 px-2 uppercase tracking-tight">Histórico de Atividades</h3>
        <HistoryFilterBar users={users} isAdmin={currentUser.role === UserRole.ADMIN} selectedChaplain={filterChaplain} onChaplainChange={setFilterChaplain} startDate={filterStart} onStartChange={setFilterStart} endDate={filterEnd} onEndChange={setFilterEnd} />
        <div className="grid gap-4">
          {filteredHistory.length > 0 ? filteredHistory.map(item => (
            <HistoryCard 
              key={item.id} icon="🏠" color="text-emerald-600" 
              title={resolveDynamicName(item.groupName, item.unit === Unit.HAB ? masterLists.groupsHAB : masterLists.groupsHABA)} 
              subtitle={`${resolveDynamicName(item.sector, item.unit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA)} • ${item.participantsCount} participantes`} 
              chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'} 
              isLocked={isRecordLocked(item.date, currentUser.role)}
              onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} 
            />
          )) : <p className="text-slate-400 text-center py-10 font-bold uppercase text-[10px]">Nenhum registro para este filtro.</p>}
        </div>
      </div>
    </div>
  );
};

export const StaffVisitForm: React.FC<FormProps> = ({ unit, sectors, users, currentUser, masterLists, staffList = [], history, editingItem, onSubmit, onDelete, onEdit, onToggleReturn }) => {
  const [formData, setFormData] = useState({ id: '', date: new Date().toISOString().split('T')[0], sector: '', reason: VisitReason.AGENDAMENTO, staffName: '', requiresReturn: false, returnDate: new Date().toISOString().split('T')[0], returnCompleted: false, observations: '' });
  const [toast, setToast] = useState({ show: false, message: '' });
  const [filterChaplain, setFilterChaplain] = useState('all');
  const [filterStart, setFilterStart] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [filterEnd, setFilterEnd] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (editingItem) {
      setFormData({ ...editingItem, date: editingItem.date ? editingItem.date.split('T')[0] : new Date().toISOString().split('T')[0], returnDate: editingItem.returnDate ? editingItem.returnDate.split('T')[0] : new Date().toISOString().split('T')[0] });
    } else {
      setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', reason: VisitReason.AGENDAMENTO, staffName: '', requiresReturn: false, returnDate: new Date().toISOString().split('T')[0], returnCompleted: false, observations: '' });
    }
  }, [editingItem]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const itemDate = item.date.split('T')[0];
      const matchChaplain = filterChaplain === 'all' || item.userId === filterChaplain;
      const matchRange = itemDate >= filterStart && itemDate <= filterEnd;
      return matchChaplain && matchRange;
    });
  }, [history, filterChaplain, filterStart, filterEnd]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.sector || !formData.staffName) {
      setToast({ show: true, message: "Atenção: Data, Setor e Colaborador são obrigatórios!" });
      setTimeout(() => setToast({ show: false, message: "" }), 3000);
      return;
    }
    onSubmit({...formData, unit});
    setFormData({ id: '', date: new Date().toISOString().split('T')[0], sector: '', reason: VisitReason.AGENDAMENTO, staffName: '', requiresReturn: false, returnDate: new Date().toISOString().split('T')[0], returnCompleted: false, observations: '' });
  };

  return (
    <div className="space-y-10 pb-20">
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: "" })} />
      <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Visita a Colaborador ({unit})</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Data *</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Setor *</label><Autocomplete options={sectors} value={formData.sector} onChange={v => setFormData({...formData, sector: v})} placeholder="Local da visita..." isStrict={true} /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Colaborador *</label><Autocomplete options={staffList} value={formData.staffName} onChange={v => setFormData({...formData, staffName: v})} placeholder="Nome do colaborador..." /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Motivo *</label>
            <select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value as VisitReason})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold">
              {Object.values(VisitReason).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-rose-100 transition-colors">
              <input type="checkbox" id="requiresReturn" checked={formData.requiresReturn} onChange={e => setFormData({...formData, requiresReturn: e.target.checked})} className="w-6 h-6 rounded-lg text-rose-600 focus:ring-rose-500 cursor-pointer" />
              <label htmlFor="requiresReturn" className="font-black text-slate-700 text-xs uppercase tracking-widest cursor-pointer">Necessita Retorno?</label>
            </div>
          </div>
          {formData.requiresReturn && (
            <div className="space-y-1 md:col-span-2 animate-in slide-in-from-left duration-300">
              <label className="text-[10px] font-black text-rose-500 ml-2 uppercase">Agendar Retorno para *</label>
              <input type="date" value={formData.returnDate} onChange={e => setFormData({...formData, returnDate: e.target.value})} className="w-full p-4 rounded-2xl bg-rose border-2 border-rose-100 text-rose-700 font-bold" />
            </div>
          )}
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Observações</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none h-24 outline-none resize-none" /></div>
        </div>
        <button type="submit" className="w-full py-5 bg-rose-600 text-white font-black rounded-2xl shadow-xl uppercase text-xs">Salvar Visita</button>
      </form>

      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-800 px-2 uppercase tracking-tight">Histórico de Visitas</h3>
        <HistoryFilterBar users={users} isAdmin={currentUser.role === UserRole.ADMIN} selectedChaplain={filterChaplain} onChaplainChange={setFilterChaplain} startDate={filterStart} onStartChange={setFilterStart} endDate={filterEnd} onEndChange={setFilterEnd} />
        <div className="grid gap-4">
          {filteredHistory.length > 0 ? filteredHistory.map(item => (
            <HistoryCard 
              key={item.id} icon="🤝" color="text-rose-600" 
              title={resolveDynamicName(item.staffName, item.unit === Unit.HAB ? masterLists.staffHAB : masterLists.staffHABA)} 
              subtitle={`${resolveDynamicName(item.sector, item.unit === Unit.HAB ? masterLists.sectorsHAB : masterLists.sectorsHABA)} • ${item.reason}`} 
              chaplainName={users.find(u => u.id === item.userId)?.name || 'Sistema'}
              isLocked={isRecordLocked(item.date, currentUser.role)}
              onEdit={() => onEdit?.(item)} onDelete={() => onDelete(item.id)} 
              middle={item.requiresReturn && !item.returnCompleted && item.returnDate && (
                <div className="bg-rose-500 text-white px-5 py-3 rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 border-white animate-in zoom-in">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80 mb-1 leading-none">Retorno em</span>
                  <span className="text-base md:text-lg font-black tracking-tighter leading-none">{item.returnDate.split('-').reverse().join('/')}</span>
                </div>
              )}
              extra={item.requiresReturn && (
                <button onClick={() => onToggleReturn?.(item.id)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md ${item.returnCompleted ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-500 animate-pulse'}`}>
                  <i className={`fas ${item.returnCompleted ? 'fa-check' : 'fa-flag'} text-base`}></i>
                </button>
              )}
            />
          )) : <p className="text-slate-400 text-center py-10 font-bold uppercase text-[10px]">Nenhum registro para este filtro.</p>}
        </div>
      </div>
    </div>
  );
};
