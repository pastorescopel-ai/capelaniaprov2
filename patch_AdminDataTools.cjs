const fs = require('fs');
let content = fs.readFileSync('src/components/Admin/AdminDataTools.tsx', 'utf8');

// Import ConfirmationModal
if (!content.includes('ConfirmationModal')) {
    content = content.replace(
        /import SyncModal, \{ SyncStatus \} from '\.\.\/Shared\/SyncModal';/,
        `import SyncModal, { SyncStatus } from '../Shared/SyncModal';\nimport ConfirmationModal from '../Shared/ConfirmationModal';`
    );
}

// Add state
if (!content.includes('setConfirmModal')) {
    content = content.replace(
        /const \[detailsModal, setDetailsModal\] = useState<\w+.*?>\(\{.*\}\);/,
        `$&
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'primary' | 'warning';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });`
    );
}

// Replace window.confirm
// 1. deleteFile
content = content.replace(
    /if \(!window\.confirm\(`Tem certeza que deseja deletar o arquivo: \$\{filePath\}\?`\)\) return;/g,
    `setConfirmModal({
      isOpen: true,
      title: 'Confirmar Exclusão',
      message: \`Tem certeza que deseja deletar o arquivo: \${filePath}?\`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch('/api/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
          });
          if (response.ok) {
            showToast("Arquivo deletado com sucesso!", "success");
            runRobustDiagnostics(); // Re-run diagnostics
          } else {
            showToast("Erro ao deletar arquivo.", "error");
          }
        } catch (err) {
          showToast("Erro ao deletar arquivo: " + (err as Error).message, "warning");
        }
      }
    });
    return;`
);

// We need to carefully remove the original body of deleteFile
// Actually, let's just use regex for the specific lines.
