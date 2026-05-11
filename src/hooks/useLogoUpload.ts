import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { Config } from '../types';

export function useLogoUpload(config: Config, setConfig: (c: Config) => void) {
  const [isUploading, setIsUploading] = useState<'app' | 'report' | null>(null);
  const { showToast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'app' | 'report') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!supabase) {
      showToast("Erro: Conexão com Supabase não detectada.", "warning");
      return;
    }

    setIsUploading(type);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-logo-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage
        .from('app-assets')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('app-assets')
        .getPublicUrl(fileName);

      if (type === 'app') {
        setConfig({ ...config, appLogoUrl: publicUrl });
      } else {
        setConfig({ ...config, reportLogoUrl: publicUrl });
      }
      showToast("Upload realizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast("Falha no upload. Verifique bucket 'app-assets'.", "warning");
    } finally {
      setIsUploading(null);
      e.target.value = '';
    }
  };

  return { handleUpload, isUploading };
}
