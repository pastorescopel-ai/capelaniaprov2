import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AppUpdateCheckerProps {
  config?: {
    primaryColor?: string;
  };
}

export const AppUpdateChecker: React.FC<AppUpdateCheckerProps> = ({ config }) => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  // Atualização automática na abertura/login: cobre a tela com um aviso curto enquanto recarrega,
  // em vez do banner com botão "Atualizar Agora".
  const [isAutoUpdating, setIsAutoUpdating] = useState(false);
  const [changelog, setChangelog] = useState<string[]>([]);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  // Espelham isChecking/hasUpdate sem entrar nas dependências do useCallback: antes, cada checagem
  // trocava a identidade de checkForUpdates, o que reiniciava o efeito abaixo e agendava OUTRA
  // checagem forçada -- o app ficava buscando /index.html em loop a cada ~5s.
  const isCheckingRef = useRef(false);
  const hasUpdateRef = useRef(false);

  // Busca o resumo do que mudou nesta atualização (public/changelog.json, servido estático,
  // independente do hash dos bundles JS/CSS). É atualizado a cada release com um resumo curto
  // dos ajustes feitos, pra mostrar ao usuário o que ele vai ganhar ao clicar em "Atualizar Agora"
  // em vez do texto genérico de sempre.
  const fetchChangelog = useCallback(async () => {
    try {
      const res = await fetch(`/changelog.json?cb=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      if (!res.ok) return;
      const entries = await res.json();
      const latest = Array.isArray(entries) ? entries[0] : null;
      if (latest && Array.isArray(latest.changes)) {
        setChangelog(latest.changes);
      }
    } catch {
      // Falha silenciosa: se não conseguir buscar o changelog, o banner cai pro texto genérico
    }
  }, []);

  // Obtém URLs completas de scripts e folhas de estilo do documento e filtra somente o que for local (/assets/)
  const getAssetFingerprints = useCallback((doc: Document): string[] => {
    const scripts = Array.from(doc.querySelectorAll('script'))
      .map(s => s.getAttribute('src'))
      .filter((src): src is string => !!src && src.startsWith('/assets/'));

    const styles = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.getAttribute('href'))
      .filter((href): href is string => !!href && href.startsWith('/assets/'));

    return [...scripts, ...styles];
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    // NÃO desregistra o Service Worker -- ele já se atualiza sozinho (self.skipWaiting() +
    // clients.claim() em sw.ts) assim que o navegador detecta um sw.js com conteúdo novo, o
    // que só de recarregar a página (com cache-busting abaixo) já dispara. Desregistrar criava
    // um registration novo do zero a cada atualização, e a inscrição de notificação push
    // pertence ao registration antigo -- ela ficava "perdida" (mesmo continuando cadastrada no
    // banco) e o app achava que notificação nunca tinha sido ativada, pedindo de novo toda vez.
    window.location.assign(window.location.origin + window.location.pathname + '?update=' + Date.now());
  };

  // Trava anti-loop da atualização automática: se já recarregou automaticamente há pouco e o
  // servidor AINDA aparece como diferente (ex: cache de borda servindo um index.html velho),
  // não recarrega de novo -- cai no banner manual em vez de ficar recarregando sem parar.
  const AUTO_UPDATE_KEY = 'capelania_auto_update_ts';
  const AUTO_UPDATE_COOLDOWN_MS = 2 * 60 * 1000;
  const canAutoUpdate = () => {
    try {
      const last = Number(sessionStorage.getItem(AUTO_UPDATE_KEY) || 0);
      return !last || Date.now() - last > AUTO_UPDATE_COOLDOWN_MS;
    } catch {
      return false; // sem sessionStorage não dá pra garantir o anti-loop -- usa o banner
    }
  };

  // Fechar/"Mais Tarde" também zera o espelho, senão as próximas checagens (que ignoram enquanto
  // hasUpdateRef está true) nunca mais reabririam o banner.
  const dismissBanner = () => { hasUpdateRef.current = false; setHasUpdate(false); };

  const checkForUpdates = useCallback(async (forced = false, autoApply = false) => {
    // Evita verificações em massa repetitivas em menos de 10 segundos
    const now = Date.now();
    if (!forced && now - lastCheckTimeRef.current < 10000) return;
    lastCheckTimeRef.current = now;

    if (isCheckingRef.current || hasUpdateRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      // Faz um fetch com parâmetros de cache buster para garantir que bate no servidor de verdade
      const response = await fetch(`/index.html?cb=${now}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });

      if (!response.ok) {
        return;
      }

      const htmlText = await response.text();
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(htmlText, 'text/html');

      const serverAssets = getAssetFingerprints(parsedDoc);
      const localAssets = getAssetFingerprints(document);

      // Em ambiente de desenvolvimento, não haverá hashes '/assets/' (usa-se HMR ou fontes directas)
      if (serverAssets.length === 0) {
        return;
      }

      // Compara se o servidor possui algum arquivo estático (JS/CSS) com hash hashado diferente do cliente atual
      const isMismatch = serverAssets.some(asset => !localAssets.includes(asset));

      if (isMismatch) {
        console.log('[Capelania AutoUpdate] Mismatch de assets detectado!', {
          servidor: serverAssets,
          local: localAssets
        });
        // Na checagem de abertura/login ainda não há nada digitado -- aplica sozinho, sem esperar
        // clique. Depois (durante o uso) segue o banner, pra nunca recarregar no meio de um
        // formulário preenchido.
        if (autoApply && canAutoUpdate()) {
          try { sessionStorage.setItem(AUTO_UPDATE_KEY, String(Date.now())); } catch { /* ignora */ }
          hasUpdateRef.current = true;
          setIsAutoUpdating(true);
          handleUpdate();
          return;
        }
        hasUpdateRef.current = true;
        setHasUpdate(true);
        fetchChangelog();
      }
    } catch (error) {
      if (navigator.onLine) console.warn('[Capelania AutoUpdate] Falha de rede ao checar atualização (ignorando):', error);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [getAssetFingerprints, fetchChangelog]);

  useEffect(() => {
    // 1. Checa por atualizações ao montar (= logo após o login / ao abrir o app já logado) e,
    //    se houver versão nova, aplica sozinho -- curto o bastante pra ocorrer antes de a pessoa
    //    começar a digitar algo.
    const initTimeout = setTimeout(() => {
      checkForUpdates(true, true);
    }, 1500);

    // 2. Intervalo periódico (a cada 3 minutos)
    const INTERVAL_MS = 3 * 60 * 1000;
    checkIntervalRef.current = setInterval(() => {
      checkForUpdates();
    }, INTERVAL_MS);

    // 3. Checa sempre que o usuário retornar ao app (Focus / Tab Visibility)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates(true);
      }
    };

    // 4. Checa em eventos de foco da janela
    const handleFocus = () => {
      checkForUpdates();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Expõe uma função global no console do navegador para testar e validar o visual/comportamento da atualização
    (window as any).__simularAtualizacaoCapelania = () => {
      console.log('[Capelania AutoUpdate] 🧪 Simulação de atualização ativada manualmente pelo Console!');
      setHasUpdate(true);
      fetchChangelog();
    };

    return () => {
      clearTimeout(initTimeout);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      delete (window as any).__simularAtualizacaoCapelania;
    };
  }, [checkForUpdates, fetchChangelog]);

  const primaryCol = config?.primaryColor || '#005a9c';

  return (
    <>
    {isAutoUpdating && (
      <div className="fixed inset-0 z-[100000] bg-white/90 backdrop-blur-sm flex items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: `${primaryCol}33`, borderTopColor: primaryCol }}></div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-700">Atualizando para a versão mais recente…</p>
        </div>
      </div>
    )}
    <AnimatePresence>
      {hasUpdate && (
        <motion.div
          id="app-update-alert-banner"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[420px] z-[99999]"
        >
          <div className="bg-white/95 backdrop-blur-md text-slate-900 p-4 md:p-5 rounded-3xl shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 animate-bounce"
                style={{ backgroundColor: primaryCol }}
              >
                <i className="fas fa-sparkles text-sm"></i>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 opacity-100">
                  Melhoria Instalada
                </h4>
                {changelog.length > 0 ? (
                  <ul className="text-[11px] text-slate-700 mt-1.5 space-y-1 opacity-90">
                    {changelog.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                        <i className="fas fa-check text-[9px] mt-[3px] shrink-0" style={{ color: primaryCol }}></i>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-700 mt-1 leading-relaxed opacity-90">
                    Uma nova atualização está disponível com correções e novas funcionalidades para a capelania.
                  </p>
                )}
              </div>
              <button 
                onClick={dismissBanner}
                className="text-slate-500 hover:text-slate-900 transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100"
                title="Fechar (não recomendado, clique para atualizar)"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-blue-500/10 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait"
                style={{ backgroundColor: primaryCol }}
              >
                <i className="fas fa-sync fa-spin"></i>
                {isUpdating ? 'Atualizando...' : 'Atualizar Agora'}
              </button>
              <button
                onClick={dismissBanner}
                disabled={isUpdating}
                className="py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all text-center border border-slate-300 disabled:opacity-50"
              >
                Mais Tarde
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};
