
import React from 'react';
import Button from '../Shared/Button';

interface ActionsProps {
  pColor: string;
  generating: string | null;
  onPdf: () => void;
  onExcel: () => void;
  onAuditVidas: () => void;
  onAuditVisitas: () => void;
  onPGReport: () => void;
}

const ReportActions: React.FC<ActionsProps> = ({ pColor, generating, onPdf, onExcel, onAuditVidas, onAuditVisitas, onPGReport }) => {
  return (
    <div className="flex flex-wrap gap-3">
      <Button 
        variant="primary" 
        style={{backgroundColor: pColor}} 
        onClick={onPdf} 
        isLoading={generating === 'official'} 
        icon={<i className="fas fa-file-pdf"></i>}
      >
        Imprimir PDF
      </Button>
      
      <Button 
        variant="success" 
        onClick={onExcel} 
        icon={<i className="fas fa-file-excel"></i>}
      >
        Gerar Excel
      </Button>

      <Button 
        variant="ghost" 
        onClick={onPGReport} 
        isLoading={generating === 'pg_report'} 
        icon={<i className="fas fa-users"></i>} 
        className="!text-[9px]"
      >
        Relatório PGs
      </Button>

      <Button 
        variant="ghost" 
        onClick={onAuditVidas} 
        isLoading={generating === 'students'} 
        icon={<i className="fas fa-user-graduate"></i>} 
        className="!text-[9px]"
      >
        Audit Alunos
      </Button>

      <Button 
        variant="ghost" 
        onClick={onAuditVisitas} 
        isLoading={generating === 'visits'} 
        icon={<i className="fas fa-hands-helping"></i>} 
        className="!text-[9px]"
      >
        Audit Visitas
      </Button>
    </div>
  );
};

export default ReportActions;
