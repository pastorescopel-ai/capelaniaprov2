
import React, { useState } from 'react';
import { User } from '../types';

interface ProfileProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser }) => {
  const [name, setName] = useState(user.name);
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [profilePic, setProfilePic] = useState(user.profilePic || '');

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
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Qualidade 70%
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
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    
    let updatedUser = { ...user, name, profilePic };

    // Se houver tentativa de mudar senha
    if (passData.new || passData.confirm) {
      if (passData.new !== passData.confirm) {
        return alert('As novas senhas não coincidem!');
      }
      updatedUser.password = passData.new;
    }

    onUpdateUser(updatedUser);
    setPassData({ current: '', new: '', confirm: '' });
    alert('Perfil atualizado com sucesso!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header>
        <h1 className="text-3xl font-bold text-slate-800">Meu Perfil</h1>
        <p className="text-slate-500">Dados pessoais e segurança da conta</p>
      </header>

      <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center space-y-6">
        <div className="relative group cursor-pointer" onClick={() => document.getElementById('fileInput')?.click()}>
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
        <div className="text-center space-y-1">
          <p className="text-xs font-black text-blue-600 uppercase tracking-[0.2em]">Inserir foto</p>
          <h2 className="text-2xl font-bold text-slate-800">{user.name}</h2>
          <p className="text-slate-500 font-medium">{user.email}</p>
        </div>
      </div>

      <form onSubmit={handleUpdateProfile} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fas fa-id-card text-blue-600"></i> Dados Pessoais
          </h3>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Nome Completo</label>
            <input 
              required 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500" 
              placeholder="Seu nome"
            />
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fas fa-shield-alt text-blue-600"></i> Segurança
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Senha Atual (para verificação)</label>
              <input type="password" value={passData.current} onChange={e => setPassData({...passData, current: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Nova Senha</label>
                <input type="password" value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Confirmar Nova Senha</label>
                <input type="password" value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all uppercase text-xs tracking-widest">
          Salvar Alterações do Perfil
        </button>
      </form>
    </div>
  );
};

export default Profile;
