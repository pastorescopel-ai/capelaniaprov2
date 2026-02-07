
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
  const { proGroups, users, saveRecord, visitRequests, proStaff, deleteRecord } = useApp();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  
  const [selectedPG, setSelectedPG] = useState('');
  const [selectedChaplainId, setSelectedChaplainId] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
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

    let leaderName = pg.currentLeader || 'Não informado';
    return { name: leaderName };
  }, [selectedPG, proGroups, unit]);

  const handleCreateMission = async () => {
    if (!selectedPG || !selectedChaplainId) {
        showToast("Preencha o PG e o Capelão.", "warning");
        return;
    }
    const pg = proGroups.find(g => g.name === selectedPG && g.unit === unit);
    const chaplain = users.find(u => u.id === selectedChaplainId);

    if (!pg || !chaplain) return;

    setIsProcessing(true);
    try {
        const leaderPhone = pg.leaderPhone || "";

        const newRequest: VisitRequest = {
            id: crypto.randomUUID(),
            pgName: pg.name,
            leaderName: pg.currentLeader || 'Líder não registrado',
            leaderPhone: leaderPhone,
            unit: unit,
            date: new Date().toISOString(),
            status: 'assigned',
            assignedChaplainId: chaplain.id,
            requestNotes: notes || "Visita de acompanhamento designada pela gestão.",
            isRead: false
        };
        await saveRecord('visitRequests', newRequest);
        showToast(`Convite enviado para ${chaplain.name}!`, "success");
        setNotes('');
        setSelectedPG('');
        setSelectedChaplainId('');
    } catch (e) {
        showToast("Erro ao processar convite.", "warning");
    } finally {
        setIsProcessing(false);
    }
  };

  const executeDelete = async () => {
    if (!inviteToDelete) return;
    setIsProcessing(true);
    try {
        await deleteRecord('visitRequests', inviteToDelete);
        showToast("Agendamento excluído.", "success");
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
                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl shadow-xl"><i className="fas fa-calendar-alt"></i></div>
                <div>
                    <h3 className="font-black text-slate-800 text-xl uppercase tracking-tighter">Agendar Visita PG</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Escalar capelão para suporte estratégico</p>
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
                        <div className="mx-2 mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <span className="text-[10px] font-black text-blue-800 uppercase block">Responsável: {leaderInfo.name}</span>
                        </div>
                    )}
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
                <button onClick={handleCreateMission} disabled={isProcessing} className="w-full py-5 bg-[#005a9c] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                    {isProcessing ? 'Sincronizando...' : 'Enviar Convite Oficial'}
                </button>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="font-black text-slate-400 uppercase text-xs tracking-widest px-4">Histórico de Convites Recentes</h3>
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
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(req.date).toLocaleDateString()}</span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${req.status === 'assigned' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>{req.status === 'assigned' ? 'Pendente' : 'Designado'}</span>
                            </div>
                            {currentUser?.role === UserRole.ADMIN && (
                                <button 
                                    onClick={() => setInviteToDelete(req.id)}
                                    className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                    title="Excluir Convite"
                                >
                                    <i className="fas fa-trash-alt text-xs"></i>
                                </button>
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
