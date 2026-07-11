const fs = require('fs');
const file = 'src/components/PGManagement/DashboardActivityHistory.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /const userMap = new Map\(users\.map\(u => \[u\.id, u\.name\]\)\);/,
  `const userMap = new Map((users || []).map(u => [u.id, u.name]));`
);

code = code.replace(
  /\.\.\.bibleStudies\.map/g,
  `...(bibleStudies || []).map`
);

code = code.replace(
  /\.\.\.bibleClasses\.map/g,
  `...(bibleClasses || []).map`
);

code = code.replace(
  /\.\.\.smallGroups\.map/g,
  `...(smallGroups || []).map`
);

code = code.replace(
  /\.\.\.staffVisits\.map/g,
  `...(staffVisits || []).map`
);

fs.writeFileSync(file, code);
