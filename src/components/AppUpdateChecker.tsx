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
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckTimeRef = useRef<number>(0);

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

  const checkForUpdates = useCallback(async (forced = false) => {
    // Evita verificações em massa repetitivas em menos de 10 segundos
    const now = Date.now();
    if (!forced && now - lastCheckTimeRef.current < 10000) return;
    lastCheckTimeRef.current = now;

    if (isChecking || hasUpdate) return;
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
        setIsChecking(false);
        return;
      }

      const htmlText = await response.text();
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(htmlText, 'text/html');

      const serverAssets = getAssetFingerprints(parsedDoc);
      const localAssets = getAssetFingerprints(document);

      // Em ambiente de desenvolvimento, não haverá hashes '/assets/' (usa-se HMR ou fontes directas)
      if (serverAssets.length === 0) {
        setIsChecking(false);
        return;
      }

      // Compara se o servidor possui algum arquivo estático (JS/CSS) com hash hashado diferente do cliente atual
      const isMismatch = serverAssets.some(asset => !localAssets.includes(asset));

      if (isMismatch) {
        console.log('[Capelania AutoUpdate] Mismatch de assets detectado!', {
          servidor: serverAssets,
          local: localAssets
        });
        setHasUpdate(true);
      }
    } catch (error) {
      console.warn('[Capelania AutoUpdate] Erro silencioso ao checar por atualizações:', error);
    } finally {
      setIsChecking(false);
    }
  }, [getAssetFingerprints, isChecking, hasUpdate]);

  const handleUpdate = () => {
    // Força o reload completo, ignorando o cache
    window.location.href = window.location.origin + window.location.pathname + '?update=' + Date.now();
  };

  useEffect(() => {
    // 1. Checa por atualizações ao montar o componente
    // timeout para não concorrer com o carregamento inicial pesado
    const initTimeout = setTimeout(() => {
      checkForUpdates(true);
    }, 5000);

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
  }, [checkForUpdates]);

  const primaryCol = config?.primaryColor || '#005a9c';

  return (
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
          <div className="bg-slate-900/98 backdrop-blur-md text-white p-4 md:p-5 rounded-3xl shadow-2xl border border-blue-500/20 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 animate-bounce"
                style={{ backgroundColor: primaryCol }}
              >
                <i className="fas fa-sparkles text-sm"></i>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">
                  Melhoria Instalada
                </h4>
                <p className="text-[11px] text-slate-200 mt-1 leading-relaxed">
                  Uma nova atualização está disponível com correções e novas funcionalidades para a capelania.
                </p>
              </div>
              <button 
                onClick={() => setHasUpdate(false)}
                className="text-slate-400 hover:text-white transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/5"
                title="Fechar (não recomendado, clique para atualizar)"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={handleUpdate}
                className="flex-1 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-blue-500/10 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryCol }}
              >
                <i className="fas fa-sync fa-spin"></i>
                Atualizar Agora
              </button>
              <button
                onClick={() => setHasUpdate(false)}
                className="py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-white hover:bg-white/5 transition-all text-center border border-slate-700/50"
              >
                Mais Tarde
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
