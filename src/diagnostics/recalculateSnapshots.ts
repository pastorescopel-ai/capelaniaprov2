
import { createClient } from '@supabase/supabase-js';
import { countUniqueClasses } from '../utils/formatters';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function recalculate() {
  console.log('Iniciando recálculo de snapshots...');

  const { data: snapshots, error: snapError } = await supabase
    .from('proMonthlyStats')
    .select('*');

  if (snapError) throw snapError;

  for (const snap of snapshots) {
    const { unit, month, year } = snap;
    console.log(`Processando snapshot ${snap.id} - ${unit} ${month}/${year}`);

    // Busca classes do mês/unidade
    const { data: classes, error: classError } = await supabase
      .from('bible_classes')
      .select('*')
      .eq('unit', unit)
      .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lte('date', `${year}-${String(month).padStart(2, '0')}-31`);

    if (classError) {
      console.error('Erro buscando classes', classError);
      continue;
    }

    const uniqueCount = countUniqueClasses(classes || []);
    
    // Atualiza snapshot
    const updatedData = { ...snap.snapshotData };
    if (updatedData.performanceMetrics) {
        updatedData.performanceMetrics.totalBibleClasses = uniqueCount;
        // Se houver classes por capelão, precisaria de uma lógica mais complexa, 
        // mas o totalBibleClasses é o principal.
    }
    
    await supabase
      .from('proMonthlyStats')
      .update({ snapshotData: updatedData })
      .eq('id', snap.id);
      
    console.log(`Snapshot ${snap.id} atualizado: ${uniqueCount} classes.`);
  }
}

recalculate().catch(console.error);
