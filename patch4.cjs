const fs = require('fs');
let code = fs.readFileSync('src/hooks/useDataActions.ts', 'utf8');

code = code.replace(
  /const loadFromCloud = useCallback\(async \(showLoader = false\) => \{[\s\S]*?\}, \[setters, setIsSyncing, setIsConnected, applySystemOverrides\]\);/,
  `const loadFromCloud = useCallback(async (showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      // 1. Fase Rápida/Crítica
      const coreData = await DataRepository.syncCore();
      if (coreData) {
        Object.entries(coreData).forEach(([key, val]) => {
          if (val !== null && setters[key]) {
            setters[key](val);
          }
        });
        if (coreData.config) {
          applySystemOverrides(coreData.config);
        }
        setIsConnected(true);
      }
      
      // 2. Fase Pesada/Background (não bloqueia o retorno)
      DataRepository.syncBackground().then(bgData => {
         if (bgData) {
            Object.entries(bgData).forEach(([key, val]) => {
              if (val !== null && setters[key]) {
                setters[key](val);
              }
            });
         }
      }).catch(err => {
         console.error('Erro na fase background:', err);
      });
      
    } catch (e) {
      setIsConnected(false);
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [setters, setIsSyncing, setIsConnected, applySystemOverrides]);`
);

code = code.replace(
  /const refreshData = useCallback\(async \(\) => \{[\s\S]*?return \{ success: false, error: err \};\n    \}\n  \}, \[setters, setIsSyncing\]\);/,
  `const refreshData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await DataRepository.syncAll();
      if (data) {
        Object.entries(data).forEach(([key, val]) => {
          if (val !== null && setters[key]) {
            setters[key](val);
          }
        });
      }
      return { success: true };
    } catch (err) {
      console.error("Erro ao recarregar dados:", err);
      return { success: false, error: err };
    } finally {
      setIsSyncing(false);
    }
  }, [setters, setIsSyncing]);`
);

fs.writeFileSync('src/hooks/useDataActions.ts', code);
