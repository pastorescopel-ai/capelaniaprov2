const fs = require('fs');
let code = fs.readFileSync('src/services/dataRepository.ts', 'utf8');

code = code.replace(
  /async fetchFullTable\(tableName: string, maxRows = 100000\) {/g,
  `async fetchFullTable(tableName: string, maxRows = 100000, queryModifier?: (q: any) => any) {`
);

code = code.replace(
  /const { data: firstBatch, error: firstError } = await supabase\s*\n\s*\.from\(tableName\)\s*\n\s*\.select\('\*'\)\s*\n\s*\.range\(0, 999\);/g,
  `let q1 = supabase.from(tableName).select('*');
      if (queryModifier) q1 = queryModifier(q1);
      const { data: firstBatch, error: firstError } = await q1.range(0, 999);`
);

code = code.replace(
  /const { data, error } = await supabase\s*\n\s*\.from\(tableName\)\s*\n\s*\.select\('\*'\)\s*\n\s*\.range\(from, from \+ step - 1\);/g,
  `let q2 = supabase.from(tableName).select('*');
          if (queryModifier) q2 = queryModifier(q2);
          const { data, error } = await q2.range(from, from + step - 1);`
);

fs.writeFileSync('src/services/dataRepository.ts', code);
