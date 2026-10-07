// Som dentro do app para os lembretes (push). Gerado na hora com a Web Audio API -- sem arquivo de
// áudio pra baixar, funciona offline. Só toca com o app ABERTO: navegador nenhum permite que um site
// escolha o som de uma notificação push com o app fechado (aí vale o som padrão do aparelho).

const STORAGE_KEY = 'capelania_push_sound';

export const isNotificationSoundEnabled = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
};

export const setNotificationSoundEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // sem localStorage: segue com o padrão (ligado)
  }
};

let audioCtx: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
};

// Navegadores só liberam áudio depois de um toque/tecla do usuário. Chamado uma vez na primeira
// interação (ver PushFeedback.tsx) pra o sino já estar liberado quando o aviso chegar.
export const unlockNotificationAudio = async (): Promise<void> => {
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* tenta de novo na próxima interação */ }
  }
};

// Sino de duas notas (normal) ou quatro notas alternadas (firme). Devolve false se o navegador não
// deixou tocar (ex: ainda sem nenhuma interação com a página).
export const playNotificationChime = async (firm = false): Promise<boolean> => {
  const ctx = getContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { return false; }
  }
  if (ctx.state !== 'running') return false;

  const notes = firm ? [880, 1175, 880, 1175] : [880, 1320];
  const noteLen = 0.18;
  const start = ctx.currentTime + 0.02;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = start + i * noteLen;
    // ataque rápido + decaimento suave: som de sino, sem "estalo" no início/fim
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(firm ? 0.35 : 0.22, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + noteLen * 1.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + noteLen * 1.7);
  });
  return true;
};
