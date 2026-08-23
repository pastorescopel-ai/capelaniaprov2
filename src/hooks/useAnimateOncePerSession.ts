
const PREFIX = 'capelania_chart_animated_';

// Decide se um grupo de gráficos deve tocar a animação de entrada agora. A primeira vez que
// isso é chamado (nesse login) pra uma dada `key`, marca a chave no sessionStorage e devolve
// true (anima). Da segunda vez em diante -- mesmo trocando de sub-aba dentro de Gestão de PGs,
// o que remonta o componente -- devolve false (mostra o valor final direto, sem animação),
// até a pessoa deslogar e logar de novo (ver clearSessionAnimationFlags, chamado no logout).
// sessionStorage (não useState/useRef) de propósito: precisa sobreviver a remontagens do
// componente inteiro, só sessionStorage carrega esse estado entre uma montagem e outra.
export function shouldAnimateThisSession(key: string): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return true;
  const storageKey = PREFIX + key;
  try {
    const already = window.sessionStorage.getItem(storageKey) === '1';
    if (!already) window.sessionStorage.setItem(storageKey, '1');
    return !already;
  } catch {
    // Modo privado/sessionStorage bloqueado -- não trava a animação por causa disso, só sempre anima.
    return true;
  }
}

// Chamado no logout pra garantir que os gráficos voltem a animar no próximo login, mesmo
// dentro da mesma aba do navegador (sessionStorage sozinho não zera nisso).
export function clearSessionAnimationFlags(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    Object.keys(window.sessionStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => window.sessionStorage.removeItem(k));
  } catch {
    // sem sessionStorage disponível, nada a limpar
  }
}
