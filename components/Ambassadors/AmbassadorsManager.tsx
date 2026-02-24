import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Unit, Ambassador } from '../../types';
import { normalizeString } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { Upload, Download, Users, CheckCircle, AlertCircle, Search, Trash2 } from 'lucide-react';

const AmbassadorsManager: React.FC = () => {
  const { proSectors, proStaff, config } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'import'>('dashboard');
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar embaixadores ao montar
  React.useEffect(() => {
    fetchAmbassadors();
  }, []);

  const fetchAmbassadors = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('ambassadors')
      .select('*');
    
    if (error) {
      showToast('Erro ao carregar embaixadores', 'error');
    } else {
      // Mapear snake_case para camelCase
      const formatted: Ambassador[] = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        registrationId: d.registration_id,
        email: d.email,
        sectorId: d.sector_id,
        unit: d.unit,
        completionDate: d.completion_date
      }));
      setAmbassadors(formatted);
    }
    setIsLoading(false);
  };

  // --- LÓGICA DO DASHBOARD ---
  const stats = useMemo(() => {
    const dataByUnit = {
      [Unit.HAB]: { total: 0, sectors: {} as Record<string, { name: string, count: number, totalStaff: number, percent: number }> },
      [Unit.HABA]: { total: 0, sectors: {} as Record<string, { name: string, count: number, totalStaff: number, percent: number }> }
    };

    // Inicializar setores
    proSectors.forEach(sector => {
      if (!dataByUnit[sector.unit]) return;
      
      // Contar total de staff no setor (Meta)
      const staffInSector = proStaff.filter(s => s.sectorId === sector.id && s.active !== false).length;
      
      dataByUnit[sector.unit].sectors[sector.id] = {
        name: sector.name,
        count: 0,
        totalStaff: staffInSector || 1, // Evitar divisão por zero, mas idealmente deveria ser 0 se não tem staff
        percent: 0
      };
    });

    // Contar embaixadores
    ambassadors.forEach(amb => {
      if (amb.sectorId && dataByUnit[amb.unit]?.sectors[amb.sectorId]) {
        dataByUnit[amb.unit].sectors[amb.sectorId].count++;
        dataByUnit[amb.unit].total++;
      }
    });

    // Calcular porcentagens
    Object.keys(dataByUnit).forEach(u => {
      const unit = u as Unit;
      Object.values(dataByUnit[unit].sectors).forEach(s => {
        s.percent = (s.count / s.totalStaff) * 100;
      });
    });

    return dataByUnit;
  }, [ambassadors, proSectors, proStaff]);

  const getChartData = (unit: Unit) => {
    return Object.values(stats[unit].sectors)
      .sort((a, b) => b.percent - a.percent)
      .filter(s => s.count > 0 || s.totalStaff > 5) // Mostrar apenas relevantes
      .slice(0, 15); // Top 15
  };

  // --- LÓGICA DE IMPORTAÇÃO ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setImportPreview(data);
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async () => {
    setIsLoading(true);
    let importedCount = 0;
    let skippedCount = 0;
    
    try {
      if (importPreview.length === 0) {
        throw new Error("A planilha está vazia.");
      }

      // 1. Validação de Estrutura (Cabeçalhos)
      const headers = Object.keys(importPreview[0]).map(h => normalizeString(h));
      const requiredFields = ['data', 'matricula', 'nome', 'id_setor', 'setor'];
      const forbiddenFields = ['pg', 'pequenos grupos', 'pequeno grupo'];

      // Verificar campos proibidos
      const hasForbidden = headers.some(h => forbiddenFields.some(f => h.includes(f)));
      if (hasForbidden) {
        throw new Error("A planilha contém colunas proibidas (PG ou Pequenos Grupos). Por favor, remova-as.");
      }

      // Verificar campos obrigatórios
      // Nota: A verificação é flexível para 'id_setor' vs 'id setor' devido à normalização, mas rigorosa na presença.
      const missingFields = requiredFields.filter(req => !headers.some(h => h.includes(req)));
      
      // Validação específica: Não pode ter APENAS setor ou APENAS id_setor. Precisa dos dois.
      const hasSectorName = headers.some(h => h.includes('setor') && !h.includes('id'));
      const hasSectorId = headers.some(h => h.includes('id_setor') || h.includes('id setor'));

      if (missingFields.length > 0) {
         throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}. A planilha deve conter: Data, Matricula, Nome, Id_setor, Setor.`);
      }

      if (!hasSectorName || !hasSectorId) {
        throw new Error("A planilha deve conter tanto o 'Setor' quanto o 'Id_setor' para garantir a integridade.");
      }

      const toUpsert = [];
      const errors = [];

      for (const row of importPreview) {
        // Mapeamento seguro das colunas baseado nos nomes normalizados
        const rowKeys = Object.keys(row);
        const getVal = (keyPart: string) => {
          const key = rowKeys.find(k => normalizeString(k).includes(keyPart));
          return key ? row[key] : null;
        };

        const rawDate = getVal('data');
        const matricula = getVal('matricula');
        const nome = getVal('nome');
        const idSetor = getVal('id_setor') || getVal('id setor');
        const nomeSetor = getVal('setor');

        if (!matricula || !nome) {
          continue; // Pula linhas inválidas sem erro fatal
        }

        // Tratamento da Data (Excel Serial ou String)
        let completionDate = new Date().toISOString();
        if (rawDate) {
            if (typeof rawDate === 'number') {
                // Excel date serial
                const date = new Date(Math.round((rawDate - 25569)*86400*1000));
                completionDate = date.toISOString();
            } else {
                // Tenta parsear string
                const parsed = new Date(rawDate);
                if (!isNaN(parsed.getTime())) {
                    completionDate = parsed.toISOString();
                }
            }
        }

        // Normalização de Unidade baseada no Setor ou Regra de Negócio
        // O usuário não pediu campo 'Unidade' na planilha, então precisamos inferir ou pedir.
        // O prompt anterior tinha 'Unidade' na planilha, mas o novo prompt removeu da lista de obrigatórios e pediu 'Id_setor'.
        // Vamos tentar inferir a unidade pelo match do setor no banco de dados.
        
        let unit = Unit.HAB; // Default
        let sectorIdMatch = null;

        // Tenta achar o setor pelo ID fornecido na planilha (Id_setor)
        // Assumindo que Id_setor na planilha pode bater com id ou nome no banco? 
        // O usuário pediu "Id_setor" na planilha. Se esse ID for o ID do banco, ótimo.
        // Se for um ID externo, precisamos mapear.
        // Vamos tentar achar pelo NOME do setor primeiro, que é mais garantido se o ID for externo.
        
        const sectorMatch = proSectors.find(s => 
            normalizeString(s.name) === normalizeString(nomeSetor)
        );

        if (sectorMatch) {
            unit = sectorMatch.unit;
            sectorIdMatch = sectorMatch.id;
        } else {
            // Se não achar, marca como erro ou importa sem setor vinculado?
            // O usuário quer "saber quantos colaboradores por setor". É crucial vincular.
            // Vamos logar como aviso se não achar.
        }

        toUpsert.push({
          registration_id: String(matricula).trim(),
          name: String(nome).trim(),
          // email: email, // Email não foi listado como obrigatório no novo prompt, mas estava no anterior.
          sector_id: sectorIdMatch, 
          unit: unit,
          completion_date: completionDate,
          updated_at: new Date().toISOString()
        });
      }

      if (toUpsert.length > 0) {
        // Upsert baseado na matrícula (registration_id)
        const { error } = await supabase
            .from('ambassadors')
            .upsert(toUpsert, { onConflict: 'registration_id' });
            
        if (error) throw error;
        
        importedCount = toUpsert.length;
        showToast(`${importedCount} registros processados com sucesso!`, 'success');
        setImportPreview([]);
        fetchAmbassadors();
        setActiveTab('dashboard');
      } else {
        showToast('Nenhum dado válido encontrado para importação.', 'warning');
      }

    } catch (error: any) {
      console.error(error);
      showToast(`Erro na importação: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAmbassador = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este embaixador?')) return;
    
    const { error } = await supabase.from('ambassadors').delete().eq('id', id);
    if (error) {
      showToast('Erro ao excluir', 'error');
    } else {
      showToast('Excluído com sucesso', 'success');
      setAmbassadors(prev => prev.filter(a => a.id !== id));
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-blue-600" />
            Embaixadores da Esperança
          </h1>
          <p className="text-slate-500 mt-1">Gestão do projeto de capacitação e engajamento</p>
        </div>
        
        <div className="flex gap-2 mt-4 md:mt-0">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Lista Completa
          </button>
          <button 
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'import' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Importar
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-12">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[Unit.HAB, Unit.HABA].map(unit => (
                <div key={unit} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-700 mb-4 flex justify-between">
                    Unidade {unit}
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Meta: 5%</span>
                  </h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-blue-600">{stats[unit].total}</span>
                    <span className="text-slate-500 mb-1">embaixadores</span>
                  </div>
                  
                  <div className="mt-6 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getChartData(unit)} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, 'auto']} hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                        <Tooltip />
                        <Bar dataKey="percent" name="% Atingido" radius={[0, 4, 4, 0]}>
                          {getChartData(unit).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.percent >= 5 ? '#22c55e' : '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div>
             <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3 font-medium">Matrícula</th>
                    <th className="p-3 font-medium">Nome</th>
                    <th className="p-3 font-medium">Unidade</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-600">
                  {ambassadors.map(amb => {
                    const sectorName = proSectors.find(s => s.id === amb.sectorId)?.name || 'Não identificado';
                    return (
                      <tr key={amb.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-xs">{amb.registrationId || '-'}</td>
                        <td className="p-3 font-medium text-slate-800">{amb.name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${amb.unit === Unit.HAB ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {amb.unit}
                          </span>
                        </td>
                        <td className="p-3">{sectorName}</td>
                        <td className="p-3">{new Date(amb.completionDate).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={() => deleteAmbassador(amb.id)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {ambassadors.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        Nenhum embaixador cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="mb-8">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Importar do Google Sheets</h3>
              <p className="text-slate-500 mt-2">
                Exporte sua planilha do Google Forms como <strong>.xlsx</strong> ou <strong>.csv</strong> e envie abaixo.
              </p>
            </div>

            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
            />

            {!importPreview.length ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-200 flex items-center gap-2 mx-auto"
              >
                Selecionar Arquivo
              </button>
            ) : (
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 text-left">
                <h4 className="font-bold text-slate-700 mb-2">Pré-visualização ({importPreview.length} registros)</h4>
                <div className="max-h-60 overflow-y-auto text-xs text-slate-500 mb-4 bg-white p-2 rounded border">
                  <pre>{JSON.stringify(importPreview[0], null, 2)}</pre>
                  <p className="mt-2 text-center italic">... e mais {importPreview.length - 1} linhas</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button 
                    onClick={() => setImportPreview([])}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={processImport}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                  >
                    {isLoading ? 'Processando...' : 'Confirmar Importação'}
                  </button>
                </div>
              </div>
            )}
            
            <div className="mt-12 text-left bg-yellow-50 p-4 rounded-lg border border-yellow-100">
              <h5 className="font-bold text-yellow-800 text-sm mb-2 flex items-center gap-2">
                <AlertCircle size={16} />
                Instruções de Formatação (Rigoroso)
              </h5>
              <ul className="text-xs text-yellow-700 space-y-1 list-disc pl-4">
                <li><strong>Campos Obrigatórios:</strong> Data, Matricula, Nome, Id_setor, Setor.</li>
                <li><strong>Proibido:</strong> Colunas contendo "PG" ou "Pequenos Grupos".</li>
                <li><strong>Validação:</strong> A planilha será recusada se faltar campos ou contiver campos proibidos.</li>
                <li>Registros com a mesma matrícula serão atualizados (não duplicados).</li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AmbassadorsManager;
