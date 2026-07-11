const fs = require('fs');
const file = 'src/services/dataRepository.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /bibleStudySessions: bs\.data \? toCamel\(bs\.data\) : null,/g,
  `bibleStudies: bs.data ? toCamel(bs.data) : null,`
);

fs.writeFileSync(file, code);
