
import React, { useState } from 'react';
import { User } from '../types';
import { useToast } from '../contexts/ToastContext';
import { hashPassword } from '../utils/crypto';

interface ProfileProps {
  user: User;
  isSyncing?: boolean;
  onUpdateUser: (updatedUser: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, isSyncing, onUpdateUser }) => {
  const [name, setName] = useState(user.name);
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [profilePic, setProfilePic] = useState(user.profilePic || '');
  const { showToast } = useToast();

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setProfilePic(compressed);
        onUpdateUser({ ...user, profilePic: compressed });
        showToast("Sua foto de perfil foi sincronizada!", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Deseja realmente remover sua foto de perfil?")) {
      setProfilePic('');
      onUpdateUser({ ...user, profilePic: '' });
      showToast("Foto removida.", "warning");
    }
  };

  const triggerFileInput = () => {
    document.getElementById('fileInput')?.click();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Preparar objeto de atualização
    let updatedUser = { ...user, name, profilePic };
    
    // Se o usuário está tentando mudar a senha
    if (passData.new || passData.confirm) {
      if (passData.new !== passData.confirm) {
        showToast('As novas senhas digitadas não coincidem!', "warning");
        return;
      }
      
      if (passData.new.length < 4) {
        showToast('A nova senha deve ter pelo menos 4 caracteres.', "warning");
        return;
      }

      // IMPORTANTE: Criptografar a nova senha antes de salvar no banco
      const securePassword = await hashPassword(passData.new.trim());
      updatedUser.password = securePassword;
    }
    
    onUpdateUser(updatedUser);
    setPassData({ current: '', new: '', confirm: '' });
    showToast("Suas alterações foram salvas com segurança!", "success");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {isSyncing && (
        <div className="fixed inset-0 z-[1000]">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-12 rounded-[3.5rem] shadow-2xl flex flex-col items-center gap-8 max-w-md w-full text-center border-4 border-blue-50 animate-in zoom-in duration-300">
            <div className="relative">
               <div className="w-24 h-24 border-8 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fas fa-lock text-blue-600 text-2xl animate-pulse"></i>
               </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Sincronizando Perfil</h3>
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest leading-relaxed px-6">Gravando seus dados criptografados na nuvem...</p>
            </div>
          </div>
        </div>
      )}

      <header>
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Meu Perfil</h1>
        <p className="text-slate-500 font-medium">Controle de identidade e segurança da conta</p>
      </header>

      <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center space-y-6">
        <div className="relative group cursor-pointer" onClick={triggerFileInput}>
          <div className="w-32 h-32 rounded-[2.5rem] bg-slate-100 overflow-hidden border-4 border-white shadow-xl flex items-center justify-center">
            {profilePic ? (
              <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600 font-black text-3xl">
                {user.name[0]}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2.5rem]">
              <i className="fas fa-camera text-white text-xl"></i>
            </div>
          </div>
          <input id="fileInput" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
        <div className="text-center space-y-2 flex flex-col items-center">
          <button type="button" onClick={triggerFileInput} className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] hover:text-blue-800 transition-colors">
            Alterar Foto de Perfil
          </button>
          {profilePic && (
            <button type="button" onClick={handleRemovePhoto} className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-700 transition-colors">
              Remover Foto Atual
            </button>
          )}
          <div className="pt-4">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{user.name}</h2>
            <p className="text-slate-500 font-bold text-xs">{user.email}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleUpdateProfile} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
            <i className="fas fa-id-card text-blue-600"></i> Informações Básicas
          </h3>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nome Completo</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-bold" />
          </div>
        </div>

        <div className="space-y-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
            <i className="fas fa-shield-alt text-blue-600"></i> Segurança da Conta
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Deixe os campos abaixo em branco para manter sua senha atual.</p>
          <div className="space-y-4 pt-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nova Senha</label>
                <input type="password" value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-blue-500 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Repetir Senha</label>
                <input type="password" value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-blue-500 font-bold" />
              </div>
            </div>
            <p className="text-[9px] text-amber-600 font-bold uppercase tracking-tighter italic"><i className="fas fa-info-circle mr-1"></i> A nova senha será automaticamente protegida com SHA-256 antes de ser salva.</p>
          </div>
        </div>

        <button type="submit" className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all uppercase text-xs tracking-[0.2em]">
          Confirmar e Salvar Perfil
        </button>
      </form>
    </div>
  );
};

export default Profile;
