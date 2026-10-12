import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 400;
// Campos que mudam sozinhos ou não contam como "o capelão começou a preencher".
const IGNORED_KEYS = ['id', 'userId', 'date', 'returnDate', 'participantType'];

const significant = (obj: Record<string, any>) => {
  const out: Record<string, any> = {};
  Object.keys(obj || {}).sort().forEach(k => { if (!IGNORED_KEYS.includes(k)) out[k] = obj[k]; });
  return JSON.stringify(out);
};

const safeGet = (key: string): { savedAt: number; data: Record<string, any> } | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) { localStorage.removeItem(key); return null; }
    return parsed;
  } catch { return null; }
};
const safeSet = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage cheio/bloqueado: sem rascunho, app segue normal */ } };
const safeRemove = (key: string) => { try { localStorage.removeItem(key); } catch { /* idem */ } };

interface Options<T extends Record<string, any>> {
  storageKey: string;
  formData: T;
  defaultState: T;
  setFormData: (updater: (prev: T) => T) => void;
  enabled: boolean;     // false ao editar um registro já salvo
  isActive: boolean;    // aba do formulário em foco
}

// Rascunho automático: guarda a chamada/formulário em andamento no próprio aparelho e oferece
// "Continuar de onde parou" quando o formulário volta vazio (internet caiu, trocou de aba,
// fechou o app). Só apaga o rascunho ao salvar ou limpar de verdade -- sair da aba ou trocar de
// unidade (que o app já trata como "abandonar") mantém o rascunho guardado.
export function useFormDraft<T extends Record<string, any>>({ storageKey, formData, defaultState, setFormData, enabled, isActive }: Options<T>) {
  const [draft, setDraft] = useState<{ savedAt: number } | null>(null);
  const prevKeyRef = useRef(storageKey);
  const wasDirtyRef = useRef(false);

  const pristine = significant(formData) === significant(defaultState);

  useEffect(() => {
    if (!enabled) { setDraft(null); return; }
    if (prevKeyRef.current !== storageKey) {
      prevKeyRef.current = storageKey;
      wasDirtyRef.current = false;
      setDraft(null);
      return; // 1ª passada com a chave nova: o formulário ainda é o da unidade/usuário anterior
    }
    if (!pristine) {
      wasDirtyRef.current = true;
      setDraft(null);
      const t = setTimeout(() => safeSet(storageKey, { savedAt: Date.now(), data: formData }), SAVE_DEBOUNCE_MS);
      return () => clearTimeout(t);
    }
    // Voltou a ficar vazio dentro da mesma aba ativa = salvou ou limpou: apaga o rascunho.
    if (wasDirtyRef.current && isActive) safeRemove(storageKey);
    wasDirtyRef.current = false;
    const stored = isActive ? safeGet(storageKey) : null;
    setDraft(stored ? { savedAt: stored.savedAt } : null);
  }, [formData, pristine, storageKey, enabled, isActive]);

  const restoreDraft = useCallback(() => {
    const stored = safeGet(storageKey);
    if (!stored) { setDraft(null); return; }
    setFormData(prev => ({ ...prev, ...stored.data, id: '', userId: prev.userId, date: prev.date }));
    setDraft(null);
  }, [storageKey, setFormData]);

  const discardDraft = useCallback(() => { safeRemove(storageKey); setDraft(null); }, [storageKey]);

  return { draft, restoreDraft, discardDraft };
}
