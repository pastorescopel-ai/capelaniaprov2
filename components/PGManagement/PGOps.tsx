
import React, { useMemo, useEffect } from 'react';
import { Unit, UserRole } from '../../types';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthProvider';
import Autocomplete from '../Shared/Autocomplete';
import ConfirmationModal from '../Shared/ConfirmationModal';
import { usePGInference } from '../../hooks/usePGInference';
import { useVisitManagement } from '../../hooks/useVisitManagement';
import VisitHistoryList from './VisitHistoryList';

interface PGOpsProps {
  unit: Unit;
}

const PGOps: React.FC<PGOpsProps> = ({ unit }) => {
  const { proGroups, users, saveRecord, visitRequests, proStaff, deleteRecord, proGroupLocations, proSectors } = useApp();
  const { currentUser } = useAuth();
  
  const { inferPGDetails } = usePGInference(unit, proGroups, proSectors, proGroupLocations, proStaff);
  const { 
    isProcessing, 
    editingRequestId, 
    inviteToDelete, 
    setInviteToDelete,
    form,
    handleEditRequest,
    handleCancelEdit,
    handleSaveVisit,
    handleDeleteVisit
  } = useVisitManagement(saveRecord, deleteRecord);

  const chaplains = useMemo(() => users, [users]);
  
  const activeRequests = useMemo(() => {
    return visitRequests
        .filter(r => r.unit === unit && r.status !== 'confirmed' && r.status !== 'declined')
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visitRequests, unit]);

  const leaderInfo = useMemo(() => inferPGDetails(form.selectedPG), [inferPGDetails, form.selectedPG]);

  const { setLeaderPhone, setMeetingLocation } = form;

  // Sincronizar WhatsApp e Local quando o PG é selecionado
  useEffect(() => {
    if (leaderInfo && form.selectedPG && !editingRequestId) {
        setLeaderPhone(leaderInfo.leaderPhone || '');
        setMeetingLocation(leaderInfo.sectorName || '');
    }
  }, [leaderInfo, form.selectedPG, editingRequestId, setLeaderPhone, setMeetingLocation]);

  const onSave = () => {
    const details = inferPGDetails(form.selectedPG);
    handleSaveVisit(unit, {
      leaderName: details.leaderName,
      leaderPhone: form.leaderPhone,
      sectorId: details.sectorId,
      sectorName: details.sectorName,
      staffId: details.staffId
    }, proStaff);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
        
        <ConfirmationModal 
            isOpen={!!inviteToDelete}
            title="Excluir Agendamento?"
            message="Esta ação removerá o agendamento da lista do capelão designado. Deseja continuar?"
            confirmLabel="Sim, Excluir"
            variant="danger"
            onConfirm={() => inviteToDelete && handleDeleteVisit(inviteToDelete)}
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
                        value={form.selectedPG}
                        onChange={form.setSelectedPG}
                        placeholder="Pesquisar PG..."
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700"
                    />
                    {leaderInfo && form.selectedPG && (
                        <div className="mx-2 mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-blue-800 uppercase block">Responsável: {leaderInfo.leaderName}</span>
                            <span className="text-[10px] font-bold text-blue-600 uppercase block bg-white px-2 py-1 rounded-lg border border-blue-100">
                                <i className="fas fa-briefcase mr-1"></i>
                                Lotação: {leaderInfo.sectorName}
                            </span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">WhatsApp do Líder (Fixo)</label>
                        <div className="relative">
                            <i className="fab fa-whatsapp absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 text-lg"></i>
                            <input 
                                type="text" 
                                value={form.leaderPhone} 
                                onChange={e => form.setLeaderPhone(e.target.value)} 
                                placeholder="(00) 00000-0000"
                                className="w-full pl-12 p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Local da Reunião (Texto Livre)</label>
                        <div className="relative">
                            <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-blue-500"></i>
                            <input 
                                type="text" 
                                value={form.meetingLocation} 
                                onChange={e => form.setMeetingLocation(e.target.value)} 
                                placeholder="Ex: Refeitório, Sala 3, Auditório..."
                                className="w-full pl-12 p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data da Visita</label>
                        <input type="date" value={form.visitDate} onChange={e => form.setVisitDate(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none"/>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Horário</label>
                        <input type="time" value={form.visitTime} onChange={e => form.setVisitTime(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none"/>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Escalar Capelão</label>
                    <select value={form.selectedChaplainId} onChange={e => form.setSelectedChaplainId(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 outline-none">
                        <option value="">Selecione...</option>
                        {chaplains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Observações para o Capelão</label>
                    <textarea value={form.notes} onChange={e => form.setNotes(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-medium text-sm text-slate-700 h-24 resize-none outline-none" placeholder="Ex: Focar no discipulado do líder..."/>
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
                        onClick={onSave} 
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

        <VisitHistoryList 
          requests={activeRequests}
          users={users}
          currentUser={currentUser}
          editingRequestId={editingRequestId}
          onEdit={handleEditRequest}
          onDelete={setInviteToDelete}
        />
    </div>
  );
};

export default PGOps;
