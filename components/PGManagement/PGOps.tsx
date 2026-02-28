
import React, { useState, useMemo } from 'react';
import { Unit, VisitRequest, UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import Autocomplete from '../Shared/Autocomplete';
import ConfirmationModal from '../Shared/ConfirmationModal';

interface PGOpsProps {
  unit: Unit;
}

const PGOps: React.FC<PGOpsProps> = ({ unit }) => {
  const { proGroups, users, saveRecord, visitRequests, proStaff, deleteRecord, proGroupLocations, proSectors } = useApp();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  
  const [selectedPG, setSelectedPG] = useState('');
  const [selectedChaplainId, setSelectedChaplainId] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [visitTime, setVisitTime] = useState('19:00');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [inviteToDelete, setInviteToDelete] = useState<string | null>(null);

  const chaplains = useMemo(() => users, [users]);
  
  const activeRequests = useMemo(() => {
    return visitRequests
        .filter(r => r.unit === unit && r.status !== 'confirmed' && r.status !== 'declined')
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visitRequests, unit]);

  const leaderInfo = useMemo(() => {
    if (!selectedPG) return null;
    const pg = proGroups.find(g => g.name === selectedPG && g.unit === unit);
    if (!pg) return null;

    const leaderName = pg.currentLeader || 'Não informado';
    
    // Determine sector name
    let sectorName = 'Setor não informado';
    let sectorId = pg.sectorId;
    
    // 1. Check proGroupLocations
    if (!sectorId) {
        const loc = proGroupLocations.find(l => l.groupId === pg.id);
        if (loc) sectorId = loc.sectorId;
    }

    // 2. Check Leader's Registration (ProStaff) - "Matrícula"
    if (!sectorId && pg.currentLeader) {
        // Try to find staff by name (case insensitive)
        const staff = proStaff.find(s => s.name.toLowerCase() === pg.currentLeader?.toLowerCase() && s.unit === unit);
        if (staff) sectorId = staff.sectorId;
    }
    
    if (sectorId) {
        const sec = proSectors.find(s => s.id === sectorId);
        if (sec) sectorName = sec.name;
    }

    return { name: leaderName, sectorName, sectorId };
  }, [selectedPG, proGroups, unit, proGroupLocations, proSectors, proStaff]);

  const handleCreateMission = async () => {
    if (!selectedPG || !selectedChaplainId || !visitDate || !visitTime) {
        showToast("Preencha todos os campos, incluindo data e hora.", "warning");
        return;
    }
    const pg = proGroups.find(g => g.name === selectedPG && g.unit === unit);
    const chaplain = users.find(u => u.id === selectedChaplainId);

    if (!pg || !chaplain) return;

    setIsProcessing(true);
    try {
        const leaderPhone = pg.leaderPhone || "";
        const sectorId = leaderInfo?.sectorId || pg.sectorId || null;

        const requestData: VisitRequest = {
            id: editingRequestId || crypto.randomUUID(),
            pgName: pg.name || '',
            leaderName: pg.currentLeader || 'Líder não registrado',
            leaderPhone: leaderPhone || null,
            unit: unit,
            date: `${visitDate}T00:00:00Z`,
            scheduledTime: visitTime,
            status: 'assigned',
            assignedChaplainId: chaplain.id,
            requestNotes: notes || "Visita de acompanhamento designada pela gestão.",
            sectorId: sectorId,
            isRead: false
        };
        
        const success = await saveRecord('visitRequests', requestData);
        
        if (success) {
            showToast(editingRequestId ? 'Agendamento atualizado!' : `Convite enviado para ${chaplain.name}!`, "success");
            handleCancelEdit();
        } else {
            showToast("Erro ao salvar agendamento.", "warning");
        }
    } catch (e) {
        console.error(e);
        showToast("Erro ao processar agendamento.", "warning");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleEditRequest = (req: VisitRequest) => {
    setEditingRequestId(req.id);
    setSelectedPG(req.pgName);
    setSelectedChaplainId(req.assignedChaplainId || '');
    setVisitDate(req.date.split('T')[0]);
    setVisitTime(req.scheduledTime || '19:00');
    setNotes(req.requestNotes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingRequestId(null);
    setNotes('');
    setSelectedPG('');
    setSelectedChaplainId('');
    setVisitDate(new Date().toLocaleDateString('en-CA'));
    setVisitTime('19:00');
  };

  const executeDelete = async () => {
    if (!inviteToDelete) return;
    setIsProcessing(true);
    try {
        await deleteRecord('visitRequests', inviteToDelete);
        showToast("Agendamento excluído.", "success");
        if (editingRequestId === inviteToDelete) handleCancelEdit();
    } catch (e) {
        showToast("Erro ao excluir.", "warning");
    } finally {
        setIsProcessing(false);
        setInviteToDelete(null);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
        
        <ConfirmationModal 
            isOpen={!!inviteToDelete}
            title="Cancelar Convite?"
            message="Esta ação removerá o agendamento da lista do capelão designado. Deseja continuar?"
            confirmLabel="Sim, Cancelar"
            variant="danger"
            onConfirm={executeDelete}
            onCancel={() => setInviteToDelete(null)}
        />

        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 ${editingRequestId ? 'bg-blue-600' : 'bg-slate-900'} text-white rounded-2xl flex items-center justify-center text-2xl shadow-xl transition-colors`}>
                    <i className={`fas ${editingRequestId ? 'fa-edit' : 'fa-calendar-alt'}`}></i>
                </div>
                <div>
                    <h3 className="font-black text-slate-800 text-xl uppercase tracking-tighter">
                        {editingRequestId ? 'Editar Agendamento' : 'Agendar Visita PG'}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                        {editingRequestId ? 'Ajuste os detalhes da missão selecionada' : 'Escalar capelão para suporte estratégico'}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Grupo Alvo</label>
                    <Autocomplete 
                        options={proGroups.filter(g => g.unit === unit).map(g => ({ value: g.name, label: g.name }))}
                        value={selectedPG}
                        onChange={setSelectedPG}
                        placeholder="Pesquisar PG..."
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700"
                    />
                    {leaderInfo && (
                        <div className="mx-2 mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-blue-800 uppercase block">Responsável: {leaderInfo.name}</span>
                            <span className="text-[10px] font-bold text-blue-600 uppercase block bg-white px-2 py-1 rounded-lg border border-blue-100">
                                <i className="fas fa-map-marker-alt mr-1"></i>
                                {leaderInfo.sectorName}
                            </span>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data da Visita</label>
                        <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none"/>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Horário</label>
                        <input type="time" value={visitTime} onChange={e => setVisitTime(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none"/>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Escalar Capelão</label>
                    <select value={selectedChaplainId} onChange={e => setSelectedChaplainId(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none">
                        <option value="">Selecione...</option>
                        {chaplains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Observações para o Capelão</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-medium text-sm text-slate-700 h-24 resize-none outline-none" placeholder="Ex: Focar no discipulado do líder..."/>
                </div>
                
                <div className="flex gap-3">
                    {editingRequestId && (
                        <button 
                            onClick={handleCancelEdit}
                            className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                        >
                            Cancelar
                        </button>
                    )}
                    <button 
                        onClick={handleCreateMission} 
                        disabled={isProcessing} 
                        className={`flex-[2] py-5 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all flex items-center justify-center gap-2
                            ${isProcessing ? 'bg-slate-400 cursor-not-allowed' : (editingRequestId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#005a9c] hover:bg-[#004a80]')} active:scale-95`}
                    >
                        {isProcessing ? (
                            <>
                                <i className="fas fa-circle-notch fa-spin"></i>
                                {editingRequestId ? 'Salvando...' : 'Agendando...'}
                            </>
                        ) : (editingRequestId ? 'Salvar Alterações' : 'Agendar Visita')}
                    </button>
                </div>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="font-black text-slate-400 uppercase text-xs tracking-widest px-4">Histórico de Agendamentos Recentes</h3>
            {activeRequests.length === 0 && (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-[2rem]"><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Tudo em dia!</p></div>
            )}
            {activeRequests.map(req => {
                const chaplain = users.find(u => u.id === req.assignedChaplainId);
                return (
                    <div key={req.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${req.status === 'assigned' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                                <h4 className="font-bold text-slate-800 text-sm uppercase truncate">{req.pgName}</h4>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase truncate">Designado: {chaplain?.name || 'Aguardando'}</p>
                        </div>
                        <div className="text-right flex items-center gap-4 flex-shrink-0 ml-4">
                            <div>
                                <span className="block text-[10px] font-black text-slate-600 uppercase tracking-tight">
                                    {(() => {
                                        try {
                                            const datePart = req.date.split('T')[0];
                                            const [year, month, day] = datePart.split('-').map(Number);
                                            const d = new Date(year, month - 1, day);
                                            return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '').toUpperCase();
                                        } catch { return req.date; }
                                    })()}
                                    {req.scheduledTime && ` às ${req.scheduledTime}`}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${req.status === 'assigned' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>{req.status === 'assigned' ? 'Pendente' : 'Designado'}</span>
                            </div>
                            {currentUser?.role === UserRole.ADMIN && (
                                <div className="flex items-center gap-2 transition-all">
                                    <button 
                                        onClick={() => handleEditRequest(req)}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${editingRequestId === req.id ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-500 hover:bg-blue-600 hover:text-white'}`}
                                        title="Editar Agendamento"
                                    >
                                        <i className="fas fa-edit text-xs"></i>
                                    </button>
                                    <button 
                                        onClick={() => setInviteToDelete(req.id)}
                                        className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                        title="Excluir Convite"
                                    >
                                        <i className="fas fa-trash-alt text-xs"></i>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>

    </div>
  );
};

export default PGOps;
