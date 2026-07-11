const fs = require('fs');
let content = fs.readFileSync('src/hooks/healer/useHealerActions.ts', 'utf8');

content = content.replace(
`  const handleMoveSectorUnit = async (orphan: any, targetUnit: string) => {
      // Tenta encontrar o setor em qualquer unidade (já que ele é órfão na atual)
      const sector = proSectors.find((s: any) => String(s.id) === String(orphan.originalValue));
      
      if (!sector) {
          showToast("Cadastro mestre deste setor não encontrado em nenhuma unidade para mover.", "error");
          return;
      }

      if (!confirm(\`Deseja mover o cadastro do setor "\${sector.name}" (ID \${sector.id}) da unidade \${sector.unit} para \${targetUnit}?\`)) return;

      setIsProcessing(true);
      try {
          const success = await saveRecord('proSectors', { ...sector, unit: targetUnit, updatedAt: Date.now() });
          if (success) {
            await loadFromCloud(true);
            showToast(\`Setor \${sector.name} movido com sucesso para \${targetUnit}!\`, "success");
            setResolvedItems((prev: any) => {
                const next = new Set(prev);
                next.add(orphan.display);
                next.add(\`id:\${orphan.originalValue}\`);
                return next;
            });
          } else {
            showToast("Falha ao mover setor no banco de dados.", "error");
          }
      } catch (err) {
          showToast("Falha ao mover setor: " + (err as Error).message, "warning");
      } finally {
          setIsProcessing(false);
      }
  };`,
`  const handleMoveSectorUnit = async (orphan: any, targetUnit: string) => {
      // Tenta encontrar o setor em qualquer unidade (já que ele é órfão na atual)
      const sector = proSectors.find((s: any) => String(s.id) === String(orphan.originalValue));
      
      if (!sector) {
          showToast("Cadastro mestre deste setor não encontrado em nenhuma unidade para mover.", "error");
          return;
      }

      state.setConfirmModal({
        isOpen: true,
        title: 'Confirmar Movimentação',
        message: \`Deseja mover o cadastro do setor "\${sector.name}" (ID \${sector.id}) da unidade \${sector.unit} para \${targetUnit}?\`,
        variant: 'warning',
        onConfirm: async () => {
          state.setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setIsProcessing(true);
          try {
              const success = await saveRecord('proSectors', { ...sector, unit: targetUnit, updatedAt: Date.now() });
              if (success) {
                await loadFromCloud(true);
                showToast(\`Setor \${sector.name} movido com sucesso para \${targetUnit}!\`, "success");
                setResolvedItems((prev: any) => {
                    const next = new Set(prev);
                    next.add(orphan.display);
                    next.add(\`id:\${orphan.originalValue}\`);
                    return next;
                });
              } else {
                showToast("Falha ao mover setor no banco de dados.", "error");
              }
          } catch (err) {
              showToast("Falha ao mover setor: " + (err as Error).message, "warning");
          } finally {
              setIsProcessing(false);
          }
        }
      });
  };`
);

fs.writeFileSync('src/hooks/healer/useHealerActions.ts', content);
