
import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';

export const useDocumentGenerator = () => {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const { showToast } = useToast();

  const generateExcel = async (data: any[], sheetName: string, fileName: string) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${fileName}.xlsx`);
      showToast("Excel gerado com sucesso!", "success");
    } catch (e) {
      console.error(e);
      showToast("Falha ao gerar Excel.", "warning");
    }
  };

  // Função auxiliar interna para converter HTML em Imagem
  const htmlToImage = async (element: HTMLElement) => {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const generatePdf = async (htmlContent: string, fileName: string = 'Documento') => {
    setIsGenerating('pdf');
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-10000px';
    tempDiv.style.top = '0';
    tempDiv.innerHTML = htmlContent;
    document.body.appendChild(tempDiv);

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = tempDiv.querySelectorAll('.pdf-page');

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const imgData = await htmlToImage(pages[i] as HTMLElement);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      console.error(e);
      showToast("Erro na geração do PDF.", "warning");
    } finally {
      document.body.removeChild(tempDiv);
      setIsGenerating(null);
    }
  };

  const generateZipOfPdfs = async (
    items: { html: string; name: string }[], 
    zipName: string
  ) => {
    setIsGenerating('zip');
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-10000px';
    tempDiv.style.top = '0';
    document.body.appendChild(tempDiv);

    try {
      const { jsPDF } = await import('jspdf');
      const JSZip = (await import('jszip')).default;
      const html2canvas = (await import('html2canvas')).default;
      
      const zip = new JSZip();
      const total = items.length;

      for (let i = 0; i < total; i++) {
        setProgress(`Processando ${i + 1}/${total}...`);
        const item = items[i];
        
        // Renderiza no DOM temporário
        tempDiv.innerHTML = item.html;
        const element = tempDiv.firstElementChild as HTMLElement;

        // Converte
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Cria PDF individual
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        
        // Adiciona ao ZIP
        const safeName = item.name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
        zip.file(`${safeName}.pdf`, pdf.output('blob'));
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${zipName}.zip`;
      a.click();
      showToast("Backup ZIP gerado com sucesso!", "success");

    } catch (e) {
      console.error(e);
      showToast("Erro ao gerar ZIP.", "warning");
    } finally {
      document.body.removeChild(tempDiv);
      setIsGenerating(null);
      setProgress(null);
    }
  };

  return {
    generateExcel,
    generatePdf,
    generateZipOfPdfs,
    isGenerating,
    progress
  };
};
