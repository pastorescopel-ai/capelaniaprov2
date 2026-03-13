import { useState, useCallback } from 'react';
import { User } from '../types';
import { useToast } from '../contexts/ToastProvider';
import { hashPassword } from '../utils/crypto';
import { getCroppedImg } from '../utils/imageUtils';

interface UseProfileProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

export const useProfile = ({ user, onUpdateUser }: UseProfileProps) => {
  const [name, setName] = useState(user.name);
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [profilePic, setProfilePic] = useState(user.profilePic || '');
  const { showToast } = useToast();

  // Cropper State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels, rotation);
      setProfilePic(croppedImage);
      onUpdateUser({ ...user, profilePic: croppedImage });
      setIsCropping(false);
      setImageToCrop(null);
      showToast("Foto de perfil atualizada!", "success");
    } catch (e) {
      console.error(e);
      showToast("Erro ao processar imagem.", "error");
    }
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setImageToCrop(null);
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Deseja realmente remover sua foto de perfil?")) {
      setProfilePic('');
      onUpdateUser({ ...user, profilePic: '' });
      showToast("Foto removida com sucesso.", "info");
    }
  };

  const triggerFileInput = () => {
    document.getElementById('fileInput')?.click();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const updatedUser = { ...user, name, profilePic };
    
    if (passData.new || passData.confirm) {
      if (!passData.current) {
        showToast('Você deve informar sua senha atual para definir uma nova!', "error");
        return;
      }

      const currentHash = await hashPassword(passData.current.trim());
      if (currentHash !== user.password) {
        showToast('A senha atual informada está incorreta.', "error");
        return;
      }

      if (passData.new !== passData.confirm) {
        showToast('As novas senhas digitadas não coincidem!', "error");
        return;
      }
      
      if (passData.new.length < 4) {
        showToast('A nova senha deve ter pelo menos 4 caracteres.', "error");
        return;
      }

      const securePassword = await hashPassword(passData.new.trim());
      updatedUser.password = securePassword;
    }
    
    onUpdateUser(updatedUser);
    setPassData({ current: '', new: '', confirm: '' });
    showToast("Suas alterações foram salvas com segurança!", "success");
  };

  return {
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
  };
};
