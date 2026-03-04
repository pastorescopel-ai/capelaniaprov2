
import React from 'react';
import Cropper from 'react-easy-crop';
import { User } from '../types';
import Button from './Shared/Button';
import { useProfile } from '../hooks/useProfile';

interface ProfileProps {
  user: User;
  isSyncing?: boolean;
  onUpdateUser: (updatedUser: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, isSyncing, onUpdateUser }) => {
  const {
    name, setName,
    passData, setPassData,
    profilePic,
    imageToCrop,
    crop, setCrop,
    zoom, setZoom,
    rotation, setRotation,
    isCropping,
    onCropComplete,
    handleFileChange,
    handleConfirmCrop,
    handleCancelCrop,
    handleRemovePhoto,
    triggerFileInput,
    handleUpdateProfile
  } = useProfile({ user, onUpdateUser });

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Modal de Recorte de Imagem */}
      {isCropping && imageToCrop && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md" onClick={handleCancelCrop} />
          <div className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Ajustar Foto</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Arraste e use o zoom para enquadrar</p>
              </div>
              <button onClick={handleCancelCrop} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="relative h-[400px] bg-slate-900">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
              />
            </div>

            <div className="p-8 space-y-6 bg-white">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <i className="fas fa-search-plus text-slate-400 text-sm"></i>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <i className="fas fa-redo text-slate-400 text-sm"></i>
                  <input
                    type="range"
                    value={rotation}
                    min={0}
                    max={360}
                    step={1}
                    aria-labelledby="Rotation"
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="ghost"
                  onClick={handleCancelCrop}
                  className="flex-1 py-4 text-[10px]"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmCrop}
                  className="flex-1 py-4 text-[10px]"
                >
                  Confirmar Ajuste
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

        <Button 
          type="submit" 
          variant="dark"
          isLoading={isSyncing}
          className="w-full py-5 text-xs tracking-[0.2em]"
        >
          Confirmar e Salvar Perfil
        </Button>
      </form>
    </div>
  );
};

export default Profile;
