
import React, { useState, useEffect, useCallback } from 'react';
import { MasterLists, Config, User, BibleStudy, BibleClass, SmallGroup, StaffVisit, ProStaff, ProSector, ProGroup } from '../types';
import { useToast } from '../contexts/ToastContext';
import AdminConfig from './Admin/AdminConfig';
import { useApp } from '../contexts/AppContext';

interface AdminPanelProps {
  config: Config;
  masterLists: MasterLists;
  users: User[];
  currentUser: User;
  bibleStudies: BibleStudy[];
  bibleClasses: BibleClass[];
  smallGroups: SmallGroup[];
  staffVisits: StaffVisit[];
  onSaveAllData: (config: Config, lists: MasterLists) => Promise<any>;
  onRestoreFullDNA: (dna: any) => Promise<{ success: boolean; message: string }>;
  onRefreshData: () => Promise<any>;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  config, masterLists, users, currentUser, 
  bibleStudies, bibleClasses, smallGroups, staffVisits,
  onSaveAllData, onRefreshData
}) => {
  const { applySystemOverrides } = useApp();
  const [localConfig, setLocalConfig] = useState(config);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const finalConfig = { ...localConfig, lastModifiedBy: currentUser.name, lastModifiedAt: Date.now() };
      await onSaveAllData(finalConfig, masterLists);
      showToast('Configurações salvas!', 'success');
    } catch (error) { 
      showToast('Falha ao salvar.', 'warning'); 
    } finally { 
      setIsSaving(false); 
    }
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-32 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Configurações do Sistema</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identidade Visual e Formatação de Relatórios</p>
        </div>
        <button onClick={handleSaveAll} className="px-10 py-5 text-white font-black rounded-[1.5rem] shadow-2xl hover:brightness-110 transition-all flex items-center gap-3 uppercase text-[10px] tracking-widest active:scale-95" style={{ backgroundColor: localConfig.primaryColor || '#005a9c' }}>
          <i className={`fas ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-save'}`}></i> {isSaving ? 'Gravando...' : 'Aplicar Mudanças'}
        </button>
      </header>

      <AdminConfig config={localConfig} setConfig={setLocalConfig} />
    </div>
  );
};

export default AdminPanel;
